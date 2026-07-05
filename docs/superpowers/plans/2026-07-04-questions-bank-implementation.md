# 面试题集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interview question bank browsing with bookmark/master/review/answer interaction, importing existing .md files as seed data.

**Architecture:** New domain models (QuestionBankItem, UserQuestionProgress) added alongside existing Resume/InterviewQuestion models. Repository pattern extended with new methods. New API router `/api/v1/questions-bank`. Frontend gets new route `/questions-bank` with 面试鸭-style left-tree-right-list layout.

**Tech Stack:** Python/FastAPI, MongoDB (motor), Next.js 14 App Router, TypeScript, Tailwind CSS

## Global Constraints

- All new domain models use a UUID `id` field via `uuid4().hex` (matching existing pattern `new_id()`)
- Repository methods follow existing async pattern: `AbstractRepository` → `MockRepository` | `MongoRepository`
- Frontend API calls go through `api.ts` with same fetch wrapper/token handling pattern
- Frontend types defined in `types/index.ts`
- API routes use FastAPI `APIRouter(prefix="...")` pattern
- Difficulty enum: `junior`, `mid`, `senior`
- Interaction status fields: `is_bookmarked`, `is_mastered`, `is_review` — three independent booleans

---

### Task 1: Domain Models + API Schemas

**Files:**
- Modify: `backend/app/models/domain.py`
- Modify: `backend/app/models/schemas.py`

**Interfaces:**
- Consumes: existing `new_id()`, `utc_now()` helpers in domain.py
- Produces: `QuestionBankTopic`, `QuestionBankItem`, `UserQuestionProgress` domain classes; `QuestionBankTopicResponse`, `QuestionBankItemResponse`, `QuestionBankDetailResponse`, `UserProgressResponse`, `QuestionBankListResponse`, `ProgressStatsResponse`, `ToggleActionResponse`, `SaveAnswerRequest` schemas

- [ ] **Step 1: Add domain models to domain.py**

Insert after the existing `InterviewQuestion` class:

```python
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
```

- [ ] **Step 2: Add schemas to schemas.py**

Insert before `HealthResponse`:

```python
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/domain.py backend/app/models/schemas.py
git commit -m "feat: add question bank domain models and schemas"
```

---

### Task 2: Repository — Abstract + Mock

**Files:**
- Modify: `backend/app/db/repository.py`
- Modify: `backend/app/db/mock_repository.py`

**Interfaces:**
- Consumes: domain models from Task 1
- Produces: `AbstractRepository` new abstract methods + `MockRepository` in-memory implementations

- [ ] **Step 1: Add new abstract methods to AbstractRepository (repository.py)**

Insert before the closing of the class:

```python
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
```

And add the imports for the new domain models at the top:

```python
from app.models.domain import InterviewQuestion, QuestionBankItem, QuestionBankTopic, Resume, User, UserQuestionProgress
```

- [ ] **Step 2: Add import and mock data dicts to MockRepository (mock_repository.py)**

Add imports at top:

```python
from app.models.domain import (
    InterviewQuestion,
    QuestionBankItem,
    QuestionBankTopic,
    Resume,
    User,
    UserQuestionProgress,
)
```

Add new dicts in `__init__`:

```python
self._question_bank_topics: dict[str, QuestionBankTopic] = {}  # key: name
self._question_bank_items: dict[str, QuestionBankItem] = {}  # key: id
self._user_progress: dict[str, UserQuestionProgress] = {}  # key: f"{user_id}:{question_id}"
```

- [ ] **Step 3: Implement new methods in MockRepository**

Add these methods inside `MockRepository`:

```python
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
```

Add `from app.models.domain import utc_now` to the imports.

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/repository.py backend/app/db/mock_repository.py
git commit -m "feat: add question bank repository interface and mock implementation"
```

---

### Task 3: MongoDB Repository Implementation

**Files:**
- Modify: `backend/app/db/mongodb_repository.py`

**Interfaces:**
- Consumes: abstract methods from repository.py, domain models
- Produces: MongoDB implementations with index creation

- [ ] **Step 1: Add MongoDB implementation methods to MongoRepository**

Update the imports at the top:

```python
from app.db.repository import AbstractRepository
from app.models.domain import (
    InterviewQuestion,
    QuestionBankItem,
    QuestionBankTopic,
    Resume,
    User,
    UserQuestionProgress,
)
from app.models.domain import utc_now
```

Add index creation in `connect()`:

```python
await self.db.question_bank_topics.create_index("name", unique=True)
await self.db.question_bank_items.create_index("topic")
await self.db.question_bank_items.create_index("difficulty")
await self.db.question_bank_items.create_index([("topic", 1), ("created_at", -1)])
await self.db.question_bank_items.create_index([("question_text", "text"), ("reference_answer", "text")])
await self.db.user_question_progress.create_index("user_id")
await self.db.user_question_progress.create_index([("user_id", 1), ("question_id", 1)], unique=True)
```

Add after `get_questions_by_resume`:

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/db/mongodb_repository.py
git commit -m "feat: add question bank MongoDB repository implementation"
```

---

### Task 4: Import Script

**Files:**
- Create: `backend/scripts/import_questions.py`

**Interfaces:**
- Consumes: parsed md files, MongoDB via motor
- Produces: populated `question_bank_topics` and `question_bank_items` collections

- [ ] **Step 1: Create the import script**

```python
"""
Import interview questions from markdown files into MongoDB.

Usage:
    .venv/Scripts/python -m scripts.import_questions --dir D:/xiao/projects/dailly-prompt/面试
    .venv/Scripts/python -m scripts.import_questions --dir ./面试 --ai-enrich
"""

import argparse
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from app.models.domain import QuestionBankItem, QuestionBankTopic

# ── config ──────────────────────────────────────────────────
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "echomind"
DIR_HELP = "Path to directory containing .md question bank files"


# ── parsers ─────────────────────────────────────────────────

def parse_format_a(text: str, source_file: str) -> list[tuple[str, str]]:
    """Format A: numbered list with sub-bullet answers.

    ## 主题名
    1. 问题？
       - 答案
    2. 问题？
       - 答案
    """
    results: list[tuple[str, str]] = []
    # Match: optional "N." or "N、" or "N." at start of line
    pattern = re.compile(r"^(?:\d+)[.、．]\s*(.+?)$", re.MULTILINE)
    lines = text.split("\n")
    current_question = None
    current_answer_parts: list[str] = []

    for line in lines:
        stripped = line.strip()
        m = pattern.match(stripped)
        if m:
            # Save previous
            if current_question:
                answer = " ".join(current_answer_parts).strip()
                results.append((current_question, answer))
            current_question = m.group(1)
            current_answer_parts = []
        elif stripped.startswith("-") or stripped.startswith(" -") or stripped.startswith("—"):
            # Answer bullet lines
            current_answer_parts.append(stripped.lstrip("-— ").strip())
        elif current_question and stripped and not stripped.startswith("```"):
            # Continuation of answer (non-code, non-empty)
            if not stripped.startswith("##") and not stripped.startswith("```"):
                current_answer_parts.append(stripped)

    # Last question
    if current_question:
        answer = " ".join(current_answer_parts).strip()
        results.append((current_question, answer))

    return results


def parse_format_b(text: str, source_file: str) -> list[tuple[str, str]]:
    """Format B: ## Problem N: or ### N. heading style.

    ### N. 问题标题？
    ✅ 答案内容
    """
    results: list[tuple[str, str]] = []

    # Pattern 1: ### N. 问题标题
    # followed by content until next ###
    blocks = re.split(r"(?=^#{2,3}\s+)", text, flags=re.MULTILINE)
    for block in blocks:
        if not block.strip():
            continue
        # Try to extract question from heading
        q_match = re.match(r"^#{2,3}\s+(?:\d+[.、．]\s*)?(.+)$", block.strip(), re.MULTILINE)
        if not q_match:
            continue
        question = q_match.group(1).strip()
        if not question:
            continue

        # Remove the heading line(s) to get answer body
        body = re.sub(r"^#{2,3}\s+.*$", "", block, flags=re.MULTILINE).strip()
        # Remove ✅ emoji prefix
        body = re.sub(r"^[✅✔]\s*", "", body.strip())
        # Remove code fences
        body = re.sub(r"```[\s\S]*?```", "", body).strip()
        if body:
            results.append((question, body))

    return results


def parse_file(filepath: str) -> list[tuple[str, str]]:
    """Parse a single .md file, returning list of (question, answer)."""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # Remove front matter if any
    text = re.sub(r"^---[\s\S]*?---\n*", "", text).strip()

    results = parse_format_a(text, filepath)
    if not results:
        results = parse_format_b(text, filepath)
    # Fallback: try format B first then A
    if not results:
        results = parse_format_b(text, filepath)
    if not results:
        results = parse_format_a(text, filepath)

    return results


# ── import ──────────────────────────────────────────────────

async def import_questions(dir_path: str, ai_enrich: bool = False):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Remove old data for a fresh import
    await db.question_bank_topics.delete_many({})
    await db.question_bank_items.delete_many({})

    md_files = sorted([f for f in os.listdir(dir_path) if f.endswith(".md") and f != "README.md"])
    all_items: list[QuestionBankItem] = []
    seen_topics: set[str] = set()

    print(f"Found {len(md_files)} markdown files\n")

    for filename in md_files:
        filepath = os.path.join(dir_path, filename)
        topic = filename.replace(".md", "")

        pairs = parse_file(filepath)
        print(f"  {topic}: {len(pairs)} questions")

        if not pairs:
            continue

        seen_topics.add(topic)
        for i, (question_text, ref_answer) in enumerate(pairs):
            all_items.append(
                QuestionBankItem(
                    topic=topic,
                    question_text=question_text,
                    reference_answer=ref_answer,
                    source_file=filename,
                )
            )

    # Save topics
    topics = [QuestionBankTopic(name=t, question_count=sum(1 for i in all_items if i.topic == t)) for t in seen_topics]
    if topics:
        # Upsert each
        for topic in topics:
            await db.question_bank_topics.update_one(
                {"name": topic.name}, {"$set": topic.model_dump(mode="json")}, upsert=True
            )

    # Save items in batches of 100
    batch_size = 100
    for i in range(0, len(all_items), batch_size):
        batch = all_items[i : i + batch_size]
        dicts = [item.model_dump(mode="json") for item in batch]
        await db.question_bank_items.insert_many(dicts)

    print(f"\nTotal: {len(all_items)} questions across {len(seen_topics)} topics")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Import interview questions from markdown files")
    parser.add_argument("--dir", default=DIR_HELP)
    parser.add_argument("--ai-enrich", action="store_true", help="Use AI to fill difficulty/tags")
    args = parser.parse_args()

    asyncio.run(import_questions(args.dir, ai_enrich=args.ai_enrich))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/import_questions.py
git commit -m "feat: add question bank import script from markdown files"
```

---

### Task 5: API Routes

**Files:**
- Create: `backend/app/api/v1/questions_bank.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: Repository methods, domain models, schemas, `get_current_user` dependency
- Produces: All 9 endpoints mounted at `/api/v1/questions-bank`

- [ ] **Step 1: Create the API router module**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.config import Settings, get_settings
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
```

- [ ] **Step 2: Add `get_optional_user` dependency to security.py**

In `backend/app/services/security.py` (after `get_current_user`), add this function:

```python
async def get_optional_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> User | None:
    """Like get_current_user but returns None instead of 401 when no token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token_str = auth_header[7:]
    try:
        payload = jwt.decode(token_str, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        repository: AbstractRepository = request.app.state.repository
        user = await repository.get_user_by_id(user_id)
        return user
    except JWTError:
        return None
```

(The required imports `Settings`, `get_settings`, `jwt`, `JWTError`, `AbstractRepository` are already present in security.py.)

- [ ] **Step 3: Register the new router in main.py**

Add the import at the top of `backend/app/main.py`:

```python
from app.api.v1.questions_bank import router as questions_bank_router
```

Add after the existing `app.include_router(resumes_router)` line:

```python
app.include_router(questions_bank_router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/questions_bank.py backend/app/services/security.py backend/app/main.py
git commit -m "feat: add question bank API routes with auth"
```

---

### Task 6: Frontend Types + API Layer

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: backend API response shapes
- Produces: TypeScript types and `api.questionsBank.*` methods

- [ ] **Step 1: Add question bank types to index.ts**

Append to the file before the final SSE types:

```typescript
// ── Questions Bank ──────────────────────────────────────────

export interface QuestionBankTopic {
  id: string;
  name: string;
  question_count: number;
}

export interface QuestionBankItem {
  id: string;
  topic: string;
  question_text: string;
  reference_answer: string;
  difficulty: string;
  tags: string[];
  source_file: string;
  created_at: string;
}

export interface UserProgressState {
  is_bookmarked: boolean;
  is_mastered: boolean;
  is_review: boolean;
  user_answer: string;
  answered_at: string | null;
}

export interface QuestionBankDetail extends QuestionBankItem {
  user_progress?: UserProgressState;
}

export interface QuestionBankListResponse {
  items: QuestionBankDetail[];
  total: number;
  page: number;
  size: number;
}

export interface ProgressStats {
  bookmarked: number;
  mastered: number;
  review: number;
  answered: number;
  total: number;
}
```

- [ ] **Step 2: Add API methods to api.ts**

Before the closing `};` of the `api` object, add a comma and the questionsBank block:

```typescript
  questionsBank: {
    listTopics: () =>
      request<QuestionBankTopic[]>("/api/v1/questions-bank/topics"),

    listQuestions: (params?: {
      topic?: string;
      difficulty?: string;
      search?: string;
      page?: number;
      size?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.topic) query.set("topic", params.topic);
      if (params?.difficulty) query.set("difficulty", params.difficulty);
      if (params?.search) query.set("search", params.search);
      if (params?.page) query.set("page", String(params.page));
      if (params?.size) query.set("size", String(params.size));
      const qs = query.toString();
      return request<QuestionBankListResponse>(
        `/api/v1/questions-bank/questions${qs ? `?${qs}` : ""}`
      );
    },

    getQuestion: (id: string) =>
      request<QuestionBankDetail>(`/api/v1/questions-bank/questions/${id}`),

    toggleBookmark: (id: string) =>
      request<{ success: boolean; new_value: boolean }>(
        `/api/v1/questions-bank/questions/${id}/bookmark`,
        { method: "POST" }
      ),

    toggleMastered: (id: string) =>
      request<{ success: boolean; new_value: boolean }>(
        `/api/v1/questions-bank/questions/${id}/master`,
        { method: "POST" }
      ),

    toggleReview: (id: string) =>
      request<{ success: boolean; new_value: boolean }>(
        `/api/v1/questions-bank/questions/${id}/review`,
        { method: "POST" }
      ),

    saveAnswer: (id: string, answer: string) =>
      request<{ success: boolean; new_value: boolean }>(
        `/api/v1/questions-bank/questions/${id}/answer`,
        { method: "POST", body: JSON.stringify({ answer }) }
      ),

    getProgress: () =>
      request<ProgressStats>("/api/v1/questions-bank/progress"),
  },
```

Add the new imports at the top:

```typescript
import type {
  // ... existing imports ...
  ProgressStats,
  QuestionBankDetail,
  QuestionBankListResponse,
  QuestionBankTopic,
} from "@/types";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: add frontend types and API methods for question bank"
```

---

### Task 7: Frontend Components

**Files:**
- Create: `frontend/src/components/resume/QuestionBankCard.tsx`
- Create: `frontend/src/components/resume/TopicSidebar.tsx`
- Create: `frontend/src/components/resume/QuestionFilterBar.tsx`
- Create: `frontend/src/components/resume/AnswerDialog.tsx`

**Interfaces:**
- Consumes: types from Task 6
- Produces: Reusable UI components for the question bank page

- [ ] **Step 1: Create QuestionBankCard.tsx**

```tsx
"use client";

import { Bookmark, CheckCircle2, ChevronDown, PencilLine, RotateCcw } from "lucide-react";
import { useState } from "react";

import type { QuestionBankDetail } from "@/types";
import { useAuth } from "@/lib/auth-context";

const difficultyLabels: Record<string, string> = {
  junior: "初级",
  mid: "中级",
  senior: "高级",
};

const difficultyColors: Record<string, string> = {
  junior: "bg-green-50 text-green-700",
  mid: "bg-yellow-50 text-yellow-700",
  senior: "bg-red-50 text-red-700",
};

interface Props {
  question: QuestionBankDetail;
  index: number;
  onToggleBookmark?: (id: string) => void;
  onToggleMastered?: (id: string) => void;
  onToggleReview?: (id: string) => void;
  onAnswer?: (id: string) => void;
}

export function QuestionBankCard({
  question,
  index,
  onToggleBookmark,
  onToggleMastered,
  onToggleReview,
  onAnswer,
}: Props) {
  const [showAnswer, setShowAnswer] = useState(false);
  const { user } = useAuth();
  const progress = question.user_progress;
  const isLoggedIn = !!user;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-white">#{index + 1}</span>
          <span className={`rounded-full px-3 py-1 ${difficultyColors[question.difficulty] || "bg-zinc-100 text-zinc-600"}`}>
            {difficultyLabels[question.difficulty] || question.difficulty}
          </span>
          {question.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              {tag}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        {isLoggedIn && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleBookmark?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_bookmarked
                  ? "bg-yellow-100 text-yellow-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_bookmarked ? "取消收藏" : "收藏"}
            >
              <Bookmark aria-hidden="true" className="h-4 w-4" fill={progress?.is_bookmarked ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => onToggleMastered?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_mastered
                  ? "bg-green-100 text-green-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_mastered ? "取消掌握" : "标记掌握"}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleReview?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_review
                  ? "bg-violet-100 text-violet-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_review ? "取消待复习" : "标记待复习"}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onAnswer?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.answered_at
                  ? "bg-blue-100 text-blue-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title="作答"
            >
              <PencilLine aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Question text */}
      <p className="leading-7 text-zinc-900">{question.question_text}</p>

      {/* Answer toggle */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <button
          aria-expanded={showAnswer}
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setShowAnswer((v) => !v)}
          type="button"
        >
          {showAnswer ? "隐藏参考回答" : "显示参考回答"}
          <ChevronDown
            aria-hidden="true"
            className={`ml-2 h-4 w-4 transition-transform duration-200 ${showAnswer ? "rotate-180" : ""}`}
          />
        </button>
        {showAnswer && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-zinc-700">
            <p className="mb-2 font-semibold text-blue-900">参考回答</p>
            <p className="whitespace-pre-wrap">{question.reference_answer || "暂无参考回答"}</p>
          </div>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Create TopicSidebar.tsx**

```tsx
"use client";

import { Bookmark, CheckCircle2, RotateCcw } from "lucide-react";

import type { ProgressStats, QuestionBankTopic } from "@/types";
import { useAuth } from "@/lib/auth-context";

interface Props {
  topics: QuestionBankTopic[];
  selectedTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
  progress?: ProgressStats;
}

export function TopicSidebar({ topics, selectedTopic, onSelectTopic, progress }: Props) {
  const { user } = useAuth();

  return (
    <aside className="flex h-full flex-col">
      {/* Topic list */}
      <nav className="flex-1 overflow-y-auto" aria-label="科目列表">
        <div className="px-3 pb-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            全部科目
          </h3>
          <button
            type="button"
            onClick={() => onSelectTopic(null)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selectedTopic === null
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center justify-between">
              <span>全部</span>
              <span className="text-xs opacity-60">
                {topics.reduce((sum, t) => sum + t.question_count, 0)}
              </span>
            </span>
          </button>
        </div>
        <div className="space-y-0.5 px-3">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onSelectTopic(topic.name)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selectedTopic === topic.name
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <span className="flex items-center justify-between">
                <span>{topic.name}</span>
                <span className="text-xs opacity-60">{topic.question_count}</span>
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Progress summary */}
      {user && progress && (
        <div className="flex-shrink-0 border-t border-zinc-200 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            进度概览
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Bookmark aria-hidden="true" className="h-3.5 w-3.5 text-yellow-500" />
              <span>收藏 {progress.bookmarked}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-green-500" />
              <span>掌握 {progress.mastered}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 text-violet-500" />
              <span>待复习 {progress.review}</span>
            </div>
          </div>
        </div>
      )}

      {/* Login prompt for guest */}
      {!user && (
        <div className="flex-shrink-0 border-t border-zinc-200 p-4">
          <p className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-500">
            登录后可收藏题目、标记进度
          </p>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Create QuestionFilterBar.tsx**

```tsx
"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface Props {
  search: string;
  difficulty: string;
  onSearchChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
}

const difficultyOptions = [
  { value: "", label: "全部难度" },
  { value: "junior", label: "初级" },
  { value: "mid", label: "中级" },
  { value: "senior", label: "高级" },
];

export function QuestionFilterBar({
  search,
  difficulty,
  onSearchChange,
  onDifficultyChange,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearSearch = useCallback(() => {
    onSearchChange("");
    inputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div
        className={`relative flex flex-1 items-center rounded-2xl border bg-white transition-colors duration-200 ${
          focused ? "border-zinc-400" : "border-zinc-200"
        }`}
      >
        <Search aria-hidden="true" className="ml-3 h-4 w-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="搜索题目..."
          className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="mr-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Difficulty filter */}
      <div className="relative flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-zinc-400" />
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="appearance-none bg-transparent pr-4 text-sm text-zinc-700 focus:outline-none"
        >
          {difficultyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create AnswerDialog.tsx**

```tsx
"use client";

import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";

interface Props {
  questionText: string;
  existingAnswer?: string;
  onSave: (answer: string) => Promise<void>;
  onClose: () => void;
}

export function AnswerDialog({ questionText, existingAnswer, onSave, onClose }: Props) {
  const [answer, setAnswer] = useState(existingAnswer || "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(answer);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [answer, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">作答</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
          {questionText}
        </div>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="输入你的答案..."
          rows={6}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !answer.trim()}>
            {saving ? "保存中..." : "保存答案"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/resume/QuestionBankCard.tsx frontend/src/components/resume/TopicSidebar.tsx frontend/src/components/resume/QuestionFilterBar.tsx frontend/src/components/resume/AnswerDialog.tsx
git commit -m "feat: add question bank frontend components"
```

---

### Task 8: Frontend Page + Navigation

**Files:**
- Create: `frontend/src/app/questions-bank/page.tsx`
- Modify: `frontend/src/components/layout/SiteHeader.tsx`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: all components from Task 7, API methods from Task 6
- Produces: the complete `/questions-bank` page and navigation entry

- [ ] **Step 1: Create the main questions bank page**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { AnswerDialog } from "@/components/resume/AnswerDialog";
import { QuestionBankCard } from "@/components/resume/QuestionBankCard";
import { QuestionFilterBar } from "@/components/resume/QuestionFilterBar";
import { TopicSidebar } from "@/components/resume/TopicSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ProgressStats, QuestionBankDetail, QuestionBankTopic } from "@/types";

export default function QuestionsBankPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<QuestionBankTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questions, setQuestions] = useState<QuestionBankDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 20;

  // Answer dialog state
  const [answerQuestionId, setAnswerQuestionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressStats | undefined>();

  // Load topics once
  useEffect(() => {
    api.questionsBank.listTopics().then(setTopics).catch(() => {});
  }, []);

  // Load progress when user logs in
  useEffect(() => {
    if (!user) {
      setProgress(undefined);
      return;
    }
    api.questionsBank.getProgress().then(setProgress).catch(() => {});
  }, [user]);

  // Load questions when filters change
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.questionsBank.listQuestions({
        topic: selectedTopic || undefined,
        difficulty: difficulty || undefined,
        search: search || undefined,
        page,
        size: pageSize,
      });
      setQuestions(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, difficulty, search, page]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Reset to page 1 when filters change
  const handleTopicChange = useCallback((topic: string | null) => {
    setSelectedTopic(topic);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleDifficultyChange = useCallback((value: string) => {
    setDifficulty(value);
    setPage(1);
  }, []);

  // Action handlers
  const handleToggleBookmark = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleBookmark(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_bookmarked: result.new_value,
                },
              }
            : q
        )
      );
      // Refresh progress
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleToggleMastered = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleMastered(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_mastered: result.new_value,
                },
              }
            : q
        )
      );
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleToggleReview = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleReview(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_review: result.new_value,
                },
              }
            : q
        )
      );
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleSaveAnswer = useCallback(async (answer: string) => {
    if (!answerQuestionId) return;
    await api.questionsBank.saveAnswer(answerQuestionId, answer);
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === answerQuestionId
          ? {
              ...q,
              user_progress: {
                ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                user_answer: answer,
                answered_at: new Date().toISOString(),
              },
            }
          : q
      )
    );
    const p = await api.questionsBank.getProgress();
    setProgress(p);
  }, [answerQuestionId]);

  const totalPages = Math.ceil(total / pageSize);

  const answerQuestion = questions.find((q) => q.id === answerQuestionId);

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex-shrink-0 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Questions Bank
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          面试题集
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-4 overflow-hidden pb-4">
        {/* Left sidebar */}
        <div className="flex w-[240px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          <TopicSidebar
            topics={topics}
            selectedTopic={selectedTopic}
            onSelectTopic={handleTopicChange}
            progress={progress}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {/* Filter bar */}
          <div className="flex-shrink-0 border-b border-zinc-100 p-4">
            <QuestionFilterBar
              search={search}
              difficulty={difficulty}
              onSearchChange={handleSearchChange}
              onDifficultyChange={handleDifficultyChange}
            />
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : questions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-semibold text-zinc-950">暂无题目</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {search || difficulty
                      ? "没有匹配的题目，试试其他筛选条件"
                      : "题库还没有数据，请先运行导入脚本"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionBankCard
                    key={q.id}
                    question={q}
                    index={(page - 1) * pageSize + i}
                    onToggleBookmark={handleToggleBookmark}
                    onToggleMastered={handleToggleMastered}
                    onToggleReview={handleToggleReview}
                    onAnswer={(id) => setAnswerQuestionId(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex-shrink-0 border-t border-zinc-100 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        page === pageNum
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Answer dialog */}
      {answerQuestion && (
        <AnswerDialog
          questionText={answerQuestion.question_text}
          existingAnswer={answerQuestion.user_progress?.user_answer}
          onSave={handleSaveAnswer}
          onClose={() => setAnswerQuestionId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add navigation link in SiteHeader.tsx**

After the "简历问答" link, add the new menu item:

```tsx
<Link
  className="transition-colors duration-200 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  href="/questions-bank"
>
  面试题集
</Link>
```

- [ ] **Step 3: Update homepage to mention the new feature**

In `page.tsx`, update the badge text from "简历问答 · 第一阶段已开放" to a more comprehensive message, and add a CTA button for the question bank. For example:

In the `HomePage`, update the badge:
```tsx
<div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
  <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
  面试题集 · 新功能已上线
</div>
```

And add a question bank CTA button alongside the existing ones:
```tsx
<Link href="/questions-bank">
  <Button variant="secondary">
    去刷题
    <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
  </Button>
</Link>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/questions-bank/page.tsx frontend/src/components/layout/SiteHeader.tsx frontend/src/app/page.tsx
git commit -m "feat: add questions bank page and navigation"
```

---

### Task 9: Run Import Script + Verify

**Files:**
- Execute: `backend/scripts/import_questions.py`

- [ ] **Step 1: Run the import script**

```bash
cd backend
.venv/Scripts/python -m scripts.import_questions --dir D:/xiao/projects/dailly-prompt/面试
```

Expected output:
```
Found N markdown files

  前端基础: M questions
  Agent 开发面试题: K questions
  ...

Total: X questions across Y topics
```

- [ ] **Step 2: Verify the API works**

```bash
# Start the backend
cd backend
source .venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

Then test in another terminal:
```bash
curl http://localhost:8000/api/v1/questions-bank/topics | head -50
curl "http://localhost:8000/api/v1/questions-bank/questions?page=1&size=3" | head -100
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend
npm run build
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjust after import script verification"
```
