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

### 简历问答
- 游客模式：不登录也能上传简历并生成问题；游客操作不保存到数据库。
- 登录模式：支持用户名/密码注册登录；上传简历和生成问题会保存到当前 repository（mock 或 MongoDB）。
- 简历格式：PDF、DOCX、Markdown、TXT，默认最大 10MB。

### 面试题集

系统支持从 Markdown 文件批量导入面试题，导入的题目可在 `/questions-bank` 页面浏览、筛选和练习。

#### 导入方式

```bash
cd backend
.venv/Scripts/python -m scripts.import_questions --dir <题库目录路径>
```

#### 文件格式要求

每个 `.md` 文件作为一个科目（文件名不含扩展名即科目名），支持以下两种格式：

**格式 A — 编号列表式**（适用于每道题以数字编号开头）：

```markdown
## 主题分类（可选）

1. 问题描述？
   - 答案内容
   - 可以有多个答案要点

2. 另一个问题？
   - 对应的答案
```

**格式 B — 标题问答式**（适用于每道题以 `###` 或 `##` 标题开头）：

```markdown
### 1. 问题标题？

✅ 满分标准答案

答案的详细内容，可以包含多段落。

- 要点 1
- 要点 2

💻 代码演示（可选）

```代码块```

### 2. 下一个问题？
```

也支持 `## 问题 N：` 搭配 `### 答案` 的格式：

```markdown
## 问题 1：问题标题？

### 答案
- 答案要点 1
- 答案要点 2

## 问题 2：下一个标题？
```

#### 注意事项

- 文件编码必须为 **UTF-8**
- 文件名即为分类名，如 `前端基础.md` → 科目「前端基础」
- 导入会清空已有题库数据后重新写入（幂等操作）
- 可选参数 `--ai-enrich` 可调用 AI 自动补全难度和标签字段
- 支持的常见科目：前端基础、前端性能优化、AI Agent 系列、RAG、Vue3、算法题等
- 首次导入：`--dir D:/xiao/projects/dailly-prompt/面试`（如已存在该目录）

## 部署建议

- 前端部署到 Vercel，设置 `NEXT_PUBLIC_API_BASE_URL` 为后端公网地址。
- 后端保持标准 FastAPI/ASGI 服务，建议部署到 Render、Railway 或 Fly.io。
- MongoDB 可使用 MongoDB Atlas；设置 `MONGODB_URL` 后后端会自动切换到 MongoDB repository。
