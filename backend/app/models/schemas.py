from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)
    email: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: str
    username: str
    email: str | None = None
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ResumeUploadResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    word_count: int
    uploaded_at: datetime


class ResumeListItem(BaseModel):
    id: str
    filename: str
    file_size: int
    word_count: int
    uploaded_at: datetime
    question_count: int = 0


class ResumeDetail(BaseModel):
    id: str
    filename: str
    file_size: int
    word_count: int
    content_preview: str
    uploaded_at: datetime


class QuestionResponse(BaseModel):
    id: str
    question_text: str
    category: str
    difficulty: str
    focus_area: str
    reference_answer: str = ""


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int
    source: Literal["deepseek", "mock"] = "mock"


class HealthResponse(BaseModel):
    status: str
    repository: str
