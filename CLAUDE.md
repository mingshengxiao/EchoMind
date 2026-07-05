# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI + LangChain)

```bash
cd backend
python -m venv .venv           # first time only
source .venv/Scripts/activate  # Windows bash (not cmd/powershell)
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000  # use python -m to bypass AppLocker
```

- Health: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- **No test suite exists yet** — do not run `pytest` without creating tests first

### Frontend (Next.js 14)

```bash
cd frontend
npm install
npm run dev    # dev server :3000
npm run build  # production build
npm run lint   # ESLint
```

### Import question bank from Markdown files

```bash
cd backend
.venv/Scripts/python -m scripts.import_questions --dir <题库目录路径>
```

The parser auto-detects format (numbered list vs heading-based). See README.md for supported Markdown formats.

## Environment

Copy `.env.example` from the **project root** (`EchoMind/.env.example`) — the backend reads it from there by default. Key variables:

- `DEEPSEEK_API_KEY` — leave empty to use mock generator (no API key needed for local dev)
- `MONGODB_URL` — leave empty to use in-memory MockRepository (data lost on restart)
- `JWT_SECRET` — must replace in production
- `NEXT_PUBLIC_API_BASE_URL` — frontend → backend address, defaults to http://localhost:8000

## Architecture

### Repository pattern (backend)

`AbstractRepository` defines the interface; two implementations swap via `MONGODB_URL`:

- **MockRepository** (`db/mock_repository.py`) — in-memory dicts, no persistence
- **MongoRepository** (`db/mongodb_repository.py`) — motor async MongoDB driver, production

The factory (`db/factory.py`) selects one at startup and injects it into `app.state.repository` via FastAPI lifespan. Routes get it via `request.app.state.repository`.

### Two auth dependencies

| Dependency | No token | Used for |
|---|---|---|
| `get_current_user` | 401 error | All write operations, user-scoped reads |
| `get_optional_user` | returns `None` | Public read endpoints (questions-bank, etc.) |

Both defined in `services/security.py`. Token flow: JWT (python-jose) → Bearer header → stored in `localStorage` as `echomind-token`. Guest mode uses no token at all.

### Domain model vs Schema separation

- `models/domain.py` — pure Pydantic v2 models with `Field(default_factory=new_id)` for UUID and `Field(default_factory=utc_now)` for timestamps. No validation burden, no API coupling.
- `models/schemas.py` — request/response Pydantic models used by FastAPI routes. Maps domain objects to API contracts.
- Generator intermediate products (`GeneratedQuestion`, `GeneratedQuestionList`) live in `domain.py` and bridge LLM output → persistence.

### SSE streaming

AI question generation streams via Server-Sent Events. Backend yields `event: question / progress / done / error` lines; frontend reads with `ReadableStream` + `AsyncGenerator` (`readSSEStream` in `lib/api.ts`). Two streaming endpoints: auth (`POST /resumes/{id}/questions/generate/stream`) and guest (`POST /resumes/guest/process/stream`). Supports `AbortSignal` for cancellation (handles React Strict Mode double-fire).

### Frontend auth state

React Context (`AuthProvider` in `lib/auth-context.tsx`) exposes: `user`, `isGuest`, `isLoading`, `login`, `register`, `logout`, `continueAsGuest`. Token + user info persisted to `localStorage`. The class-based API wrapper in `lib/api.ts` reads the token automatically and injects it into all requests.

### Route prefix

All API routes are under `/api/v1/`. Final paths:
- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`
- Resumes: `/api/v1/resumes/*` (CRUD) + `/api/v1/resumes/guest/process`
- Questions bank: `/api/v1/questions-bank/topics`, `/api/v1/questions-bank/questions`, `/api/v1/questions-bank/progress`
- Vercel serverless: `backend/api/index.py` wraps the FastAPI app

### Import script

`scripts/import_questions.py` parses `.md` files with two strategies (numbered-list and heading-based), picks whichever extracts more questions per file. Each `.md` filename becomes the topic name. 4 sub-formats supported; details in README.md.

## Git conventions

Commits use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Always include `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Tech stack

- **Backend**: Python 3.12+, FastAPI, uvicorn, pydantic-settings, motor (MongoDB), langchain-openai, python-jose, passlib/bcrypt, pypdf, python-docx
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, lucide-react, clsx + tailwind-merge
