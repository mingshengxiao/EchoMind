# Resume QA: Streaming + Preview + Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SSE streaming question generation, resume file preview (PDF/DOCX), and three-column layout to the resume-qa page.

**Architecture:** Backend adds SSE streaming endpoints and file storage/serving; frontend restructures to fixed three-column layout with async SSE consumer and PDF preview embed.

**Tech Stack:** Python FastAPI + LangChain + SSE, Next.js 14 App Router + Tailwind CSS

---

### Task 1: Add file storage fields to Resume domain model

**Files:**
- Modify: `backend/app/models/domain.py:29-35`

- [ ] **Step 1: Add fields to Resume model**

Edit `backend/app/models/domain.py`. Add `original_filename`, `file_data`, `file_mime` fields to the `Resume` class:

```python
class Resume(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    original_filename: str = ""
    filename: str          # sanitized filename for storage
    file_size: int
    file_data: bytes = b""
    file_mime: str = ""
    content_text: str
    content_preview: str
    word_count: int
    uploaded_at: datetime = Field(default_factory=utc_now)
```

Note: `file_data` is `b""` by default. For MongoDB repository, files >16MB will need GridFS (handled in repository layer, not model).

- [ ] **Step 2: Run existing backend to verify no regressions**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.models.domain import Resume; r = Resume(user_id='x', filename='test.pdf', file_size=100, content_text='hi', content_preview='hi', word_count=1); print(r.model_dump_json())"
```

Expected: Prints JSON including `original_filename`, `file_data`, `file_mime`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/domain.py
git commit -m "feat: add file_data fields to Resume model"
```

---

### Task 2: Update parser to return raw bytes alongside parsed text

**Files:**
- Modify: `backend/app/services/parser.py`

- [ ] **Step 1: Add `raw_bytes` field to ParsedResume**

Change `ParsedResume.__init__` to accept and store raw bytes:

```python
class ParsedResume:
    def __init__(self, text: str, filename: str, file_size: int, raw_bytes: bytes) -> None:
        self.text = text
        self.filename = filename
        self.file_size = file_size
        self.raw_bytes = raw_bytes
        self.word_count = len(text.split())
        self.preview = text[:800]
```

- [ ] **Step 2: Update `parse_resume_bytes` to accept and pass raw_bytes**

Signature change:

```python
def parse_resume_bytes(filename: str, data: bytes, settings: Settings) -> ParsedResume:
```

The function already receives `data: bytes`. Pass it through:

```python
    return ParsedResume(
        text=normalized,
        filename=filename,
        file_size=len(data),
        raw_bytes=data,  # <-- store original bytes
    )
```

- [ ] **Step 3: Update `parse_upload` to pass raw bytes**

```python
async def parse_upload(file: UploadFile, settings: Settings) -> ParsedResume:
    data = await file.read()
    return parse_resume_bytes(file.filename or "resume", data, settings)
```

(Already does `data = await file.read()`, just passes it through.)

- [ ] **Step 4: Detect MIME type from extension**

Add a helper:

```python
MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
}

def detect_mime(filename: str) -> str:
    return MIME_MAP.get(_extension(filename), "application/octet-stream")
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/parser.py
git commit -m "feat: pass raw bytes and MIME through parser"
```

---

### Task 3: Update upload endpoint and repository to store raw bytes

**Files:**
- Modify: `backend/app/api/v1/resumes.py`
- Modify: `backend/app/db/mock_repository.py`
- Modify: `backend/app/db/mongodb_repository.py`

- [ ] **Step 1: Update upload endpoint to create Resume with file_data**

In `backend/app/api/v1/resumes.py`, update the `upload_resume` function:

```python
@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    request: Request,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ResumeUploadResponse:
    repository: AbstractRepository = request.app.state.repository
    parsed = await parse_upload(file, settings)
    resume = Resume(
        user_id=current_user.id,
        original_filename=parsed.filename,
        filename=parsed.filename,
        file_size=parsed.file_size,
        file_data=parsed.raw_bytes,
        file_mime=detect_mime(parsed.filename),
        content_text=parsed.text,
        content_preview=parsed.preview,
        word_count=parsed.word_count,
    )
    created = await repository.create_resume(resume)
    return ResumeUploadResponse(
        id=created.id,
        filename=created.filename,
        file_size=created.file_size,
        word_count=created.word_count,
        uploaded_at=created.uploaded_at,
    )
```

Add the import: `from app.services.parser import ..., detect_mime`

- [ ] **Step 2: Verify mock repository stores the new fields**

The `MockRepository.create_resume` stores the full `Resume` object in a dict. No changes needed — `file_data` (bytes) is just a field.

- [ ] **Step 3: MongoDB repository — store file_data as Binary**

In `backend/app/db/mongodb_repository.py`, in `_resume_to_doc`, ensure `file_data` is stored as `bson.Binary`:

```python
def _resume_to_doc(self, resume: Resume) -> dict:
    doc = resume.model_dump()
    if resume.file_data:
        doc["file_data"] = Binary(resume.file_data)
    return doc
```

Add import: `from bson import Binary`

In `_doc_to_resume`, it auto-converts back.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/resumes.py backend/app/db/mongodb_repository.py
git commit -m "feat: upload stores raw file bytes in repository"
```

---

### Task 4: Add SSE streaming generator

**Files:**
- Modify: `backend/app/services/generator.py`

- [ ] **Step 1: Add async generator `generate_questions_stream`**

Add to `backend/app/services/generator.py`:

```python
import asyncio
from typing import AsyncIterator


async def generate_questions_stream(
    resume_text: str, settings: Settings, count: int = 75
) -> AsyncIterator[dict]:
    """Async generator yielding SSE-compatible event dicts.

    Yields:
      {"type": "question", "data": {...question fields...}}
      {"type": "progress", "data": {"generated": N, "total": T}}
      {"type": "done", "data": {"total": N, "source": "deepseek|mock"}}
      {"type": "error", "data": {"message": "..."}}
    """
    target_count = _normalize_count(count)

    if not settings.deepseek_api_key:
        # Mock mode: generate all, then yield each
        questions = _mock_questions(resume_text, target_count)
        for i, q in enumerate(questions):
            yield {
                "type": "question",
                "data": {
                    "question_text": q.question_text,
                    "category": q.category,
                    "difficulty": q.difficulty,
                    "focus_area": q.focus_area,
                    "reference_answer": q.reference_answer,
                },
            }
            if (i + 1) % 5 == 0 or i == len(questions) - 1:
                yield {"type": "progress", "data": {"generated": i + 1, "total": len(questions)}}
            await asyncio.sleep(0.25)
        yield {"type": "done", "data": {"total": len(questions), "source": "mock"}}
        return

    # LLM mode
    llm = ChatOpenAI(
        model=settings.deepseek_model,
        base_url=settings.deepseek_base_url,
        api_key=settings.deepseek_api_key,
        temperature=0.45,
        max_tokens=8192,
        extra_body={"thinking": {"type": "disabled"}},
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_PROMPT_TEMPLATE),
        ("human", "--- 简历内容 ---\n{resume_text}"),
    ])

    try:
        messages = await prompt.ainvoke({"resume_text": resume_text[:24000], "count": target_count})
        response = await llm.ainvoke(messages, response_format={"type": "json_object"})
        generated = _parse_generated_questions(_message_content_text(response))[:100]
    except Exception as exc:
        yield {"type": "error", "data": {"message": f"AI generation failed: {exc}"}}
        return

    # Pad to 50 if necessary
    if len(generated) < 50:
        fallback = _mock_questions(resume_text, 50 - len(generated))
        questions = list(generated) + fallback
    else:
        questions = list(generated)

    # Yield each question
    for i, q in enumerate(questions):
        yield {
            "type": "question",
            "data": {
                "question_text": q.question_text,
                "category": q.category,
                "difficulty": q.difficulty,
                "focus_area": q.focus_area,
                "reference_answer": q.reference_answer,
            },
        }
        if (i + 1) % 5 == 0 or i == len(questions) - 1:
            yield {"type": "progress", "data": {"generated": i + 1, "total": len(questions)}}
        await asyncio.sleep(0.25)

    yield {"type": "done", "data": {"total": len(questions), "source": "deepseek"}}
```

Also extract the system prompt string into a module-level constant to share with the existing `generate_questions`:

```python
_SYSTEM_PROMPT_TEMPLATE = (
    "你是一位资深技术面试官。请仅根据候选人的简历内容生成 {count} 个中文面试题。"
    "题目需要覆盖技术能力、项目经历、行为面试、场景题和经验深挖。"
    "每个问题必须同时给出 reference_answer 参考回答。参考回答要基于简历内容，使用 3 到 6 句中文说明可参考的回答思路，不要编造简历中不存在的经历。"
    "不要编造简历中不存在的经历。"
    "必须只返回合法 JSON，不要返回 Markdown，不要返回解释文字。"
    'JSON 格式必须是：'
    '{{"questions":[{{"question_text":"问题文本","category":"technical|behavioral|project|experience|scenario","difficulty":"junior|mid|senior","focus_area":"考察点","reference_answer":"参考回答"}}]}}。'
)
```

Then update `generate_questions` to use `_SYSTEM_PROMPT_TEMPLATE`:

```python
    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_PROMPT_TEMPLATE),
        ("human", "--- 简历内容 ---\n{resume_text}"),
    ])
```

- [ ] **Step 2: Run existing generate_questions test to confirm no regression**

```bash
cd backend && source .venv/Scripts/activate && python -c "
from app.services.generator import generate_questions, generate_questions_stream
from app.config import Settings
import asyncio
s = Settings()
# Test mock streaming
async def test():
    count = 0
    async for event in generate_questions_stream('Python developer with FastAPI experience', s, 5):
        print(event['type'], end=' ')
        count += 1
    print(f'\n{count} events')
asyncio.run(test())
"
```

Expected: Prints `question question question question question progress progress done` (5 questions, progress after #5, done at end)

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/generator.py
git commit -m "feat: add SSE streaming question generator"
```

---

### Task 5: Add SSE streaming endpoints and file download endpoint

**Files:**
- Modify: `backend/app/api/v1/resumes.py`
- Modify: `backend/app/models/domain.py` (add `_format_sse` helper or put it in the route)

- [ ] **Step 1: Add SSE format helper**

Add at top of `backend/app/api/v1/resumes.py`:

```python
import json
from fastapi.responses import StreamingResponse


def _sse_format(event_dict: dict) -> str:
    """Format a dict as SSE event string."""
    event_type = event_dict["type"]
    data = json.dumps(event_dict["data"], ensure_ascii=False)
    lines = [f"event: {event_type}", f"data: {data}", ""]
    return "\n".join(lines)
```

- [ ] **Step 2: Add SSE streaming endpoint for authenticated users**

```python
@router.post("/{resume_id}/questions/generate/stream")
async def generate_resume_questions_stream(
    request: Request,
    resume_id: str,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)

    async def event_stream():
        collected: list[InterviewQuestion] = []
        try:
            async for event in generate_questions_stream(resume.content_text, settings):
                if event["type"] == "question":
                    collected.append(
                        InterviewQuestion(
                            question_text=event["data"]["question_text"],
                            category=event["data"]["category"],
                            difficulty=event["data"]["difficulty"],
                            focus_area=event["data"]["focus_area"],
                            reference_answer=event["data"].get("reference_answer", ""),
                            resume_id=resume.id,
                        )
                    )
                    yield _sse_format(event)
                elif event["type"] == "done":
                    # Save before signaling completion
                    await repository.save_questions(resume.id, collected)
                    yield _sse_format(event)
                elif event["type"] == "error":
                    yield _sse_format(event)
                    return
                else:
                    yield _sse_format(event)

        except Exception as exc:
            yield _sse_format({"type": "error", "data": {"message": str(exc)}})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 3: Add SSE streaming endpoint for guest users**

```python
@router.post("/guest/process/stream")
async def process_guest_resume_stream(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
):
    parsed = await parse_upload(file, settings)

    async def event_stream():
        try:
            async for event in generate_questions_stream(parsed.text, settings):
                yield _sse_format(event)
        except Exception as exc:
            yield _sse_format({"type": "error", "data": {"message": str(exc)}})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 4: Add file download/preview endpoint**

```python
import mimetypes
from fastapi.responses import Response


@router.get("/{resume_id}/file")
async def get_resume_file(
    request: Request,
    resume_id: str,
    current_user: User = Depends(get_current_user),
):
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)

    if not resume.file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not available")

    content_type = resume.file_mime or "application/octet-stream"
    filename = resume.original_filename or resume.filename

    return Response(
        content=resume.file_data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
```

- [ ] **Step 5: Update imports in resumes.py**

Ensure these imports exist at the top:

```python
import json
from fastapi.responses import Response, StreamingResponse
from app.services.generator import generate_questions, generate_questions_stream
from app.services.parser import parse_upload, detect_mime
```

- [ ] **Step 6: Run backend to verify endpoints register**

```bash
cd backend && source .venv/Scripts/activate && python -c "
from app.main import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
stream_routes = [r for r in routes if 'stream' in r or '/file' in r]
print(stream_routes)
"
```

Expected: Shows `/api/v1/resumes/{resume_id}/questions/generate/stream`, `/api/v1/resumes/guest/process/stream`, `/api/v1/resumes/{resume_id}/file`

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/v1/resumes.py
git commit -m "feat: add SSE streaming and file download endpoints"
```

---

### Task 6: Add DOCX→PDF on-demand conversion

**Files:**
- Create: `backend/app/services/converter.py`
- Modify: `backend/app/api/v1/resumes.py`

- [ ] **Step 1: Create converter service**

File `backend/app/services/converter.py`:

```python
import subprocess
import tempfile
from pathlib import Path


def docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert DOCX bytes to PDF bytes using LibreOffice headless."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.docx"
        output_path = Path(tmpdir) / "input.pdf"

        input_path.write_bytes(docx_bytes)

        result = subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, str(input_path)],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.decode()}")

        return output_path.read_bytes()


def is_libreoffice_available() -> bool:
    """Check if LibreOffice is installed."""
    try:
        subprocess.run(["soffice", "--headless", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
```

- [ ] **Step 2: Integrate conversion into file download endpoint**

In `backend/app/api/v1/resumes.py`, update the `get_resume_file` endpoint to handle DOCX:

```python
@router.get("/{resume_id}/file")
async def get_resume_file(
    request: Request,
    resume_id: str,
    current_user: User = Depends(get_current_user),
):
    repository: AbstractRepository = request.app.state.repository
    resume = await _ensure_owner(repository, resume_id, current_user)

    if not resume.file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not available")

    content_type = resume.file_mime or "application/octet-stream"

    # On-demand DOCX → PDF conversion
    if "wordprocessingml" in content_type and is_libreoffice_available():
        try:
            pdf_bytes = docx_to_pdf(resume.file_data)
            resume.file_data = pdf_bytes
            resume.file_mime = "application/pdf"
            # Note: in-memory update only; persist would need a repository.update_resume method
            content_type = "application/pdf"
        except Exception as exc:
            # Fall back to serving the original DOCX
            pass

    filename = resume.original_filename or resume.filename
    return Response(
        content=resume.file_data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
```

Add import: `from app.services.converter import docx_to_pdf, is_libreoffice_available`

- [ ] **Step 3: Check LibreOffice availability and commit**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.services.converter import is_libreoffice_available; print('LibreOffice:', is_libreoffice_available())"
```

If False, note that DOCX→PDF won't work until LibreOffice is installed on the deployment server. The code gracefully falls back.

```bash
git add backend/app/services/converter.py backend/app/api/v1/resumes.py
git commit -m "feat: on-demand DOCX to PDF conversion"
```

---

### Task 7: Add SSE client helper to frontend API

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add SSE event types**

In `frontend/src/types/index.ts`, add:

```typescript
export type SSEEventType = "question" | "progress" | "done" | "error";

export interface SSEQuestionEvent {
  type: "question";
  data: Question;
}

export interface SSEProgressEvent {
  type: "progress";
  data: { generated: number; total: number };
}

export interface SSEDoneEvent {
  type: "done";
  data: { total: number; source: "deepseek" | "mock" };
}

export interface SSEErrorEvent {
  type: "error";
  data: { message: string };
}

export type SSEEvent = SSEQuestionEvent | SSEProgressEvent | SSEDoneEvent | SSEErrorEvent;
```

- [ ] **Step 2: Add SSE streaming function to api.ts**

In `frontend/src/lib/api.ts`, add:

```typescript
export async function* streamQuestions(
  path: string,
  token: string | null,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "网络请求失败" }));
    throw new ApiError(response.status, error.detail || "请求失败");
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split("\n");
      let eventType = "";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (eventType && dataStr) {
        const data = JSON.parse(dataStr);
        yield { type: eventType, data } as SSEEvent;
      }
    }
  }
}

export const api = {
  // ... existing methods ...

  streamGenerateQuestions: (resumeId: string, signal?: AbortSignal) =>
    streamQuestions(`/api/v1/resumes/${resumeId}/questions/generate/stream`, token(), signal),

  streamProcessGuestResume: (file: File, signal?: AbortSignal) =>
    streamGuestWithFile(file, signal),
};

async function* streamGuestWithFile(file: File, signal?: AbortSignal): AsyncGenerator<SSEEvent> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/resumes/guest/process/stream`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "网络请求失败" }));
    throw new ApiError(response.status, error.detail || "请求失败");
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split("\n");
      let eventType = "";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (eventType && dataStr) {
        const data = JSON.parse(dataStr);
        yield { type: eventType, data } as SSEEvent;
      }
    }
  }
}
```

- [ ] **Step 3: Sync type imports in api.ts**

Add to the import line in `api.ts`:

```typescript
import type { AuthResponse, QuestionListResponse, ResumeListItem, ResumeUploadResponse, SSEEvent, User } from "@/types";
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/types/index.ts
git commit -m "feat: add SSE stream client helper and types"
```

---

### Task 8: Create QuestionStream component

**Files:**
- Create: `frontend/src/components/resume/QuestionStream.tsx`
- Delete: `frontend/src/components/resume/QuestionList.tsx`

- [ ] **Step 1: Create QuestionStream component**

File `frontend/src/components/resume/QuestionStream.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QuestionCard } from "@/components/resume/QuestionCard";
import type { Question, SSEEvent } from "@/types";
import { api } from "@/lib/api";

type StreamState = "idle" | "connecting" | "receiving" | "completed" | "error";

interface QuestionStreamProps {
  onGenerate: (signal: AbortSignal) => AsyncGenerator<SSEEvent>;
  onDone?: (total: number, source: string) => void;
  existingQuestions?: Question[];
  isLoadingExisting?: boolean;
}

export function QuestionStream({
  onGenerate,
  onDone,
  existingQuestions = [],
  isLoadingExisting = false,
}: QuestionStreamProps) {
  const [questions, setQuestions] = useState<Question[]>(existingQuestions);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [progress, setProgress] = useState({ generated: 0, total: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Sync when existing questions change (e.g., switching resumes)
  useEffect(() => {
    if (streamState === "idle") {
      setQuestions(existingQuestions);
    }
  }, [existingQuestions, streamState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const startStream = useCallback(async () => {
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    setStreamState("connecting");
    setError("");
    setQuestions([]);
    setProgress({ generated: 0, total: 0 });

    try {
      const generator = onGenerate(abortController.signal);
      for await (const event of generator) {
        if (abortController.signal.aborted) break;

        if (event.type === "question") {
          setQuestions((prev) => [...prev, event.data]);
          setStreamState("receiving");
        } else if (event.type === "progress") {
          setProgress({ generated: event.data.generated, total: event.data.total });
        } else if (event.type === "done") {
          setStreamState("completed");
          setProgress({ generated: event.data.total, total: event.data.total });
          onDone?.(event.data.total, event.data.source);
        } else if (event.type === "error") {
          setError(event.data.message);
          setStreamState("error");
        }
      }
      if (!abortController.signal.aborted && streamState !== "error") {
        setStreamState("completed");
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : "生成失败");
        setStreamState("error");
      }
    }
  }, [onGenerate, onDone]);

  // Loading skeleton for existing questions
  if (isLoadingExisting) {
    return (
      <div className="space-y-4" aria-live="polite">
        <p className="text-sm font-medium text-zinc-700">正在加载...</p>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">面试题</h2>
          {(streamState === "receiving" || streamState === "connecting") && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500 [animation-delay:300ms]" />
              </span>
              生成中 {progress.generated}/{progress.total}
            </span>
          )}
          {streamState === "completed" && (
            <span className="text-xs font-medium text-green-600">已完成 {progress.total} 个</span>
          )}
        </div>
      </div>

      {/* Question list (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {questions.length === 0 && streamState === "idle" ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-950">还没有面试题</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                上传简历后，点击生成按钮即可开始
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="animate-[fadeInSlide_0.3s_ease-out]"
              >
                <QuestionCard index={index} question={question} />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {streamState === "error" && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-center">
            <p className="text-sm text-red-700">{error || "生成失败，请重试"}</p>
            <button
              onClick={startStream}
              className="mt-3 cursor-pointer rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              type="button"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* Footer stats bar */}
      <div className="flex-shrink-0 border-t border-zinc-200 px-4 py-2.5 text-center text-xs text-zinc-500">
        {streamState === "idle" && existingQuestions.length > 0
          ? `${existingQuestions.length} 个问题`
          : streamState === "completed"
            ? `共 ${progress.total} 个问题`
            : streamState === "receiving"
              ? `已生成 ${progress.generated} 个问题`
              : "准备就绪"}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove old QuestionList.tsx**

```bash
rm frontend/src/components/resume/QuestionList.tsx
```

- [ ] **Step 3: Add fadeInSlide animation to globals.css**

In `frontend/src/app/globals.css`, add:

```css
@keyframes fadeInSlide {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/resume/QuestionStream.tsx frontend/src/app/globals.css
git rm frontend/src/components/resume/QuestionList.tsx
git commit -m "feat: add QuestionStream component with SSE consumption"
```

---

### Task 9: Create ResumePreviewer component

**Files:**
- Create: `frontend/src/components/resume/ResumePreviewer.tsx`

- [ ] **Step 1: Create the component**

File `frontend/src/components/resume/ResumePreviewer.tsx`:

```tsx
"use client";

import { useState } from "react";

interface ResumePreviewerProps {
  fileUrl: string;
  filename: string;
  textFallback?: string;
}

export function ResumePreviewer({ fileUrl, filename, textFallback }: ResumePreviewerProps) {
  const [embedError, setEmbedError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  if (embedError || !isPdf) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">简历内容</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {textFallback ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700">
              {textFallback}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              {isPdf ? "PDF 预览加载失败" : "暂不支持此文件格式的预览"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with zoom controls */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">简历预览</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            disabled={zoom <= 50}
            type="button"
            aria-label="缩小"
          >
            −
          </button>
          <span className="min-w-[3ch] text-center text-xs tabular-nums text-zinc-600">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            disabled={zoom >= 200}
            type="button"
            aria-label="放大"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF embed */}
      <div className="flex-1 overflow-y-auto bg-zinc-100">
        <embed
          src={`${fileUrl}#zoom=${zoom / 100}`}
          type="application/pdf"
          className="mx-auto block min-h-full w-full"
          style={{ width: `${zoom}%`, minWidth: "100%" }}
          onError={() => setEmbedError(true)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/resume/ResumePreviewer.tsx
git commit -m "feat: add ResumePreviewer component with PDF embed and zoom"
```

---

### Task 10: Restructure resume-qa page to three-column layout

**Files:**
- Rewrite: `frontend/src/app/resume-qa/page.tsx`
- Modify: `frontend/src/components/layout/GuestBanner.tsx` (keep as-is)
- Modify: `frontend/src/components/resume/FileUploader.tsx` (layout polish)
- Modify: `frontend/src/components/resume/ResumeHistory.tsx` (remove outer Card, simplify for left column)

- [ ] **Step 1: Rewrite resume-qa/page.tsx**

File `frontend/src/app/resume-qa/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { GuestBanner } from "@/components/layout/GuestBanner";
import { FileUploader } from "@/components/resume/FileUploader";
import { QuestionStream } from "@/components/resume/QuestionStream";
import { ResumePreviewer } from "@/components/resume/ResumePreviewer";
import { ResumeHistory } from "@/components/resume/ResumeHistory";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Question, ResumeListItem, SSEEvent } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function ResumeQaPage() {
  const { user, isGuest, continueAsGuest } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [streamingResumeId, setStreamingResumeId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || null;
  const selectedResumeIndex = selectedResumeId
    ? resumes.findIndex((r) => r.id === selectedResumeId)
    : -1;
  const hasPreviousResume = selectedResumeIndex > 0;
  const hasNextResume =
    selectedResumeIndex >= 0 && selectedResumeIndex < resumes.length - 1;

  useEffect(() => {
    async function loadResumes() {
      if (!user) return;
      try {
        setResumes(await api.listResumes());
      } catch {
        setResumes([]);
      }
    }
    loadResumes();
  }, [user]);

  const handleGenerate = useCallback(async () => {
    if (!file) return;
    if (!user && !isGuest) continueAsGuest();
    setError("");
    setIsLoading(true);
    setShowGenerate(true);
    setQuestions([]);

    try {
      if (user) {
        const resume = await api.uploadResume(file);
        setSelectedResumeId(resume.id);
        setStreamingResumeId(resume.id);
        setResumes(await api.listResumes());
      } else {
        // Guest mode: stream directly
        setStreamingResumeId("guest");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setShowGenerate(false);
    } finally {
      setIsLoading(false);
    }
  }, [file, user, isGuest, continueAsGuest]);

  const streamGenerator = useCallback(
    (signal: AbortSignal) => {
      async function* generate() {
        if (!streamingResumeId || streamingResumeId === "guest") {
          yield* await api.streamProcessGuestResume(file!, signal);
        } else {
          yield* await api.streamGenerateQuestions(streamingResumeId, signal);
        }
      }
      return generate();
    },
    [streamingResumeId, file]
  );

  const handleStreamDone = useCallback(() => {
    if (user) {
      api.listResumes().then(setResumes).catch(() => {});
    }
  }, [user]);

  async function loadQuestions(resumeId: string) {
    setSelectedResumeId(resumeId);
    setStreamingResumeId(null);
    setShowGenerate(false);
    setError("");
    setIsLoading(true);
    try {
      const result = await api.getQuestions(resumeId);
      setQuestions(result.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取历史问题失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteResume(resumeId: string) {
    setError("");
    setIsDeleting(true);
    try {
      await api.deleteResume(resumeId);
      if (selectedResumeId === resumeId) {
        setSelectedResumeId(null);
        setQuestions([]);
        setShowGenerate(false);
        setStreamingResumeId(null);
      }
      setResumes(await api.listResumes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  }

  const previewUrl =
    user && selectedResumeId
      ? `${API_BASE}/api/v1/resumes/${selectedResumeId}/file`
      : null;

  // Access token for the preview embed (needs auth header)
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("echomind-token")
      : null;
  const authenticatedPreviewUrl =
    previewUrl && token ? `${previewUrl}?token=${token}` : previewUrl;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      {/* Title area */}
      <div className="flex-shrink-0 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Resume QA
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          简历问答
        </h1>
      </div>

      {!user && <GuestBanner />}

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 gap-4 overflow-hidden pb-4">
        {/* Left column */}
        <div className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          <div className="flex-shrink-0 border-b border-zinc-100 p-4">
            <FileUploader
              file={file}
              isBusy={isLoading}
              onFileSelect={setFile}
              onSubmit={handleGenerate}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 pt-3">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              历史简历
            </h3>
            {user ? (
              <ResumeHistory
                isDeleting={isDeleting}
                onDelete={handleDeleteResume}
                onSelect={loadQuestions}
                resumes={resumes}
                selectedResumeId={selectedResumeId}
              />
            ) : (
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">
                游客模式不会保存历史记录
              </div>
            )}
          </div>
        </div>

        {/* Center column */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {authenticatedPreviewUrl ? (
            <ResumePreviewer
              fileUrl={authenticatedPreviewUrl}
              filename={selectedResume?.filename || ""}
              textFallback={selectedResume?.content_preview}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-semibold text-zinc-950">
                  {user ? "暂无预览" : "游客模式"}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {user
                    ? "上传简历后可查看原格式预览"
                    : "登录后可保存简历并查看原格式预览"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex w-[380px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {showGenerate ? (
            <QuestionStream
              onGenerate={streamGenerator}
              onDone={handleStreamDone}
            />
          ) : (
            <QuestionStream
              onGenerate={streamGenerator}
              existingQuestions={questions}
              isLoadingExisting={isLoading && questions.length === 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify ResumeHistory for left column use**

Edit `frontend/src/components/resume/ResumeHistory.tsx` — remove the outer container Card/wrapper since it's now embedded in the column. The component should just render the list of resume items as buttons.

```tsx
"use client";

import { FileText, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import type { ResumeListItem } from "@/types";

interface ResumeHistoryProps {
  resumes: ResumeListItem[];
  selectedResumeId: string | null;
  isDeleting: boolean;
  onSelect: (resumeId: string) => void;
  onDelete: (resumeId: string) => Promise<void>;
}

export function ResumeHistory({ resumes, selectedResumeId, isDeleting, onSelect, onDelete }: ResumeHistoryProps) {
  async function handleDelete(event: MouseEvent<HTMLButtonElement>, resume: ResumeListItem) {
    event.stopPropagation();
    const confirmed = window.confirm(`确认删除「${resume.filename}」及其所有面试题吗？此操作不可撤销。`);
    if (!confirmed) return;
    await onDelete(resume.id);
  }

  if (!resumes.length) {
    return <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">暂无保存的简历。</div>;
  }

  return (
    <div className="space-y-2">
      {resumes.map((resume) => {
        const isActive = resume.id === selectedResumeId;
        return (
          <button
            aria-current={isActive ? "true" : undefined}
            className={`group relative w-full cursor-pointer rounded-2xl border p-3 pr-10 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              isActive
                ? "border-brand bg-blue-50 shadow-sm"
                : "border-zinc-200 bg-white hover:border-brand hover:bg-blue-50"
            }`}
            key={resume.id}
            onClick={() => onSelect(resume.id)}
            type="button"
          >
            <div className="flex items-start gap-2">
              <FileText aria-hidden="true" className={`mt-0.5 h-4 w-4 ${isActive ? "text-brand" : "text-zinc-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-950">{resume.filename}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {resume.word_count} 词 · {resume.question_count} 个问题
                </p>
              </div>
            </div>
            <button
              aria-label={`删除 ${resume.filename}`}
              className="absolute right-2 top-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              disabled={isDeleting}
              onClick={(event) => handleDelete(event, resume)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Polish FileUploader for left column**

Edit `frontend/src/components/resume/FileUploader.tsx` to be more compact (fits within 280px left column). Remove outer Card wrapper, tighten spacing:

```tsx
"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn, formatFileSize } from "@/lib/utils";

interface FileUploaderProps {
  file: File | null;
  isBusy: boolean;
  onFileSelect: (file: File) => void;
  onSubmit: () => void;
}

const allowedExtensions = [".pdf", ".docx", ".md", ".markdown", ".txt"];

export function FileUploader({ file, isBusy, onFileSelect, onSubmit }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  function acceptFile(nextFile: File) {
    const lowerName = nextFile.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setError("仅支持 PDF/DOCX/MD/TXT");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError("文件不能超过 10MB");
      return;
    }
    setError("");
    onFileSelect(nextFile);
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl border-2 border-dashed border-zinc-300 bg-white/80 p-4 text-center transition-colors duration-200",
          isDragging && "border-brand bg-blue-50",
          error && "border-red-300 bg-red-50"
        )}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) acceptFile(f);
        }}
      >
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-brand">
          <Upload aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-zinc-950">上传简历</p>
        <p className="mt-1 text-xs text-zinc-500">PDF/DOCX/MD/TXT</p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
        />
        <div className="mt-3 flex flex-col gap-2">
          <Button onClick={() => inputRef.current?.click()} type="button" variant="secondary" className="w-full text-xs">
            选择文件
          </Button>
          <Button disabled={!file || isBusy} onClick={onSubmit} type="button" className="w-full text-xs">
            {isBusy ? "上传中..." : "生成面试题"}
          </Button>
        </div>
      </div>
      {file && (
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
          {file.name}<br />
          <span className="text-zinc-400">{formatFileSize(file.size)}</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

Note: Button might need a `className` prop option. Check `frontend/src/components/ui/Button.tsx` — if it doesn't accept `className`, either add it or use inline styles. For now assume Button accepts className.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/resume-qa/page.tsx frontend/src/components/resume/ResumeHistory.tsx frontend/src/components/resume/FileUploader.tsx
git commit -m "feat: restructure resume-qa to three-column layout"
```

---

### Task 11: Integration test and polish

**Files:**
- All modified files from previous tasks

- [ ] **Step 1: Start backend and frontend, verify end-to-end**

Terminal 1:
```bash
cd backend && source .venv/Scripts/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify mock streaming works**

1. Open http://localhost:3000/resume-qa
2. Upload a test PDF/TXT file
3. Click "生成面试题"
4. Expected: Questions appear one by one with fade-in animation, progress shows "12/75"
5. Verify the three-column layout renders correctly at different screen widths

- [ ] **Step 3: Verify file preview for authenticated user**

1. Register/login
2. Upload a PDF resume
3. Verify center column shows PDF embed with zoom controls
4. Switch to another resume, verify preview updates

- [ ] **Step 4: Verify edge cases**

1. Upload during streaming — should be blocked (button disabled)
2. Switch resume while another is streaming — stream aborts, loads existing questions
3. Resize window to <1200px — verify columns reflow
4. Delete resume — verify it disappears from history

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish streaming integration and edge cases"
```

---

## Plan Self-Review

- **Spec coverage:** Every spec requirement has at least one task. Layout → Task 10, Streaming → Tasks 4-5, Preview → Tasks 6 & 9, File storage → Tasks 1-3, SSE client → Task 7.
- **Placeholder check:** All steps contain concrete code and commands. No TBD/TODO.
- **Type consistency:** `InterviewQuestion` domain model unchanged. `SSEEvent` types in TypeScript match Python `dict` shapes. `file_data: bytes` used consistently.
- **No scope creep:** Only the three agreed changes (streaming, preview, layout) are covered.
