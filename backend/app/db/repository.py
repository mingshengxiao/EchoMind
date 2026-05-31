from abc import ABC, abstractmethod

from app.models.domain import InterviewQuestion, Resume, User


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
