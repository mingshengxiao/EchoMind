from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


QuestionCategory = Literal["technical", "behavioral", "project", "experience", "scenario"]
QuestionDifficulty = Literal["junior", "mid", "senior"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid4().hex


class User(BaseModel):
    id: str = Field(default_factory=new_id)
    username: str
    email: str | None = None
    hashed_password: str
    created_at: datetime = Field(default_factory=utc_now)


class Resume(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    original_filename: str = ""
    filename: str
    file_size: int
    file_data: bytes = b""
    file_mime: str = ""
    content_text: str
    content_preview: str
    word_count: int
    uploaded_at: datetime = Field(default_factory=utc_now)


class InterviewQuestion(BaseModel):
    id: str = Field(default_factory=new_id)
    resume_id: str | None = None
    question_text: str
    category: QuestionCategory = "technical"
    difficulty: QuestionDifficulty = "mid"
    focus_area: str = "resume"
    reference_answer: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class QuestionBankTopic(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    question_count: int = 0
    created_at: datetime = Field(default_factory=utc_now)


class QuestionBankItem(BaseModel):
    id: str = Field(default_factory=new_id)
    topic: str
    question_text: str
    reference_answer: str = ""
    difficulty: QuestionDifficulty = "mid"
    tags: list[str] = []
    source_file: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class UserQuestionProgress(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    question_id: str
    is_bookmarked: bool = False
    is_mastered: bool = False
    is_review: bool = False
    user_answer: str = ""
    answered_at: datetime | None = None
    updated_at: datetime = Field(default_factory=utc_now)


class GeneratedQuestion(BaseModel):
    question_text: str = Field(description="The full interview question text")
    category: QuestionCategory = Field(description="technical | behavioral | project | experience | scenario")
    difficulty: QuestionDifficulty = Field(description="junior | mid | senior")
    focus_area: str = Field(description="The resume skill, project, or experience this question examines")
    reference_answer: str = Field(default="", description="A concise reference answer grounded in the resume")


class GeneratedQuestionList(BaseModel):
    questions: list[GeneratedQuestion] = Field(description="A list of 50 to 100 interview questions")


SkillModuleType = Literal["frontend", "backend", "ai", "mobile", "devops", "data"]


class SkillModule(BaseModel):
    id: str = Field(default_factory=new_id)
    module_type: SkillModuleType
    name: str
    icon: str = ""
    skill_count: int = 0
    trend: float = 0.0
    updated_at: datetime = Field(default_factory=utc_now)


class SkillData(BaseModel):
    id: str = Field(default_factory=new_id)
    module_type: SkillModuleType
    skill_name: str
    category: str = ""
    demand_count: int = 0
    trend: float = 0.0
    rank: int = 0
    updated_at: datetime = Field(default_factory=utc_now)
