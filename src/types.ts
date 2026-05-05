import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  enrollmentDate: Timestamp;
  createdAt: Timestamp;
}

export interface Activity {
  id: string;
  studentId: string;
  date: Timestamp;
  classActivity: string;
  results: string;
  createdAt: Timestamp;
}
