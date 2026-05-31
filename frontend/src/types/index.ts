export interface User {
  id: string;
  username: string;
  email?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface ResumeListItem {
  id: string;
  filename: string;
  file_size: number;
  word_count: number;
  uploaded_at: string;
  question_count: number;
}

export interface ResumeUploadResponse {
  id: string;
  filename: string;
  file_size: number;
  word_count: number;
  uploaded_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  category: string;
  difficulty: string;
  focus_area: string;
  reference_answer: string;
}

export interface QuestionListResponse {
  questions: Question[];
  total: number;
  source: "deepseek" | "mock";
}
