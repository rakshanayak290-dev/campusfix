/**
 * Adversarial Security Rules Test Suite for CampusFix ("Dirty Dozen" Verification).
 * Validates that every privilege escalation, identity spoof, shadow field,
 * status shortcut, and PII leak payload is rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list';
  actorRole: 'student' | 'other_student' | 'unverified_admin_spoof';
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Privilege Escalation',
    collection: 'users/student_1',
    operation: 'create',
    actorRole: 'student',
    payload: {
      uid: 'student_1',
      fullName: 'Alex Student',
      studentId: 'CS-2026-01',
      email: 'alex@university.edu',
      department: 'Computer Science',
      role: 'admin',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Student Role Mutation',
    collection: 'users/student_1',
    operation: 'update',
    actorRole: 'student',
    payload: { role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on User',
    collection: 'users/student_1',
    operation: 'create',
    actorRole: 'student',
    payload: {
      uid: 'student_1',
      fullName: 'Alex Student',
      studentId: 'CS-2026-01',
      email: 'alex@university.edu',
      department: 'Computer Science',
      role: 'student',
      isVerified: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User PII Read',
    collection: 'users/student_2',
    operation: 'get',
    actorRole: 'student',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Complaint Identity Spoofing',
    collection: 'complaints/CMP-2026-9999',
    operation: 'create',
    actorRole: 'student',
    payload: {
      complaintId: 'CMP-2026-9999',
      studentUid: 'student_2',
      status: 'Submitted',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Complaint Status Pre-Approval',
    collection: 'complaints/CMP-2026-9998',
    operation: 'create',
    actorRole: 'student',
    payload: {
      complaintId: 'CMP-2026-9998',
      studentUid: 'student_1',
      status: 'Resolved',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Student Status & Remarks Tampering',
    collection: 'complaints/CMP-2026-1001',
    operation: 'update',
    actorRole: 'student',
    payload: {
      status: 'Resolved',
      adminRemarks: 'Self-approved',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-Student Complaint Read',
    collection: 'complaints/CMP-2026-2002',
    operation: 'get',
    actorRole: 'other_student',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    collection: 'complaints/invalid$id*poison',
    operation: 'create',
    actorRole: 'student',
    payload: { complaintId: 'invalid$id*poison' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery',
    collection: 'complaints/CMP-2026-1003',
    operation: 'create',
    actorRole: 'student',
    payload: {
      complaintId: 'CMP-2026-1003',
      studentUid: 'student_1',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized Payload Denial-of-Wallet',
    collection: 'complaints/CMP-2026-1004',
    operation: 'create',
    actorRole: 'student',
    payload: {
      complaintId: 'CMP-2026-1004',
      description: 'X'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified Admin Email Spoof',
    collection: 'admins/spoof_uid',
    operation: 'create',
    actorRole: 'unverified_admin_spoof',
    payload: {
      uid: 'spoof_uid',
      email: 'rakshanayak290@gmail.com',
      fullName: 'Spoof Admin',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
