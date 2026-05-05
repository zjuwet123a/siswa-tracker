import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  enrollmentDate: Timestamp;
  createdAt: Timestamp;
}

export type UnderstandingStatus = 'Paham' | 'Butuh Review';

export interface Activity {
  id: string;
  studentId: string;
  date: Timestamp;
  subject: string;
  summary: string;
  status: UnderstandingStatus;
  createdAt: Timestamp;
}
