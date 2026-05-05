import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  vocation?: string;
  enrollmentDate: Timestamp;
  photoUrl?: string;
  createdAt: Timestamp;
}

export interface Activity {
  id: string;
  studentId: string;
  date: Timestamp;
  category: 'Peksos' | 'Instruktur' | 'Psikolog' | 'Pengasuh' | 'Penyuluh';
  classActivity: string;
  results: string;
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
  createdAt: Timestamp;
}
