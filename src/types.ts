
export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedScreens: string[];
  accessCode?: string;
}

export type QuestionType = 'TEXT' | 'NUMBER' | 'YES_NO' | 'IMAGE' | 'DOCUMENT' | 'SIGNATURE' | 'DATE' | 'MULTIPLE_CHOICE' | 'OS';

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

export interface ExternalDataRow {
  doca?: string;
  tipo_programa: string;
  os: string;
  veiculo?: string;
  data_inicio?: string;
  data_final?: string;
  cod_produto?: string;
  desc_produto?: string;
  cliente: string;
  cod_galpao?: string;
  desc_galpao?: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  stages: Stage[];
  signatureTitle: string;
  customIdPlaceholder?: string;
  image?: string; 
  externalData?: ExternalDataRow[];
  externalDataImportedAt?: string;
}

export interface ChecklistResponse {
  id: string;
  templateId: string;
  customId: string; 
  status: 'DRAFT' | 'COMPLETED';
  currentStageId: string;
  data: Record<string, any>; 
  stageTimeSpent?: Record<string, number>; 
  externalDataRow?: ExternalDataRow;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  pdfUrl?: string; 
}
