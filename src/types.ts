import { Timestamp } from 'firebase/firestore';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'operator';
  createdAt: Timestamp;
}

export interface Cluster {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  requiresAttachment?: boolean;
}

export interface Vocation {
  id: string;
  name: string;
  instructors: string[];
}

export interface Student {
  id: string;
  name: string;
  vocation?: string;
  clusters?: string[];
  enrollmentDate: Timestamp;
  photoUrl?: string;
  createdAt: Timestamp;
}

export interface Activity {
  id: string;
  studentId: string;
  date: Timestamp;
  category: string;
  classActivity: string;
  results: string;
  score?: number;
  createdBy?: string;
  createdByName?: string;
  attachment?: {
    name: string;
    type: string;
    base64: string;
    driveFileId?: string;
    driveViewLink?: string;
    backupDriveId?: string;
    backupDriveLink?: string;
  };
  attachments?: {
    name: string;
    type: string;
    base64: string;
    driveFileId?: string;
    driveViewLink?: string;
    backupDriveId?: string;
    backupDriveLink?: string;
  }[];
  createdAt: Timestamp;
}
