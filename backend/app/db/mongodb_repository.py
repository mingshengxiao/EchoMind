from bson import Binary
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.db.repository import AbstractRepository
from app.models.domain import (
    InterviewQuestion,
    QuestionBankItem,
    QuestionBankTopic,
    Resume,
    SkillData,
    SkillModule,
    User,
    UserQuestionProgress,
)
from app.models.domain import utc_now


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
        await self.db.question_bank_topics.create_index("name", unique=True)
        await self.db.question_bank_items.create_index("topic")
        await self.db.question_bank_items.create_index("difficulty")
        await self.db.question_bank_items.create_index([("topic", 1), ("created_at", -1)])
        await self.db.question_bank_items.create_index([("question_text", "text"), ("reference_answer", "text")])
        await self.db.user_question_progress.create_index("user_id")
        await self.db.user_question_progress.create_index([("user_id", 1), ("question_id", 1)], unique=True)
        await self.db.skill_modules.create_index("module_type", unique=True)
        await self.db.skill_data.create_index("module_type")
        await self.db.skill_data.create_index([("module_type", 1), ("rank", 1)])

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

    # ── Question Bank ──────────────────────────────────────────

    async def get_question_bank_topics(self) -> list[QuestionBankTopic]:
        cursor = self._database().question_bank_topics.find().sort("name", 1)
        return [QuestionBankTopic(**doc) async for doc in cursor]

    async def save_question_bank_topics(self, topics: list[QuestionBankTopic]) -> list[QuestionBankTopic]:
        if not topics:
            return topics
        for topic in topics:
            await self._database().question_bank_topics.update_one(
                {"name": topic.name}, {"$set": topic.model_dump(mode="json")}, upsert=True
            )
        return topics

    async def get_or_create_topic(self, name: str) -> QuestionBankTopic:
        doc = await self._database().question_bank_topics.find_one({"name": name})
        if doc:
            return QuestionBankTopic(**doc)
        topic = QuestionBankTopic(name=name)
        await self._database().question_bank_topics.insert_one(topic.model_dump(mode="json"))
        return topic

    async def save_question_bank_items(self, items: list[QuestionBankItem]) -> list[QuestionBankItem]:
        if not items:
            return items
        dicts = [item.model_dump(mode="json") for item in items]
        await self._database().question_bank_items.insert_many(dicts)
        return items

    async def get_question_bank_items(
        self,
        topic: str | None = None,
        difficulty: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[QuestionBankItem], int]:
        db = self._database()
        query: dict = {}

        if topic:
            query["topic"] = topic
        if difficulty:
            query["difficulty"] = difficulty
        if search:
            query["$text"] = {"$search": search}

        cursor = db.question_bank_items.find(query).sort("created_at", -1)
        total = await db.question_bank_items.count_documents(query)
        skip = (page - 1) * size
        cursor = cursor.skip(skip).limit(size)
        items = [QuestionBankItem(**doc) async for doc in cursor]
        return items, total

    async def get_question_bank_item_by_id(self, item_id: str) -> QuestionBankItem | None:
        doc = await self._database().question_bank_items.find_one({"id": item_id})
        return QuestionBankItem(**doc) if doc else None

    async def get_user_progress(self, user_id: str, question_id: str) -> UserQuestionProgress | None:
        doc = await self._database().user_question_progress.find_one(
            {"user_id": user_id, "question_id": question_id}
        )
        return UserQuestionProgress(**doc) if doc else None

    async def upsert_user_progress(self, progress: UserQuestionProgress) -> UserQuestionProgress:
        progress.updated_at = utc_now()
        await self._database().user_question_progress.update_one(
            {"user_id": progress.user_id, "question_id": progress.question_id},
            {"$set": progress.model_dump(mode="json")},
            upsert=True,
        )
        return progress

    async def get_user_progress_stats(self, user_id: str) -> dict:
        db = self._database()
        pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": None,
                    "bookmarked": {"$sum": {"$cond": ["$is_bookmarked", 1, 0]}},
                    "mastered": {"$sum": {"$cond": ["$is_mastered", 1, 0]}},
                    "review": {"$sum": {"$cond": ["$is_review", 1, 0]}},
                    "answered": {"$sum": {"$cond": [{"$ifNull": ["$answered_at", None]}, 1, 0]}},
                    "total": {"$sum": 1},
                }
            },
        ]
        cursor = db.user_question_progress.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        if result:
            return {
                "bookmarked": result[0]["bookmarked"],
                "mastered": result[0]["mastered"],
                "review": result[0]["review"],
                "answered": result[0]["answered"],
                "total": result[0]["total"],
            }
        return {"bookmarked": 0, "mastered": 0, "review": 0, "answered": 0, "total": 0}

    async def get_user_progress_batch(
        self, user_id: str, question_ids: list[str]
    ) -> dict[str, UserQuestionProgress]:
        db = self._database()
        cursor = db.user_question_progress.find(
            {"user_id": user_id, "question_id": {"$in": question_ids}}
        )
        result: dict[str, UserQuestionProgress] = {}
        async for doc in cursor:
            prog = UserQuestionProgress(**doc)
            result[prog.question_id] = prog
        return result

    async def get_skill_modules(self) -> list[SkillModule]:
        cursor = self._database().skill_modules.find().sort("module_type", 1)
        return [SkillModule(**doc) async for doc in cursor]

    async def get_skill_module_by_type(self, module_type: str) -> SkillModule | None:
        doc = await self._database().skill_modules.find_one({"module_type": module_type})
        return SkillModule(**doc) if doc else None

    async def upsert_skill_module(self, module: SkillModule) -> SkillModule:
        module.updated_at = utc_now()
        await self._database().skill_modules.update_one(
            {"module_type": module.module_type},
            {"$set": module.model_dump(mode="json")},
            upsert=True,
        )
        return module

    async def get_skills_by_module(self, module_type: str) -> list[SkillData]:
        cursor = self._database().skill_data.find({"module_type": module_type}).sort("rank", 1)
        return [SkillData(**doc) async for doc in cursor]

    async def save_skills(self, skills: list[SkillData]) -> list[SkillData]:
        if not skills:
            return []
        module_type = skills[0].module_type
        now = utc_now()
        for skill in skills:
            skill.updated_at = now
        await self._database().skill_data.delete_many({"module_type": module_type})
        await self._database().skill_data.insert_many([skill.model_dump(mode="json") for skill in skills])
        return skills

    async def delete_skills_by_module(self, module_type: str) -> int:
        result = await self._database().skill_data.delete_many({"module_type": module_type})
        return result.deleted_count
