# AGENTS.md

This file contains deployment configuration, environment setup, and operational knowledge for the EchoMind project. AI agents should read this before making infrastructure or deployment changes.

## Deployment Architecture

EchoMind deploys as a **single Vercel project** with both frontend and backend sharing the same domain.

```
Root (Vercel project root)
├── src/                    # Next.js frontend (App Router)
├── api/                    # Python serverless function (FastAPI)
│   └── index.py           # Entry point, bridges to backend/app/main.py
├── backend/               # Python backend source code
│   └── app/               # FastAPI application modules
├── package.json           # Next.js dependencies (next, react, etc.)
├── requirements.txt       # Python dependencies (copied from backend/)
├── vercel.json            # Routing: /api/* → Python, rest → Next.js
├── next.config.js         # Next.js configuration
└── tsconfig.json          # TypeScript configuration
```

### Key Design Decisions

1. **Next.js at project root** — Vercel's `Next.js` Framework Preset requires `package.json` with `next` dependency at the root. Previously Next.js was in `frontend/` subdirectory which caused deployment failures.
2. **Python functions in `api/`** — Vercel auto-detects Python serverless functions in `api/` directory. The `api/index.py` uses `sys.path` manipulation to import from `backend/app/`.
3. **Routing via `vercel.json` rewrites** — `/api/:path*` and `/health` route to the Python function; everything else goes to Next.js.

## Vercel Project Settings

These settings must be configured in **Vercel Dashboard → Settings → General**:

| Setting | Value | Why |
|---|---|---|
| **Framework Preset** | `Next.js` | Required for Vercel to properly serve `.next` output |
| **Root Directory** | *(empty)* | Must point to repo root where `package.json` lives |
| **Build Command** | *(leave default/auto)* | Vercel auto-detects `npm run build` from `package.json` |
| **Output Directory** | *(leave default/auto)* | Vercel auto-detects `.next` for Next.js |

### Common Mistakes

- Setting Framework Preset to `Other` → causes 404 (Vercel doesn't know how to serve Next.js)
- Setting Framework Preset to `Next.js` without `next` in root `package.json` → "No Next.js version detected"
- Setting Root Directory to `frontend/` → old config, must be empty now

## Environment Variables

Configure in **Vercel Dashboard → Settings → Environment Variables**. Apply to **All environments** (Production + Preview + Development).

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | Yes | `sk-xxx` | Without this, AI generation uses mock data |
| `DEEPSEEK_BASE_URL` | No | `https://api.deepseek.com` | Has default |
| `DEEPSEEK_MODEL` | No | `deepseek-v4-flash` | Has default |
| `MONGODB_URL` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/echomind` | MongoDB Atlas connection; without this, uses in-memory mock |
| `MONGODB_DATABASE` | No | `echomind` | Has default |
| `JWT_SECRET` | Yes | *(strong random string)* | Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | Yes | `https://mingshengxiao.cn` | Production domain |
| `MAX_UPLOAD_MB` | No | `10` | Has default |
| `NEXT_PUBLIC_API_BASE_URL` | **DO NOT SET** | *(empty)* | Frontend auto-detects same-origin; setting this breaks production |

### MongoDB Atlas Setup

1. Create cluster at https://cloud.mongodb.com
2. Click **Connect** → **Drivers** → copy connection string
3. Replace `<username>` and `<password>` placeholders
4. Append database name: `...mongodb.net/echomind?retryWrites=true&w=majority`
5. In **Network Access**: allow `0.0.0.0/0` (Vercel serverless IPs are dynamic)
6. URL-encode special characters in password (`@` → `%40`, `#` → `%23`)

## Git & CI/CD Flow

```
Local → git push → Gitee (gitcode.com) → auto-sync → GitHub → Vercel auto-deploy
```

- Local git remote `origin` points to `git@gitcode.com:xrpm/EchoMind.git`
- Gitee repo mirrors to GitHub
- Vercel is connected to the GitHub repo and auto-deploys on push

### Git Identity (this project)

```
git config user.email "13981799547@163.com"
git config user.name "mingshengxiao"
```

This is required because Vercel checks that the git commit author is a team member. Using a non-team email causes deployment to be BLOCKED with error: "Git author must have access to the team".

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
npm install                   # at project root
npm run dev                   # Next.js dev server at :3000
```

### Frontend → Backend Communication

In local dev, the frontend calls `http://localhost:8000` (set via `NEXT_PUBLIC_API_BASE_URL` env var or fallback). In production, it uses relative URLs (same domain).

The `src/lib/api.ts` logic:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
```

## Key Files Reference

| File | Purpose |
|---|---|
| `vercel.json` | Routing rewrites: `/api/*` → Python function |
| `api/index.py` | Serverless entry; adds `backend/` to sys.path, imports FastAPI app |
| `backend/app/main.py` | FastAPI application (routers, middleware, lifespan) |
| `backend/app/config.py` | Pydantic Settings; reads env vars for all config |
| `backend/app/db/factory.py` | Creates Mock or Mongo repository based on `MONGODB_URL` |
| `src/lib/api.ts` | Frontend API client with auto-token injection |
| `src/lib/auth-context.tsx` | React auth state management |
| `requirements.txt` | Root-level Python deps (copy of `backend/requirements.txt`) |
| `package.json` | Next.js deps (next, react, tailwind, etc.) |

## Deployment Verification Checklist

After a successful deployment, verify:

1. `https://your-domain/` → Next.js homepage loads (not 404)
2. `https://your-domain/health` → Returns `{"status": "ok", "repository": "mongodb"}`
3. `https://your-domain/api/v1/questions-bank/topics` → Returns question topics
4. Login/register works end-to-end
5. AI question generation works (if `DEEPSEEK_API_KEY` is set)
