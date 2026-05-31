from app.config import Settings
from app.db.mock_repository import MockRepository
from app.db.mongodb_repository import MongoRepository
from app.db.repository import AbstractRepository


async def create_repository(settings: Settings) -> AbstractRepository:
    if settings.mongodb_url:
        repository = MongoRepository(settings.mongodb_url, settings.mongodb_database)
    else:
        repository = MockRepository()
    await repository.connect()
    return repository
