import type { AuthResponse, QuestionListResponse, ResumeListItem, ResumeUploadResponse, User } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function token() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("echomind-token");
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "网络请求失败" }));
    throw new ApiError(response.status, error.detail || "请求失败");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const currentToken = token();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

export const api = {
  register: (payload: { username: string; password: string; email?: string }) =>
    request<AuthResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<User>("/api/v1/auth/me"),
  listResumes: () => request<ResumeListItem[]>("/api/v1/resumes"),
  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<ResumeUploadResponse>("/api/v1/resumes/upload", { method: "POST", body: formData });
  },
  generateQuestions: (resumeId: string) =>
    request<QuestionListResponse>(`/api/v1/resumes/${resumeId}/questions/generate`, { method: "POST" }),
  getQuestions: (resumeId: string) => request<QuestionListResponse>(`/api/v1/resumes/${resumeId}/questions`),
  deleteResume: (resumeId: string) => request<void>(`/api/v1/resumes/${resumeId}`, { method: "DELETE" }),
  processGuestResume: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<QuestionListResponse>("/api/v1/resumes/guest/process", { method: "POST", body: formData });
  },
};
