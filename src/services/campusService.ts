import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as secondarySignOut,
  updateProfile as secondaryUpdateProfile,
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import {
  db,
  getSecondaryRegistrarServices,
  handleFirestoreError,
  OperationType,
  storage,
} from '../lib/firebase';
import {
  type ComplaintCategory,
  type ComplaintHistoryItem,
  type ComplaintPriority,
  type ComplaintRecord,
  type ComplaintStatus,
  type ContactMessageRecord,
  type NotificationRecord,
  type NotificationType,
  type PublicStats,
  STATS_SHARD_COUNT,
  type UserProfile,
  VALIDATION_LIMITS,
} from '../types/campusfix';

storage.maxUploadRetryTime = 15000;
storage.maxOperationRetryTime = 15000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function generateComplaintId(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) {
      suffix += chars.charAt(bytes[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `CMP-${year}-${suffix}`;
}

export function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${Date.now()}_${randomPart}`;
}

export async function writeStatsShardIncrement(
  delta: {
    totalReported?: number;
    totalResolved?: number;
    activeRequests?: number;
    registeredStudents?: number;
  },
  targetDb = db
): Promise<void> {
  const shardIdx = Math.floor(Math.random() * STATS_SHARD_COUNT);
  const shardRef = doc(targetDb, 'public_stats_shards', `shard_${shardIdx}`);
  await setDoc(
    shardRef,
    {
      totalReported: increment(delta.totalReported ?? 0),
      totalResolved: increment(delta.totalResolved ?? 0),
      activeRequests: increment(delta.activeRequests ?? 0),
      registeredStudents: increment(delta.registeredStudents ?? 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadComplaintImage(
  userId: string,
  complaintId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG, or WEBP image files are permitted.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size must be 5 MB or less.');
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `complaints/${userId}/${complaintId}/${Date.now()}_${sanitizedName}`);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(percent);
        }
      },
      (error) => {
        const message = error.message || 'Failed to upload photograph to Firebase Storage.';
        reject(
          new Error(
            `Photo upload failed (${error.code || 'storage-error'}): ${message}. Ensure Firebase Storage is enabled in your Firebase Console.`
          )
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress?.(100);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export interface CreateComplaintInput {
  complaintId: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  studentIdNumber: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  building: string;
  location: string;
  priority: ComplaintPriority;
  imageUrl: string;
  affectedStudentsCount?: number;
  affectedUsnRange?: string;
}

function buildValidatedComplaintPayload(input: CreateComplaintInput) {
  const title = input.title.trim().slice(0, VALIDATION_LIMITS.title.max);
  const description = input.description.trim().slice(0, VALIDATION_LIMITS.description.max);
  const building = input.building.trim().slice(0, VALIDATION_LIMITS.building.max);
  const location = input.location.trim().slice(0, VALIDATION_LIMITS.location.max);
  const studentName = input.studentName.trim().slice(0, VALIDATION_LIMITS.fullName.max);
  const studentIdNumber = input.studentIdNumber.trim().slice(0, VALIDATION_LIMITS.studentId.max);

  if (title.length < VALIDATION_LIMITS.title.min) {
    throw new Error(`Issue title must be at least ${VALIDATION_LIMITS.title.min} characters.`);
  }
  if (description.length < VALIDATION_LIMITS.description.min) {
    throw new Error(`Description must be at least ${VALIDATION_LIMITS.description.min} characters.`);
  }
  if (!VALIDATION_LIMITS.idPattern.test(input.complaintId)) {
    throw new Error('Generated complaint ID format is invalid.');
  }

  const affectedStudentsCount = Math.min(
    500,
    Math.max(1, Math.round(Number(input.affectedStudentsCount ?? 1)))
  );
  const affectedUsnRange = (input.affectedUsnRange ?? '')
    .trim()
    .slice(0, VALIDATION_LIMITS.affectedUsnRange.max);

  const initialHistory: ComplaintHistoryItem[] = [
    {
      status: 'Submitted',
      note:
        affectedStudentsCount > 1
          ? `Issue reported for ${affectedStudentsCount} cohort students and queued for administrative review.`
          : 'Issue reported by student and queued for administrative review.',
      actorName: studentName,
      timestamp: new Date().toISOString(),
    },
  ];

  return {
    title,
    description,
    building,
    location,
    studentName,
    studentIdNumber,
    affectedStudentsCount,
    affectedUsnRange,
    payload: {
      complaintId: input.complaintId,
      studentUid: input.studentUid,
      studentName,
      studentEmail: input.studentEmail,
      studentIdNumber,
      title,
      description,
      category: input.category,
      building,
      location,
      priority: input.priority,
      imageUrl: input.imageUrl || '',
      status: 'Submitted' as ComplaintStatus,
      adminRemarks: '',
      history: initialHistory,
      affectedStudentsCount,
      affectedUsnRange,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  };
}

export async function createComplaint(input: CreateComplaintInput): Promise<string> {
  await createBatchComplaints([input]);
  return input.complaintId;
}

export async function createBatchComplaints(inputs: CreateComplaintInput[]): Promise<string[]> {
  if (inputs.length === 0) return [];
  const prepared = inputs.map((item) => ({
    input: item,
    validated: buildValidatedComplaintPayload(item),
  }));

  // 3 Firestore writes per complaint (complaint + student notification + admin notification)
  // Chunk in groups of 100 (300 writes << 500 Firestore batch cap)
  const chunkSize = 100;
  for (let i = 0; i < prepared.length; i += chunkSize) {
    const chunk = prepared.slice(i, i + chunkSize);
    const complaintPath = `complaints/${chunk[0].input.complaintId}`;
    try {
      const batch = writeBatch(db);
      for (const { input, validated } of chunk) {
        const complaintRef = doc(db, 'complaints', input.complaintId);
        batch.set(complaintRef, validated.payload);

        const studentNotifId = generateSafeId('NTF_STU');
        batch.set(doc(db, 'notifications', studentNotifId), {
          recipientUid: input.studentUid,
          recipientRole: 'student',
          complaintId: input.complaintId,
          title: 'Complaint Submitted',
          message: `Your report "${validated.title}" (${input.complaintId}) has been logged and sent to campus administration.`,
          type: 'submitted' as NotificationType,
          read: false,
          createdAt: serverTimestamp(),
        });

        const adminNotifId = generateSafeId('NTF_ADM');
        batch.set(doc(db, 'notifications', adminNotifId), {
          recipientUid: 'admins',
          recipientRole: 'admin',
          complaintId: input.complaintId,
          title: `New ${input.priority} Priority Report`,
          message: `${validated.studentName} reported "${validated.title}" at ${validated.building}, ${validated.location}.`,
          type: 'new_complaint' as NotificationType,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, complaintPath);
    }
  }

  // Update distributed counter shard without single-doc transaction contention
  try {
    await writeStatsShardIncrement({
      totalReported: prepared.length,
      activeRequests: prepared.length,
    });
  } catch (error) {
    console.warn('Public stats shard sync skipped:', error);
  }

  return inputs.map((item) => item.complaintId);
}

export async function updateComplaintByAdmin(params: {
  complaint: ComplaintRecord;
  newStatus: ComplaintStatus;
  newPriority: ComplaintPriority;
  adminRemarks: string;
  adminName: string;
}): Promise<void> {
  const { complaint, newStatus, newPriority, adminRemarks, adminName } = params;
  const trimmedRemarks = adminRemarks.trim().slice(0, VALIDATION_LIMITS.adminRemarks.max);
  const path = `complaints/${complaint.complaintId}`;

  const noteText =
    trimmedRemarks.length > 0
      ? trimmedRemarks
      : `Status updated to ${newStatus} by ${adminName}.`;

  const updatedHistory: ComplaintHistoryItem[] = [
    ...complaint.history.slice(-19),
    {
      status: newStatus,
      note: noteText,
      actorName: adminName,
      timestamp: new Date().toISOString(),
    },
  ];

  const statusChanged = complaint.status !== newStatus;
  const notifTypeMap: Record<ComplaintStatus, NotificationType> = {
    Submitted: 'submitted',
    'Under Review': 'under_review',
    'In Progress': 'in_progress',
    Resolved: 'resolved',
  };
  const notifTitleMap: Record<ComplaintStatus, string> = {
    Submitted: 'Complaint Logged',
    'Under Review': 'Complaint Under Review',
    'In Progress': 'Maintenance Work In Progress',
    Resolved: 'Complaint Resolved',
  };

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'complaints', complaint.complaintId), {
      status: newStatus,
      priority: newPriority,
      adminRemarks: trimmedRemarks,
      history: updatedHistory,
      updatedAt: serverTimestamp(),
    });

    if (statusChanged || trimmedRemarks !== complaint.adminRemarks) {
      const notifId = generateSafeId('NTF_UPD');
      batch.set(doc(db, 'notifications', notifId), {
        recipientUid: complaint.studentUid,
        recipientRole: 'student',
        complaintId: complaint.complaintId,
        title: notifTitleMap[newStatus],
        message: trimmedRemarks
          ? `${complaint.complaintId} (${complaint.title}): ${trimmedRemarks}`
          : `${complaint.complaintId} (${complaint.title}) is now marked as ${newStatus}.`,
        type: notifTypeMap[newStatus],
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  // Update distributed counter shard if Resolved state transitioned to Resolved
  const wasResolved = complaint.status === 'Resolved';
  const isNowResolved = newStatus === 'Resolved';
  if (!wasResolved && isNowResolved) {
    try {
      await writeStatsShardIncrement({ totalResolved: 1 });
    } catch (error) {
      console.warn('Public stats resolve counter sync skipped:', error);
    }
  } else if (wasResolved && !isNowResolved) {
    try {
      for (let i = 0; i < STATS_SHARD_COUNT; i += 1) {
        const shardRef = doc(db, 'public_stats_shards', `shard_${i}`);
        const snap = await getDoc(shardRef);
        if (snap.exists() && Number(snap.data().totalResolved ?? 0) > 0) {
          await updateDoc(shardRef, {
            totalResolved: increment(-1),
            updatedAt: serverTimestamp(),
          });
          break;
        }
      }
    } catch (error) {
      console.warn('Public stats un-resolve sync skipped:', error);
    }
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(notifications: NotificationRecord[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    unread.slice(0, 400).forEach((item) => {
      batch.update(doc(db, 'notifications', item.id), { read: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function updateUserProfile(
  uid: string,
  updates: { fullName: string; studentId: string; department: string }
): Promise<void> {
  const path = `users/${uid}`;
  const fullName = updates.fullName.trim().slice(0, VALIDATION_LIMITS.fullName.max);
  if (fullName.length < VALIDATION_LIMITS.fullName.min) {
    throw new Error('Full name must be at least 2 characters.');
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName,
      studentId: updates.studentId.trim().slice(0, VALIDATION_LIMITS.studentId.max),
      department: updates.department.trim().slice(0, VALIDATION_LIMITS.department.max),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitContactMessage(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const id = generateSafeId('MSG');
  const path = `contact_messages/${id}`;
  try {
    await setDoc(doc(db, 'contact_messages', id), {
      name: payload.name.trim().slice(0, VALIDATION_LIMITS.fullName.max),
      email: payload.email.trim().slice(0, 150),
      subject: payload.subject.trim().slice(0, VALIDATION_LIMITS.contactSubject.max),
      message: payload.message.trim().slice(0, VALIDATION_LIMITS.contactMessage.max),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function mapComplaintDoc(docId: string, data: Record<string, unknown>): ComplaintRecord {
  return {
    complaintId: String(data.complaintId ?? docId),
    studentUid: String(data.studentUid ?? ''),
    studentName: String(data.studentName ?? 'Student'),
    studentEmail: String(data.studentEmail ?? ''),
    studentIdNumber: String(data.studentIdNumber ?? ''),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    category: (data.category as ComplaintCategory) ?? 'Other Issues',
    building: String(data.building ?? ''),
    location: String(data.location ?? ''),
    priority: (data.priority as ComplaintPriority) ?? 'Medium',
    imageUrl: String(data.imageUrl ?? ''),
    status: (data.status as ComplaintStatus) ?? 'Submitted',
    adminRemarks: String(data.adminRemarks ?? ''),
    history: Array.isArray(data.history) ? (data.history as ComplaintHistoryItem[]) : [],
    affectedStudentsCount:
      typeof data.affectedStudentsCount === 'number' ? data.affectedStudentsCount : undefined,
    affectedUsnRange: typeof data.affectedUsnRange === 'string' ? data.affectedUsnRange : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function registerCohortStudentMember(params: {
  fullName: string;
  studentId: string;
  email: string;
  department: string;
  password: string;
}): Promise<{ uid: string; email: string; studentId: string }> {
  const { secondaryAuth, secondaryDb } = await getSecondaryRegistrarServices();
  const cleanName = params.fullName.trim().slice(0, VALIDATION_LIMITS.fullName.max);
  const cleanUsn = params.studentId.trim().toUpperCase().slice(0, VALIDATION_LIMITS.studentId.max);
  const cleanEmail = params.email.trim();
  const cleanDept = params.department.trim().slice(0, VALIDATION_LIMITS.department.max);

  if (cleanName.length < VALIDATION_LIMITS.fullName.min) {
    throw new Error('Full name must be at least 2 characters.');
  }
  if (!cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, params.password);
  await secondaryUpdateProfile(cred.user, { displayName: cleanName });

  await setDoc(doc(secondaryDb, 'users', cred.user.uid), {
    uid: cred.user.uid,
    fullName: cleanName,
    studentId: cleanUsn,
    email: cleanEmail,
    department: cleanDept,
    role: 'student',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await sendEmailVerification(cred.user).catch(() => undefined);
  await writeStatsShardIncrement({ registeredStudents: 1 }, secondaryDb).catch(() => undefined);
  await secondarySignOut(secondaryAuth).catch(() => undefined);

  return {
    uid: cred.user.uid,
    email: cleanEmail,
    studentId: cleanUsn,
  };
}

export function subscribePublicStats(onData: (stats: PublicStats) => void): Unsubscribe {
  const shardTotals = new Map<
    string,
    { reported: number; resolved: number; students: number; updatedAt: Date | null }
  >();

  const emitAggregated = () => {
    let totalReported = 0;
    let totalResolved = 0;
    let registeredStudents = 0;
    let latestUpdated: Date | null = null;

    shardTotals.forEach((entry) => {
      totalReported += entry.reported;
      totalResolved += entry.resolved;
      registeredStudents += entry.students;
      if (entry.updatedAt && (!latestUpdated || entry.updatedAt > latestUpdated)) {
        latestUpdated = entry.updatedAt;
      }
    });

    onData({
      totalReported,
      totalResolved,
      activeRequests: Math.max(0, totalReported - totalResolved),
      registeredStudents: Math.min(500, registeredStudents),
      updatedAt: latestUpdated,
    });
  };

  const unsubs: Unsubscribe[] = [];

  // Listen to legacy baseline doc
  unsubs.push(
    onSnapshot(
      doc(db, 'public_stats', 'campus'),
      (snapshot) => {
        if (!snapshot.exists()) {
          shardTotals.delete('legacy');
        } else {
          const d = snapshot.data();
          shardTotals.set('legacy', {
            reported: Number(d.totalReported ?? 0),
            resolved: Number(d.totalResolved ?? 0),
            students: Number(d.registeredStudents ?? 0),
            updatedAt: toDate(d.updatedAt),
          });
        }
        emitAggregated();
      },
      (error) => {
        console.warn('Public stats listener error:', error.message);
      }
    )
  );

  // Listen to 20 distributed counter shards via single-doc get listeners (no list query needed)
  for (let i = 0; i < STATS_SHARD_COUNT; i += 1) {
    const key = `shard_${i}`;
    unsubs.push(
      onSnapshot(
        doc(db, 'public_stats_shards', key),
        (snapshot) => {
          if (!snapshot.exists()) {
            shardTotals.delete(key);
          } else {
            const d = snapshot.data();
            shardTotals.set(key, {
              reported: Number(d.totalReported ?? 0),
              resolved: Number(d.totalResolved ?? 0),
              students: Number(d.registeredStudents ?? 0),
              updatedAt: toDate(d.updatedAt),
            });
          }
          emitAggregated();
        },
        () => {
          // Shard doc not yet initialized is expected before first concurrent write
        }
      )
    );
  }

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

export function subscribeStudentComplaints(
  studentUid: string,
  onData: (complaints: ComplaintRecord[]) => void
): Unsubscribe {
  const path = 'complaints';
  const q = query(collection(db, path), where('studentUid', '==', studentUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapComplaintDoc(d.id, d.data()));
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllComplaints(
  onData: (complaints: ComplaintRecord[]) => void
): Unsubscribe {
  const path = 'complaints';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapComplaintDoc(d.id, d.data()));
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllUsers(onData: (users: UserProfile[]) => void): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: UserProfile[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          fullName: String(data.fullName ?? 'Campus User'),
          studentId: String(data.studentId ?? ''),
          email: String(data.email ?? ''),
          department: String(data.department ?? ''),
          role: data.role === 'admin' ? 'admin' : 'student',
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeStudentNotifications(
  studentUid: string,
  onData: (notifications: NotificationRecord[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('recipientUid', '==', studentUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          recipientUid: String(data.recipientUid ?? ''),
          recipientRole: data.recipientRole === 'admin' ? 'admin' : 'student',
          complaintId: String(data.complaintId ?? ''),
          title: String(data.title ?? ''),
          message: String(data.message ?? ''),
          type: (data.type as NotificationType) ?? 'submitted',
          read: Boolean(data.read),
          createdAt: toDate(data.createdAt),
        };
      });
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminNotifications(
  onData: (notifications: NotificationRecord[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('recipientRole', '==', 'admin'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          recipientUid: String(data.recipientUid ?? ''),
          recipientRole: 'admin',
          complaintId: String(data.complaintId ?? ''),
          title: String(data.title ?? ''),
          message: String(data.message ?? ''),
          type: (data.type as NotificationType) ?? 'new_complaint',
          read: Boolean(data.read),
          createdAt: toDate(data.createdAt),
        };
      });
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeContactMessages(
  onData: (messages: ContactMessageRecord[]) => void
): Unsubscribe {
  const path = 'contact_messages';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: ContactMessageRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? ''),
          email: String(data.email ?? ''),
          subject: String(data.subject ?? ''),
          message: String(data.message ?? ''),
          createdAt: toDate(data.createdAt),
        };
      });
      items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
