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

// ── Questions Bank ──────────────────────────────────────────

export interface QuestionBankTopic {
  id: string;
  name: string;
  question_count: number;
}

export interface QuestionBankItem {
  id: string;
  topic: string;
  question_text: string;
  reference_answer: string;
  difficulty: string;
  tags: string[];
  source_file: string;
  created_at: string;
}

export interface UserProgressState {
  is_bookmarked: boolean;
  is_mastered: boolean;
  is_review: boolean;
  user_answer: string;
  answered_at: string | null;
}

export interface QuestionBankDetail extends QuestionBankItem {
  user_progress?: UserProgressState;
}

export interface QuestionBankListResponse {
  items: QuestionBankDetail[];
  total: number;
  page: number;
  size: number;
}

export interface ProgressStats {
  bookmarked: number;
  mastered: number;
  review: number;
  answered: number;
  total: number;
}

// SSE stream event types
export type SSEEventType = "question" | "progress" | "done" | "error";

export interface SSEQuestionEvent {
  type: "question";
  data: Question;
}

export interface SSEProgressEvent {
  type: "progress";
  data: { generated: number; total: number };
}

export interface SSEDoneEvent {
  type: "done";
  data: { total: number; source: "deepseek" | "mock" };
}

export interface SSEErrorEvent {
  type: "error";
  data: { message: string };
}

export type SSEEvent = SSEQuestionEvent | SSEProgressEvent | SSEDoneEvent | SSEErrorEvent;
