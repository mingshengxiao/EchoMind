# EchoMind

EchoMind 是一个基于简历的 AI 面试问答网站。当前阶段先实现第一个菜单「简历问答」：上传简历后生成 50–100 个贴合经历的面试题。

## 技术栈

- Frontend: Next.js App Router + React + TypeScript + Tailwind CSS
- Backend: Python FastAPI + LangChain
- AI: DeepSeek V4 / OpenAI-compatible API，通过环境变量配置
- Database: MongoDB（未配置时自动使用内存 mock repository）

## 本地启动

### 1. 后端

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows bash
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```

访问：

- Health: http://localhost:8000/health
- API Docs: http://localhost:8000/docs

如果 `.env` 中没有 `DEEPSEEK_API_KEY`，后端会使用本地 mock 生成器返回 50–100 个问题，便于无密钥时验证完整流程。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

访问：http://localhost:3000

## 环境变量

复制 `.env.example` 并按需设置：

- `DEEPSEEK_API_KEY`: DeepSeek API Key
- `DEEPSEEK_BASE_URL`: OpenAI-compatible base URL，默认 `https://api.deepseek.com`
- `DEEPSEEK_MODEL`: 默认 `deepseek-v4-flash`
- `MONGODB_URL`: MongoDB 连接串；留空则使用内存 mock
- `JWT_SECRET`: 生产环境必须替换
- `NEXT_PUBLIC_API_BASE_URL`: 前端访问后端的地址

## 功能说明

- 游客模式：不登录也能上传简历并生成问题；游客操作不保存到数据库。
- 登录模式：支持用户名/密码注册登录；上传简历和生成问题会保存到当前 repository（mock 或 MongoDB）。
- 简历格式：PDF、DOCX、Markdown、TXT，默认最大 10MB。

## 部署建议

- 前端部署到 Vercel，设置 `NEXT_PUBLIC_API_BASE_URL` 为后端公网地址。
- 后端保持标准 FastAPI/ASGI 服务，建议部署到 Render、Railway 或 Fly.io。
- MongoDB 可使用 MongoDB Atlas；设置 `MONGODB_URL` 后后端会自动切换到 MongoDB repository。
