from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, resumes
from app.config import get_settings
from app.db.factory import create_repository
from app.models.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    repository = await create_repository(settings)
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


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    repository_name = getattr(app.state, "repository", None).name if hasattr(app.state, "repository") else "not-ready"
    return HealthResponse(status="ok", repository=repository_name)
