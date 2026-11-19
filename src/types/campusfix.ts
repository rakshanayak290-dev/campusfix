export type UserRole = 'student' | 'admin';

export type ComplaintCategory =
  | 'Electricity'
  | 'Water Supply'
  | 'Classroom Maintenance'
  | 'Washroom Cleanliness'
  | 'Internet Connectivity'
  | 'Furniture Damage'
  | 'Campus Cleanliness'
  | 'Other Issues';

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ComplaintStatus = 'Submitted' | 'Under Review' | 'In Progress' | 'Resolved';

export type NotificationType =
  | 'submitted'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'new_complaint';

export interface UserProfile {
  uid: string;
  fullName: string;
  studentId: string;
  email: string;
  department: string;
  role: UserRole;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ComplaintHistoryItem {
  status: ComplaintStatus;
  note: string;
  actorName: string;
  timestamp: string;
}

export interface ComplaintRecord {
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
  status: ComplaintStatus;
  adminRemarks: string;
  history: ComplaintHistoryItem[];
  affectedStudentsCount?: number;
  affectedUsnRange?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface NotificationRecord {
  id: string;
  recipientUid: string;
  recipientRole: UserRole;
  complaintId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date | null;
}

export interface PublicStats {
  totalReported: number;
  totalResolved: number;
  activeRequests: number;
  registeredStudents?: number;
  updatedAt: Date | null;
}

export const MAX_STUDENT_COHORT_CAPACITY = 500;
export const STATS_SHARD_COUNT = 20;

export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: Date | null;
}

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'Electricity',
  'Water Supply',
  'Classroom Maintenance',
  'Washroom Cleanliness',
  'Internet Connectivity',
  'Furniture Damage',
  'Campus Cleanliness',
  'Other Issues',
];

export const COMPLAINT_PRIORITIES: ComplaintPriority[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'In Progress',
  'Resolved',
];

export const CAMPUS_BUILDINGS: string[] = [
  'AIET Main Engineering Block',
  'Computer Science & Engineering Block',
  'Information Science & AI/ML Wing',
  'Central Library & Digital Resource Center',
  'Electronics & Communication Block',
  'Mechanical & Robotics Workshop',
  'Shobhavana Auditorium & Seminar Hall',
  'AIET Boys Hostel',
  'AIET Girls Hostel',
  'Campus Cafeteria & Food Court',
  'Shobhavana Campus Grounds & Walkways',
];

export const DEPARTMENTS: string[] = [
  'Computer Science & Engineering (CSE)',
  'Information Science & Engineering (ISE)',
  'Artificial Intelligence & Machine Learning (AIML)',
  'Computer Science & Design (CSD)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CV)',
  'Agriculture Engineering (AG)',
];

export const VALIDATION_LIMITS = {
  fullName: { min: 2, max: 100 },
  studentId: { min: 0, max: 40 },
  department: { min: 0, max: 80 },
  title: { min: 4, max: 140 },
  description: { min: 10, max: 2000 },
  building: { min: 2, max: 100 },
  location: { min: 2, max: 140 },
  adminRemarks: { min: 0, max: 1000 },
  affectedUsnRange: { min: 0, max: 80 },
  affectedStudentsCount: { min: 1, max: 500 },
  contactSubject: { min: 2, max: 140 },
  contactMessage: { min: 10, max: 1500 },
  idPattern: /^[a-zA-Z0-9_-]+$/,
} as const;
