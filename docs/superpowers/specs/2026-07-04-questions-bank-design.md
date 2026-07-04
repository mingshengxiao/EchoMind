# 面试题集（Questions Bank）设计文档

## 概述

为 EchoMind 新增"面试题集"功能模块，将已有的 md 格式面试题库导入 MongoDB，提供类似面试鸭的刷题浏览体验。支持按科目浏览、筛选搜索、收藏标记、进度追踪等交互。

## 阶段规划

- **Phase 1（本期实现）**：题库导入 + 浏览模式 + 用户交互（收藏/掌握/待复习/作答）
- **Phase 2（后续）**：答题考试模式 + 错题集 + 学习统计

---

## 一、数据模型

### QuestionBankTopic（科目）

从导入的 md 文件名自动生成，扁平结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | str | UUID |
| name | str | 科目名，对应 md 文件名（不含扩展名） |
| question_count | int | 该科目下题目数（冗余统计） |
| created_at | datetime | |

### QuestionBankItem（题库题目）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | str | UUID |
| topic | str | 科目名，与 QuestionBankTopic.name 对应 |
| question_text | str | 题目内容 |
| reference_answer | str | 参考回答 |
| difficulty | Literal["junior","mid","senior"] | 难度 |
| tags | list[str] | 标签（如"JS基础"、"事件循环"） |
| source_file | str | 来源文件名 |
| created_at | datetime | |

### UserQuestionProgress（用户做题进度）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | str | UUID |
| user_id | str | 关联 User |
| question_id | str | 关联 QuestionBankItem |
| is_bookmarked | bool | 是否收藏 |
| is_mastered | bool | 是否已掌握 |
| is_review | bool | 是否标记待复习 |
| user_answer | str | 用户输入的答案 |
| answered_at | datetime \| None | 最近作答时间 |
| updated_at | datetime | |

---

## 二、后端 API

### 路由前缀：`/api/v1/questions-bank`

按 url 前缀在 `backend/app/api/v1/questions_bank.py` 中实现，通过 `router = APIRouter(prefix="/questions-bank", tags=["questions-bank"])` 挂载。

### 接口列表

```
GET    /topics                                # 科目列表（含各科题目数）
GET    /questions                             # 题目列表，支持筛选
       ?topic=前端基础&difficulty=mid&search=Promise&page=1&size=20
GET    /questions/:id                         # 题目详情（含当前用户的状态）
POST   /questions/:id/bookmark                # 切换收藏
POST   /questions/:id/master                  # 切换掌握状态
POST   /questions/:id/review                  # 切换待复习
POST   /questions/:id/answer                  # 保存用户答案 {answer: string}
GET    /progress                              # 用户进度统计
```

### 鉴权

- 读接口（topics, questions）：允许游客访问（无需 token）
- 写接口（bookmark, master, review, answer）：需要 JWT 认证
- progress：需要 JWT 认证

### Repository 新增方法

在 `AbstractRepository` 中新增：

```python
# QuestionBankTopic
async def get_question_bank_topics(self) -> list[QuestionBankTopic]: ...
async def get_or_create_topic(self, name: str) -> QuestionBankTopic: ...

# QuestionBankItem
async def save_question_bank_items(self, items: list[QuestionBankItem]) -> list[QuestionBankItem]: ...
async def get_question_bank_items(
    self, topic: str | None = None, difficulty: str | None = None,
    search: str | None = None, page: int = 1, size: int = 20
) -> tuple[list[QuestionBankItem], int]: ...
async def get_question_bank_item_by_id(self, item_id: str) -> QuestionBankItem | None: ...

# UserQuestionProgress
async def get_user_progress(self, user_id: str, question_id: str) -> UserQuestionProgress | None: ...
async def upsert_user_progress(self, progress: UserQuestionProgress) -> UserQuestionProgress: ...
async def get_user_progress_stats(self, user_id: str) -> dict: ...
async def get_user_progress_batch(
    self, user_id: str, question_ids: list[str]
) -> dict[str, UserQuestionProgress]: ...
```

---

## 三、导入脚本

`backend/scripts/import_questions.py`

### 功能

1. 扫描指定目录下的所有 `.md` 文件
2. 根据文件名确定 `topic`
3. 解析文件内容，提取 question_text + reference_answer
4. 批量写入 MongoDB

### 解析规则

支持两种常见格式（兼容现有题库文件的变体）：

**格式 A — 编号列表式**（常见于 Agent 开发面试题）：
```
## 主题名
1. 问题内容？
   - 答案内容
2. 问题内容？
   - 答案内容
```

**格式 B — 标题问答式**（常见于前端基础、RAG）：
```
### N. 问题标题？
✅ 答案内容
```
或
```
## 问题 N：标题
### 答案
内容
```

### 运行方式

```bash
cd backend
.venv/Scripts/python -m scripts.import_questions \
  --dir D:/xiao/projects/dailly-prompt/面试
```

### AI 辅助补全

可选参数 `--ai-enrich` 调用 LLM 为导入的题目补全 `difficulty` 和 `tags` 字段。

---

## 四、前端页面

### 路由

新增 `frontend/src/app/questions-bank/page.tsx`（Client Component）

导航栏添加新菜单项"面试题集"，链接到 `/questions-bank`

### 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  面试题集                          [搜索框🔍] [难度▼]    │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  全部科目     │  前端基础                               │
│  (23科)      │  ┌─ #1 ─────────── ⭐ ✓ 🔄 ──────────┐  │
│              │  │ JS微任务和宏任务的执行顺序...        │  │
│  ├ 前端基础   │  │ [junior] [JS基础]                   │  │
│  ├ 前端性能   │  │ ── 显示参考回答 ──                  │  │
│  ├ 微前端     │  └────────────────────────────────────┘  │
│  ├ AI Agent  │  ┌─ #2 ──────────────────────────────┐  │
│  ├ RAG       │  │ Promise 有几种状态？...             │  │
│  ├ 算法题     │  │ [junior] [JS基础]                   │  │
│  ├ Vue3      │  └────────────────────────────────────┘  │
│  ├ ...       │                                           │
│              │  < 1 2 3 ... 20 >                         │
│  ──────────  │                                           │
│  进度概览     │                                           │
│  ⭐ 收藏 12   │                                           │
│  ✓ 掌握 8    │                                           │
│  🔄 待复习 3  │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### 组件拆分

| 组件 | 说明 |
|------|------|
| `QuestionBankPage` | 主页面，布局协调 |
| `TopicSidebar` | 左侧科目树 + 进度概览 |
| `QuestionFilterBar` | 搜索 + 难度筛选 |
| `QuestionBankCard` | 题目卡片（复用现有 QuestionCard 风格，增加状态按钮） |
| `AnswerDialog` | 作答浮层 |

### 交互细节

- **切换科目**：点击左侧科目，右侧加载该科目题目列表
- **筛选**：搜索框实时过滤 + 难度下拉筛选，与当前科目联动
- **分页**：每页 20 题，底部页码
- **展开答案**：点击"显示参考回答"展开/收起
- **状态按钮**：
  - ⭐ 收藏 → 点击切换收藏状态，图标高亮
  - ✓ 已掌握 → 点击切换，图标高亮
  - 🔄 待复习 → 点击切换，图标高亮
  - 三个状态互相独立，可同时标记
- **作答**：点击"作答"按钮弹出浮层，用户输入答案后保存
- **进度统计**：左侧底部显示当前用户的收藏/掌握/待复习总数
- **未登录**：允许浏览，但状态按钮和作答不可用（提示登录）

### API 封装

在 `frontend/src/lib/api.ts` 中新增 `api.questionsBank.*` 方法：

```
questionsBank: {
  listTopics: () => ...
  listQuestions: (params) => ...
  getQuestion: (id) => ...
  toggleBookmark: (id) => ...
  toggleMastered: (id) => ...
  toggleReview: (id) => ...
  saveAnswer: (id, answer) => ...
  getProgress: () => ...
}
```

---

## 五、与现有架构的关系

### 后端

- `AbstractRepository` 新增接口方法
- `MockRepository` 同步实现
- `MongoRepository` 同步实现，新增 questions_bank_items 和 user_question_progress 两个 collection
- 新建 `backend/app/api/v1/questions_bank.py` 路由文件
- 新域名模型在 `backend/app/models/domain.py` 中新增类
- 新 API Schema 在 `backend/app/models/schemas.py` 中新增

### 前端

- 新建 `/questions-bank` 路由
- 复用现有 `QuestionCard` 的样式风格，增强交互按钮
- `SiteHeader` 导航栏新增"面试题集"菜单项
- `api.ts` 新增 `questionsBank` 模块
- `types/index.ts` 新增类型定义

### 数据库（MongoDB）

新增两个 collection：
- `question_bank_items` — 索引：topic, difficulty, created_at
- `user_question_progress` — 索引：(user_id, question_id) 复合唯一索引

---

## 六、前端类型定义（types/index.ts 新增）

```typescript
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

---

## 七、未包含在 Phase 1 的内容

- ⏳ 答题考试模式
- ⏳ 错题集
- ⏳ 学习统计数据图表
- ⏳ 管理后台（Web 界面上传/编辑题目）
- ⏳ AI 按需生成补充题目
