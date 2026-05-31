from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import Settings, get_settings
from app.db.repository import AbstractRepository
from app.models.domain import User
from app.models.schemas import AuthResponse, LoginRequest, RegisterRequest, UserPublic
from app.services.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def to_public_user(user: User) -> UserPublic:
    return UserPublic(id=user.id, username=user.username, email=user.email, created_at=user.created_at)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, payload: RegisterRequest, settings: Settings = Depends(get_settings)) -> AuthResponse:
    repository: AbstractRepository = request.app.state.repository
    existing_user = await repository.get_user_by_username(payload.username)
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = User(username=payload.username, email=payload.email, hashed_password=hash_password(payload.password))
    try:
        created_user = await repository.create_user(user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return AuthResponse(access_token=create_access_token(created_user, settings), user=to_public_user(created_user))


@router.post("/login", response_model=AuthResponse)
async def login(request: Request, payload: LoginRequest, settings: Settings = Depends(get_settings)) -> AuthResponse:
    repository: AbstractRepository = request.app.state.repository
    user = await repository.get_user_by_username(payload.username)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return AuthResponse(access_token=create_access_token(user, settings), user=to_public_user(user))


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return to_public_user(current_user)
