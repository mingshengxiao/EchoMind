from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.db.repository import AbstractRepository
from app.models.domain import QuestionBankItem, User, UserQuestionProgress, utc_now
from app.models.schemas import (
    ProgressStatsResponse,
    QuestionBankDetailResponse,
    QuestionBankListResponse,
    QuestionBankTopicResponse,
    SaveAnswerRequest,
    ToggleActionResponse,
    UserProgressResponse,
)
from app.services.security import get_current_user, get_optional_user

router = APIRouter(prefix="/questions-bank", tags=["questions-bank"])


def _topic_to_response(topic) -> QuestionBankTopicResponse:
    return QuestionBankTopicResponse(
        id=topic.id, name=topic.name, question_count=topic.question_count
    )


def _item_to_response(item: QuestionBankItem) -> QuestionBankDetailResponse:
    return QuestionBankDetailResponse(
        id=item.id,
        topic=item.topic,
        question_text=item.question_text,
        reference_answer=item.reference_answer,
        difficulty=item.difficulty,
        tags=item.tags,
        source_file=item.source_file,
        created_at=item.created_at,
    )


async def _attach_progress(
    repository: AbstractRepository,
    items: list[QuestionBankDetailResponse],
    user: User | None,
) -> list[QuestionBankDetailResponse]:
    """Attach user progress to each item if user is authenticated."""
    if not user:
        return items
    question_ids = [item.id for item in items]
    progress_map = await repository.get_user_progress_batch(user.id, question_ids)
    for item in items:
        prog = progress_map.get(item.id)
        if prog:
            item.user_progress = UserProgressResponse(
                is_bookmarked=prog.is_bookmarked,
                is_mastered=prog.is_mastered,
                is_review=prog.is_review,
                user_answer=prog.user_answer,
                answered_at=prog.answered_at,
            )
    return items


@router.get("/topics", response_model=list[QuestionBankTopicResponse])
async def list_topics(request: Request) -> list[QuestionBankTopicResponse]:
    """Get all topics with question counts. Public access."""
    repository: AbstractRepository = request.app.state.repository
    topics = await repository.get_question_bank_topics()
    return [_topic_to_response(t) for t in topics]


@router.get("/questions", response_model=QuestionBankListResponse)
async def list_questions(
    request: Request,
    topic: str | None = Query(None, description="Filter by topic name"),
    difficulty: str | None = Query(None, description="Filter by difficulty"),
    search: str | None = Query(None, description="Full-text search"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_user),
) -> QuestionBankListResponse:
    """List questions with optional filters. Public access."""
    repository: AbstractRepository = request.app.state.repository
    items, total = await repository.get_question_bank_items(
        topic=topic, difficulty=difficulty, search=search, page=page, size=size
    )
    response_items = [_item_to_response(item) for item in items]
    response_items = await _attach_progress(repository, response_items, current_user)
    return QuestionBankListResponse(items=response_items, total=total, page=page, size=size)


@router.get("/questions/{question_id}", response_model=QuestionBankDetailResponse)
async def get_question(
    request: Request,
    question_id: str,
    current_user: User | None = Depends(get_optional_user),
) -> QuestionBankDetailResponse:
    """Get a single question by ID. Public access."""
    repository: AbstractRepository = request.app.state.repository
    item = await repository.get_question_bank_item_by_id(question_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    result = _item_to_response(item)
    if current_user:
        prog = await repository.get_user_progress(current_user.id, question_id)
        if prog:
            result.user_progress = UserProgressResponse(
                is_bookmarked=prog.is_bookmarked,
                is_mastered=prog.is_mastered,
                is_review=prog.is_review,
                user_answer=prog.user_answer,
                answered_at=prog.answered_at,
            )
    return result


@router.post("/questions/{question_id}/bookmark", response_model=ToggleActionResponse)
async def toggle_bookmark(
    request: Request,
    question_id: str,
    current_user: User = Depends(get_current_user),
) -> ToggleActionResponse:
    """Toggle bookmark status. Requires authentication."""
    repository: AbstractRepository = request.app.state.repository
    item = await repository.get_question_bank_item_by_id(question_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    prog = await repository.get_user_progress(current_user.id, question_id)
    if prog:
        prog.is_bookmarked = not prog.is_bookmarked
    else:
        prog = UserQuestionProgress(
            user_id=current_user.id, question_id=question_id, is_bookmarked=True
        )
    await repository.upsert_user_progress(prog)
    return ToggleActionResponse(success=True, new_value=prog.is_bookmarked)


@router.post("/questions/{question_id}/master", response_model=ToggleActionResponse)
async def toggle_mastered(
    request: Request,
    question_id: str,
    current_user: User = Depends(get_current_user),
) -> ToggleActionResponse:
    """Toggle mastered status. Requires authentication."""
    repository: AbstractRepository = request.app.state.repository
    item = await repository.get_question_bank_item_by_id(question_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    prog = await repository.get_user_progress(current_user.id, question_id)
    if prog:
        prog.is_mastered = not prog.is_mastered
    else:
        prog = UserQuestionProgress(
            user_id=current_user.id, question_id=question_id, is_mastered=True
        )
    await repository.upsert_user_progress(prog)
    return ToggleActionResponse(success=True, new_value=prog.is_mastered)


@router.post("/questions/{question_id}/review", response_model=ToggleActionResponse)
async def toggle_review(
    request: Request,
    question_id: str,
    current_user: User = Depends(get_current_user),
) -> ToggleActionResponse:
    """Toggle review-flag status. Requires authentication."""
    repository: AbstractRepository = request.app.state.repository
    item = await repository.get_question_bank_item_by_id(question_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    prog = await repository.get_user_progress(current_user.id, question_id)
    if prog:
        prog.is_review = not prog.is_review
    else:
        prog = UserQuestionProgress(
            user_id=current_user.id, question_id=question_id, is_review=True
        )
    await repository.upsert_user_progress(prog)
    return ToggleActionResponse(success=True, new_value=prog.is_review)


@router.post("/questions/{question_id}/answer", response_model=ToggleActionResponse)
async def save_answer(
    request: Request,
    question_id: str,
    payload: SaveAnswerRequest,
    current_user: User = Depends(get_current_user),
) -> ToggleActionResponse:
    """Save user's answer. Requires authentication."""
    repository: AbstractRepository = request.app.state.repository
    item = await repository.get_question_bank_item_by_id(question_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    prog = await repository.get_user_progress(current_user.id, question_id)
    if prog:
        prog.user_answer = payload.answer
        prog.answered_at = utc_now()
    else:
        prog = UserQuestionProgress(
            user_id=current_user.id,
            question_id=question_id,
            user_answer=payload.answer,
            answered_at=utc_now(),
        )
    await repository.upsert_user_progress(prog)
    return ToggleActionResponse(success=True, new_value=True)


@router.get("/progress", response_model=ProgressStatsResponse)
async def get_progress(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ProgressStatsResponse:
    """Get current user's progress stats. Requires authentication."""
    repository: AbstractRepository = request.app.state.repository
    stats = await repository.get_user_progress_stats(current_user.id)
    return ProgressStatsResponse(**stats)
