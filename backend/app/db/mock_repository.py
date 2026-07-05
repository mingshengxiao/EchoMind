import asyncio

from app.db.repository import AbstractRepository
from app.models.domain import (
    InterviewQuestion,
    QuestionBankItem,
    QuestionBankTopic,
    Resume,
    User,
    UserQuestionProgress,
    utc_now,
)


class MockRepository(AbstractRepository):
    name = "mock"

    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._resumes: dict[str, Resume] = {}
        self._questions: dict[str, list[InterviewQuestion]] = {}
        self._question_bank_topics: dict[str, QuestionBankTopic] = {}  # key: name
        self._question_bank_items: dict[str, QuestionBankItem] = {}  # key: id
        self._user_progress: dict[str, UserQuestionProgress] = {}  # key: f"{user_id}:{question_id}"
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

    async def get_question_bank_topics(self) -> list[QuestionBankTopic]:
        return list(self._question_bank_topics.values())

    async def save_question_bank_topics(self, topics: list[QuestionBankTopic]) -> list[QuestionBankTopic]:
        async with self._lock:
            for topic in topics:
                self._question_bank_topics[topic.name] = topic
        return topics

    async def get_or_create_topic(self, name: str) -> QuestionBankTopic:
        if name in self._question_bank_topics:
            return self._question_bank_topics[name]
        topic = QuestionBankTopic(name=name)
        async with self._lock:
            self._question_bank_topics[name] = topic
        return topic

    async def save_question_bank_items(self, items: list[QuestionBankItem]) -> list[QuestionBankItem]:
        async with self._lock:
            for item in items:
                self._question_bank_items[item.id] = item
        return items

    async def get_question_bank_items(
        self,
        topic: str | None = None,
        difficulty: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[QuestionBankItem], int]:
        items = list(self._question_bank_items.values())

        if topic:
            items = [item for item in items if item.topic == topic]
        if difficulty:
            items = [item for item in items if item.difficulty == difficulty]
        if search:
            search_lower = search.lower()
            items = [
                item
                for item in items
                if search_lower in item.question_text.lower()
                or search_lower in item.reference_answer.lower()
            ]

        items.sort(key=lambda item: item.created_at, reverse=True)
        total = len(items)
        start = (page - 1) * size
        end = start + size
        return items[start:end], total

    async def get_question_bank_item_by_id(self, item_id: str) -> QuestionBankItem | None:
        return self._question_bank_items.get(item_id)

    async def get_user_progress(self, user_id: str, question_id: str) -> UserQuestionProgress | None:
        return self._user_progress.get(f"{user_id}:{question_id}")

    async def upsert_user_progress(self, progress: UserQuestionProgress) -> UserQuestionProgress:
        async with self._lock:
            key = f"{progress.user_id}:{progress.question_id}"
            progress.updated_at = utc_now()
            self._user_progress[key] = progress
        return progress

    async def get_user_progress_stats(self, user_id: str) -> dict:
        stats = {"bookmarked": 0, "mastered": 0, "review": 0, "answered": 0, "total": 0}
        for key, prog in self._user_progress.items():
            if key.startswith(f"{user_id}:"):
                stats["total"] += 1
                if prog.is_bookmarked:
                    stats["bookmarked"] += 1
                if prog.is_mastered:
                    stats["mastered"] += 1
                if prog.is_review:
                    stats["review"] += 1
                if prog.answered_at:
                    stats["answered"] += 1
        return stats

    async def get_user_progress_batch(
        self, user_id: str, question_ids: list[str]
    ) -> dict[str, UserQuestionProgress]:
        result: dict[str, UserQuestionProgress] = {}
        for qid in question_ids:
            prog = self._user_progress.get(f"{user_id}:{qid}")
            if prog:
                result[qid] = prog
        return result
