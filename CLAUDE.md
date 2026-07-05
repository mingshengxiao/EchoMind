# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI + LangChain)

```bash
cd backend
.venv/Scripts/python -m venv .venv       # 首次：创建虚拟环境
source .venv/Scripts/activate             # Windows bash 激活
pip install -r requirements.txt           # 安装依赖
python -m uvicorn app.main:app --reload --port 8000  # 启动开发服务器（用 python -m 绕开 AppLocker）
```

- Health: http://localhost:8000/health
- API docs: http://localhost:8000/docs

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev    # 开发服务器 :3000
npm run build  # 构建
npm run lint   # ESLint
```

### Import question bank

```bash
cd backend
.venv/Scripts/python -m scripts.import_questions --dir <题库目录路径>
# 示例：--dir D:/xiao/projects/dailly-prompt/面试
```

### Vercel

- Frontend 和 backend/api/ 均可部署到 Vercel（backend 使用 `@vercel/python`）
- 前端部署时设置 `NEXT_PUBLIC_API_BASE_URL` 为后端公网地址

## Environment

复制 `.env.example` 到项目根目录（后端也会读取）：

- `DEEPSEEK_API_KEY` — 留空则后端自动使用 mock 生成器（无需 API key 即可验证完整流程）
- `MONGODB_URL` — 留空则使用内存 mock repository（所有数据进程内持有，重启丢失）
- `JWT_SECRET` — 生产环境必须替换

## Architecture

### High-level

```
EchoMind/
├── backend/         # Python FastAPI (ASGI)
│   ├── app/
│   │   ├── api/v1/  # 路由：auth.py, resumes.py (简历 CRUD + 生成), questions_bank.py
│   │   ├── db/      # Repository 模式：AbstractRepository → MockRepository | MongoRepository
│   │   ├── models/  # domain.py (领域模型), schemas.py (API 请求/响应)
│   │   ├── services/ # generator.py (AI/fallback), parser.py (PDF/DOCX/MD), security.py (JWT/bcrypt)
│   │   ├── config.py # pydantic-settings
│   │   └── main.py   # FastAPI app 入口
│   ├── scripts/     # import_questions.py（题库导入脚本）
│   └── api/index.py # Vercel Serverless 入口
└── frontend/        # Next.js 14 App Router
    └── src/
        ├── app/         # 页面路由：/, /login, /register, /resume-qa, /questions-bank
        ├── components/  # auth/, layout/, resume/, ui/
        ├── lib/         # api.ts (fetch 封装), auth-context.tsx (React Context)
        └── types/       # TypeScript 接口定义
```

### Key Patterns

- **后端 Repository 模式**：`AbstractRepository` 定义接口，`MockRepository`（内存 dict）和 `MongoRepository`（motor async driver）分别实现。`db/factory.py` 根据 `MONGODB_URL` 配置自动选择，通过 FastAPI lifespan 注入 `app.state.repository`。
- **JWT 认证**：`security.py` 实现 JWT encode/decode + bcrypt 密码哈希。`get_current_user` 要求登录（401），`get_optional_user` 无 token 时返回 None（游客可访问的只读接口用）。
- **游客模式**：`POST /api/v1/resumes/guest/process` 实现无需登录的上传+生成流程，结果不保存到数据库。
- **AI 生成**：`generator.py` 使用 `langchain-openai` ChatOpenAI（兼容任何 OpenAI 格式的 API），默认模型 `deepseek-v4-flash`。无 API key 时自动回退到本地模板引擎 `_mock_questions()`。
- **SSE 流式输出**：`resumes.py` 中 `/stream` 端点实现 Server-Sent Events，前端 `api.ts` 中 `readSSEStream()` 通过 `ReadableStream` 解析事件流，支持 `AbortSignal` 取消。
- **前端 API 封装**：`lib/api.ts` 是一个轻量 fetch 封装，自动读取 localStorage token、处理错误、序列化 FormData。所有组件通过 `api.*` 调用。
- **认证状态**：`auth-context.tsx` 提供 `user` / `isGuest` / `login` / `register` / `logout` / `continueAsGuest`，token 和用户信息存储在 localStorage。
- **模型分层**：`domain.py` = 纯领域对象（无 validation 负担），`schemas.py` = API 请求/响应 Pydantic 模型（含校验）。生成器中间产物用 `GeneratedQuestion`/`GeneratedQuestionList` 衔接 LLM 输出与持久化。

### Data Model

- `User` — id, username, email, hashed_password, created_at
- `Resume` — id, user_id, filename, file_size, content_text, content_preview, word_count, uploaded_at
- `InterviewQuestion` — id, resume_id, question_text, category, difficulty, focus_area, reference_answer, created_at
- `QuestionBankTopic` — id, name, question_count（从 md 文件导入的科目）
- `QuestionBankItem` — id, topic, question_text, reference_answer, difficulty, tags（题库中的单题）
- `UserQuestionProgress` — id, user_id, question_id, is_bookmarked, is_mastered, is_review, user_answer（用户刷题进度）
