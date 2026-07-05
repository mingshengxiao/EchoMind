from abc import ABC, abstractmethod

from app.models.domain import (
    InterviewQuestion,
    QuestionBankItem,
    QuestionBankTopic,
    Resume,
    User,
    UserQuestionProgress,
)


class AbstractRepository(ABC):
    name = "abstract"

    async def connect(self) -> None:
        return None

    async def close(self) -> None:
        return None

    @abstractmethod
    async def create_user(self, user: User) -> User:
        raise NotImplementedError

    @abstractmethod
    async def get_user_by_username(self, username: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    async def get_user_by_id(self, user_id: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    async def create_resume(self, resume: Resume) -> Resume:
        raise NotImplementedError

    @abstractmethod
    async def get_resumes_by_user(self, user_id: str) -> list[Resume]:
        raise NotImplementedError

    @abstractmethod
    async def get_resume_by_id(self, resume_id: str) -> Resume | None:
        raise NotImplementedError

    @abstractmethod
    async def delete_resume(self, resume_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def save_questions(self, resume_id: str, questions: list[InterviewQuestion]) -> list[InterviewQuestion]:
        raise NotImplementedError

    @abstractmethod
    async def get_questions_by_resume(self, resume_id: str) -> list[InterviewQuestion]:
        raise NotImplementedError

    # ── Question Bank ──────────────────────────────────────────

    @abstractmethod
    async def get_question_bank_topics(self) -> list[QuestionBankTopic]:
        raise NotImplementedError

    @abstractmethod
    async def save_question_bank_topics(self, topics: list[QuestionBankTopic]) -> list[QuestionBankTopic]:
        raise NotImplementedError

    @abstractmethod
    async def get_or_create_topic(self, name: str) -> QuestionBankTopic:
        raise NotImplementedError

    @abstractmethod
    async def save_question_bank_items(self, items: list[QuestionBankItem]) -> list[QuestionBankItem]:
        raise NotImplementedError

    @abstractmethod
    async def get_question_bank_items(
        self,
        topic: str | None = None,
        difficulty: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[QuestionBankItem], int]:
        raise NotImplementedError

    @abstractmethod
    async def get_question_bank_item_by_id(self, item_id: str) -> QuestionBankItem | None:
        raise NotImplementedError

    @abstractmethod
    async def get_user_progress(self, user_id: str, question_id: str) -> UserQuestionProgress | None:
        raise NotImplementedError

    @abstractmethod
    async def upsert_user_progress(self, progress: UserQuestionProgress) -> UserQuestionProgress:
        raise NotImplementedError

    @abstractmethod
    async def get_user_progress_stats(self, user_id: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def get_user_progress_batch(
        self, user_id: str, question_ids: list[str]
    ) -> dict[str, UserQuestionProgress]:
        raise NotImplementedError
