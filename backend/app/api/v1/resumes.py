from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status

from app.config import Settings, get_settings
from app.db.repository import AbstractRepository
from app.models.domain import InterviewQuestion, Resume, User
from app.models.schemas import (
    QuestionListResponse,
    QuestionResponse,
    ResumeDetail,
    ResumeListItem,
    ResumeUploadResponse,
)
from app.services.generator import generate_questions
from app.services.parser import parse_upload
from app.services.security import get_current_user

router = APIRouter(prefix="/resumes", tags=["resumes"])


def to_question_response(question: InterviewQuestion) -> QuestionResponse:
    return QuestionResponse(
        id=question.id,
        question_text=question.question_text,
        category=question.category,
        difficulty=question.difficulty,
        focus_area=question.focus_area,
        reference_answer=question.reference_answer,
    )


async def _ensure_owner(repository: AbstractRepository, resume_id: str, user: User) -> Resume:
    resume = await repository.get_resume_by_id(resume_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    if resume.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this resume")
    return resume


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    request: Request,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ResumeUploadResponse:
    repository: AbstractRepository = request.app.state.repository
    parsed = await parse_upload(file, settings)
    resume = Resume(
        user_id=current_user.id,
        filename=parsed.filename,
        file_size=parsed.file_size,
        content_text=parsed.text,
        content_preview=parsed.preview,
        word_count=parsed.word_count,
    )
    created = await repository.create_resume(resume)
    return ResumeUploadResponse(
        id=created.id,
        filename=created.filename,
        file_size=created.file_size,
        word_count=created.word_count,
        uploaded_at=created.uploaded_at,
    )


@router.get("", response_model=list[ResumeListItem])
async def list_resumes(request: Request, current_user: User = Depends(get_current_user)) -> list[ResumeListItem]:
    repository: AbstractRepository = request.app.state.repository
    resumes = await repository.get_resumes_by_user(current_user.id)
    items: list[ResumeListItem] = []
    for resume in resumes:
        question_count = len(await repository.get_questions_by_resume(resume.id))
        items.append(
            ResumeListItem(
                id=resume.id,
                filename=resume.filename,
                file_size=resume.file_size,
                word_count=resume.word_count,
                uploaded_at=resume.uploaded_at,
                question_count=question_count,
            )
        )
    return items


@router.get("/{resume_id}", response_model=ResumeDetail)
async def get_resume(request: Request, resume_id: str, current_user: User = Depends(get_current_user)) -> ResumeDetail:
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)
    return ResumeDetail(
        id=resume.id,
        filename=resume.filename,
        file_size=resume.file_size,
        word_count=resume.word_count,
        content_preview=resume.content_preview,
        uploaded_at=resume.uploaded_at,
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(request: Request, resume_id: str, current_user: User = Depends(get_current_user)) -> None:
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)
    await repository.delete_resume(resume.id)


@router.post("/{resume_id}/questions/generate", response_model=QuestionListResponse)
async def generate_resume_questions(
    request: Request,
    resume_id: str,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> QuestionListResponse:
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)
    result = await generate_questions(resume.content_text, settings)
    questions = [question.model_copy(update={"resume_id": resume.id}) for question in result.questions]
    saved_questions = await repository.save_questions(resume.id, questions)
    return QuestionListResponse(
        questions=[to_question_response(question) for question in saved_questions],
        total=len(saved_questions),
        source=result.source,
    )


@router.get("/{resume_id}/questions", response_model=QuestionListResponse)
async def get_resume_questions(
    request: Request,
    resume_id: str,
    current_user: User = Depends(get_current_user),
) -> QuestionListResponse:
    repository: AbstractRepository = request.app.state.repository
    await _ensure_owner(repository, resume_id, current_user)
    questions = await repository.get_questions_by_resume(resume_id)
    return QuestionListResponse(
        questions=[to_question_response(question) for question in questions],
        total=len(questions),
        source="mock",
    )


@router.post("/guest/process", response_model=QuestionListResponse)
async def process_guest_resume(file: UploadFile, settings: Settings = Depends(get_settings)) -> QuestionListResponse:
    parsed = await parse_upload(file, settings)
    result = await generate_questions(parsed.text, settings)
    return QuestionListResponse(
        questions=[to_question_response(question) for question in result.questions],
        total=len(result.questions),
        source=result.source,
    )
