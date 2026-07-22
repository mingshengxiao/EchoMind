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


class QuestionBankTopicResponse(BaseModel):
    id: str
    name: str
    question_count: int


class QuestionBankItemResponse(BaseModel):
    id: str
    topic: str
    question_text: str
    reference_answer: str
    difficulty: str
    tags: list[str]
    source_file: str
    created_at: datetime


class UserProgressResponse(BaseModel):
    is_bookmarked: bool
    is_mastered: bool
    is_review: bool
    user_answer: str
    answered_at: datetime | None = None


class QuestionBankDetailResponse(QuestionBankItemResponse):
    user_progress: UserProgressResponse | None = None


class QuestionBankListResponse(BaseModel):
    items: list[QuestionBankDetailResponse]
    total: int
    page: int
    size: int


class ProgressStatsResponse(BaseModel):
    bookmarked: int = 0
    mastered: int = 0
    review: int = 0
    answered: int = 0
    total: int = 0


class ToggleActionResponse(BaseModel):
    success: bool = True
    new_value: bool


class SaveAnswerRequest(BaseModel):
    answer: str


class HealthResponse(BaseModel):
    status: str
    repository: str


class SkillModuleResponse(BaseModel):
    id: str
    module_type: str
    name: str
    icon: str
    skill_count: int
    trend: float
    updated_at: datetime


class SkillDataResponse(BaseModel):
    id: str
    skill_name: str
    category: str
    demand_count: int
    trend: float
    rank: int


class WordCloudDataResponse(BaseModel):
    modules: list[SkillModuleResponse]
    skills: list[SkillDataResponse]
    module_type: str
    updated_at: datetime


class RefreshWordCloudRequest(BaseModel):
    module_type: str = Field(description="要刷新的模块类型：frontend/backend/ai/mobile/devops/data")


class RefreshWordCloudResponse(BaseModel):
    success: bool
    module_type: str
    skill_count: int
    message: str
