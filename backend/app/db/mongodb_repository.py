from bson import Binary
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.db.repository import AbstractRepository
from app.models.domain import InterviewQuestion, Resume, User


class MongoRepository(AbstractRepository):
    name = "mongodb"

    def __init__(self, mongodb_url: str, database_name: str) -> None:
        self.mongodb_url = mongodb_url
        self.database_name = database_name
        self.client: AsyncIOMotorClient | None = None
        self.db: AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(self.mongodb_url)
        self.db = self.client[self.database_name]
        await self.db.users.create_index("username", unique=True)
        await self.db.resumes.create_index("user_id")
        await self.db.questions.create_index("resume_id")

    async def close(self) -> None:
        if self.client is not None:
            self.client.close()

    def _database(self) -> AsyncIOMotorDatabase:
        if self.db is None:
            raise RuntimeError("MongoRepository is not connected")
        return self.db

    async def create_user(self, user: User) -> User:
        await self._database().users.insert_one(user.model_dump(mode="json"))
        return user

    async def get_user_by_username(self, username: str) -> User | None:
        document = await self._database().users.find_one({"username": username})
        return User(**document) if document else None

    async def get_user_by_id(self, user_id: str) -> User | None:
        document = await self._database().users.find_one({"id": user_id})
        return User(**document) if document else None

    async def create_resume(self, resume: Resume) -> Resume:
        doc = resume.model_dump()
        if resume.file_data:
            doc["file_data"] = Binary(resume.file_data)
        await self._database().resumes.insert_one(doc)
        return resume

    async def get_resumes_by_user(self, user_id: str) -> list[Resume]:
        cursor = self._database().resumes.find({"user_id": user_id}).sort("uploaded_at", -1)
        resumes = []
        async for doc in cursor:
            if isinstance(doc.get("file_data"), Binary):
                doc["file_data"] = bytes(doc["file_data"])
            resumes.append(Resume(**doc))
        return resumes

    async def get_resume_by_id(self, resume_id: str) -> Resume | None:
        doc = await self._database().resumes.find_one({"id": resume_id})
        if doc is None:
            return None
        if isinstance(doc.get("file_data"), Binary):
            doc["file_data"] = bytes(doc["file_data"])
        return Resume(**doc)

    async def delete_resume(self, resume_id: str) -> bool:
        result = await self._database().resumes.delete_one({"id": resume_id})
        await self._database().questions.delete_many({"resume_id": resume_id})
        return result.deleted_count > 0

    async def save_questions(self, resume_id: str, questions: list[InterviewQuestion]) -> list[InterviewQuestion]:
        await self._database().questions.delete_many({"resume_id": resume_id})
        if questions:
            await self._database().questions.insert_many([question.model_dump(mode="json") for question in questions])
        return questions

    async def get_questions_by_resume(self, resume_id: str) -> list[InterviewQuestion]:
        cursor = self._database().questions.find({"resume_id": resume_id}).sort("created_at", 1)
        return [InterviewQuestion(**document) async for document in cursor]
