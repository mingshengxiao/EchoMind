import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, resumes, wordcloud
from app.api.v1.questions_bank import router as questions_bank_router
from app.config import get_settings
from app.db.factory import create_repository
from app.db.mock_repository import MockRepository
from app.models.schemas import HealthResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    try:
        repository = await create_repository(settings)
        logger.info("Repository '%s' connected successfully", repository.name)
    except Exception:
        logger.exception(
            "Failed to connect repository (MONGODB_URL=%s), "
            "falling back to MockRepository",
            "***set***" if settings.effective_mongodb_url else "(empty)",
        )
        repository = MockRepository()
    app.state.repository = repository
    yield
    await repository.close()


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(resumes.router, prefix=settings.api_prefix)
app.include_router(questions_bank_router, prefix=settings.api_prefix)
app.include_router(wordcloud.router, prefix=settings.api_prefix)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    repository_name = getattr(app.state, "repository", None).name if hasattr(app.state, "repository") else "not-ready"
    return HealthResponse(status="ok", repository=repository_name)
