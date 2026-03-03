
export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedScreens: string[];
}

export type QuestionType = 'TEXT' | 'NUMBER' | 'YES_NO' | 'IMAGE' | 'DOCUMENT' | 'SIGNATURE' | 'DATE' | 'MULTIPLE_CHOICE';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; 
  allowImage?: boolean; 
  allowNote?: boolean;  
  autoFill?: boolean;   
  defaultValue?: any;   
}

export interface Stage {
  id: string;
  name: string;
  questions: Question[];
  videos: string[]; 
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  stages: Stage[];
  signatureTitle: string;
  customIdPlaceholder?: string;
  image?: string; 
}

export interface ChecklistResponse {
  id: string;
  templateId: string;
  customId: string; 
  status: 'DRAFT' | 'COMPLETED';
  currentStageId: string;
  data: Record<string, any>; 
  stageTimeSpent?: Record<string, number>; 
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  pdfUrl?: string; 
}
