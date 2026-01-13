export enum UserRole {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN'
}

export type Language = 'en' | 'vi';

export enum StageType {
  EMPATHIZE = 'EMPATHIZE',
  DEFINE = 'DEFINE',
  IDEATE = 'IDEATE',
  PROTOTYPE = 'PROTOTYPE',
  TEST = 'TEST',
  IMPLEMENT = 'IMPLEMENT'
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  text?: string;
  color: string;
}

export interface FileAsset {
  id: string;
  name: string;
  url: string; // Base64 or Object URL
  type: 'image' | 'pdf' | 'doc';
  annotations: Annotation[]; // Instructor marks
}

export interface SubmissionOption {
  id: string;
  title: string;
  description: string;
  assets: FileAsset[];
  isSelected: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface StageData {
  type: StageType;
  status: 'LOCKED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  options: SubmissionOption[];
  checklists: ChecklistItem[];
  instructorFeedback: string;
  score: number; // 0-10
  weight: number; // 0-100 (percentage)
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  studentId: string; // 10 digits
  avatar?: string;
  isOnline: boolean;
  lastActive: string;
}

export interface Project {
  id: string;
  title: string;
  studentId: string; // Links to UserProfile
  studentName: string; // Denormalized for display
  groupName?: string;
  classId: string;
  isActive: boolean; // Admin can stop
  stages: Record<StageType, StageData>;
  totalScore: number;
  createdAt: string;
}

export const INITIAL_WEIGHTS: Record<StageType, number> = {
  [StageType.EMPATHIZE]: 15,
  [StageType.DEFINE]: 15,
  [StageType.IDEATE]: 20,
  [StageType.PROTOTYPE]: 25,
  [StageType.TEST]: 15,
  [StageType.IMPLEMENT]: 10,
};