import asyncio

from app.db.repository import AbstractRepository
from app.models.domain import InterviewQuestion, Resume, User


class MockRepository(AbstractRepository):
    name = "mock"

    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._resumes: dict[str, Resume] = {}
        self._questions: dict[str, list[InterviewQuestion]] = {}
        self._lock = asyncio.Lock()

    async def create_user(self, user: User) -> User:
        async with self._lock:
            if user.username in self._users:
                raise ValueError("Username already exists")
            self._users[user.username] = user
        return user

    async def get_user_by_username(self, username: str) -> User | None:
        return self._users.get(username)

    async def get_user_by_id(self, user_id: str) -> User | None:
        for user in self._users.values():
            if user.id == user_id:
                return user
        return None

    async def create_resume(self, resume: Resume) -> Resume:
        async with self._lock:
            self._resumes[resume.id] = resume
        return resume

    async def get_resumes_by_user(self, user_id: str) -> list[Resume]:
        resumes = [resume for resume in self._resumes.values() if resume.user_id == user_id]
        return sorted(resumes, key=lambda resume: resume.uploaded_at, reverse=True)

    async def get_resume_by_id(self, resume_id: str) -> Resume | None:
        return self._resumes.get(resume_id)

    async def delete_resume(self, resume_id: str) -> bool:
        async with self._lock:
            existed = self._resumes.pop(resume_id, None) is not None
            self._questions.pop(resume_id, None)
        return existed

    async def save_questions(self, resume_id: str, questions: list[InterviewQuestion]) -> list[InterviewQuestion]:
        async with self._lock:
            self._questions[resume_id] = questions
        return questions

    async def get_questions_by_resume(self, resume_id: str) -> list[InterviewQuestion]:
        return self._questions.get(resume_id, [])
