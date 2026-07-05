# EchoMind Resume QA: Streaming + Preview + Layout Redesign

Date: 2026-06-06
Status: Approved Design

## Overview

Redesign the resume-qa page with three-column layout, SSE-based streaming question generation with typewriter animation, and original-format resume preview (PDF/DOCX).

## Layout

The page is a fixed-height three-column layout (no full-page scroll):

```
┌──────────────────────────────────────────────────────┐
│                    SiteHeader                         │
├───────────┬──────────────────┬───────────────────────┤
│ 左栏 280px│  中栏 360px      │  右栏 380px           │
│           │                  │                       │
│ 上传区    │  PDF embed       │  问题列表 (overflow-y) │
│ (固定)    │  (overflow-y)    │                       │
│ 历史列表  │                  │  底栏: 统计 (固定)     │
│ (overflow)│                  │                       │
├───────────┴──────────────────┴───────────────────────┤
│                    SiteFooter                         │
└──────────────────────────────────────────────────────┘
```

- Page: `h-screen flex flex-col`, no body scroll
- Three columns: `flex-1 overflow-hidden`
  - Left: `w-[280px] flex-shrink-0 flex flex-col` — upload area fixed, history list `flex-1 overflow-y-auto`
  - Center: `w-[360px] flex-shrink-0 flex flex-col` — preview content `flex-1 overflow-y-auto`
  - Right: `w-[380px] flex-shrink-0 flex flex-col` — question list `flex-1 overflow-y-auto`, header + stats bar fixed

### Breakpoint Behavior

- `>1200px`: Three columns as specified
- `900-1200px`: Right column moves below left+center (stacked 2+1)
- `<900px`: Single column stack

## Streaming Architecture

### New Backend Endpoints

**POST /api/v1/resumes/{resume_id}/questions/generate/stream**

Response: `text/event-stream`

Events:
```
event: question
data: {"id":"...","question_text":"...","category":"...","difficulty":"...","focus_area":"...","reference_answer":"..."}

event: progress
data: {"generated":12,"total":75}

event: done
data: {"total":75,"source":"deepseek"}

event: error
data: {"message":"Generation failed"}
```

**POST /api/v1/resumes/guest/process/stream**

Same SSE format, no persistence. Intended for unauthenticated users.

### Generator Changes (`app/services/generator.py`)

- New async generator `generate_questions_stream(resume_text, settings, count=75)` → `AsyncIterator[dict]`
  - Calls LLM (non-streaming — batches questions then yields individually)
  - Iterates through parsed questions and `yield`s each one
  - Inserts 200-300ms delay between yields for realistic typewriter feel
  - Yields `{"type":"progress","generated":n,"total":N}` every 5 questions
  - Yields `{"type":"done","total":N,"source":"deepseek"}` at end
  - Mock mode (`_mock_questions`): generates all at once, then yields each through the same iterator — frontend sees identical event stream

- Fallback: if LLM returns <50 questions, mock-pad to 50 before yielding

### Saving Strategy

Batch save within the SSE endpoint after all questions generated, before sending the `done` event. The frontend simply waits for `done` — save is transparent.

This avoids partial saves if the client disconnects mid-stream: either everything is saved and `done` fires, or nothing is saved and the user can retry.

## File Storage & Preview

### Model Changes (`app/models/domain.py`)

`Resume` adds:
```python
original_filename: str        # original filename with extension
file_data: bytes               # raw file bytes (for preview)
file_mime: str                 # MIME type
```

### New Endpoints

**GET /api/v1/resumes/{resume_id}/file**

- Returns raw bytes with appropriate Content-Type
- Frontend uses `<embed src="..." type="application/pdf">`
- For DOCX uploads: if no converted PDF exists yet, return 202 with status "converting"

### DOCX → PDF Conversion

- On-demand: first access to `/file` for a DOCX triggers conversion
- Backend calls `soffice --headless --convert-to pdf` (LibreOffice) or `docx2pdf`
- Resulting PDF stored in `file_data`, `file_mime` updated to `application/pdf`
- Cache converted PDF so subsequent accesses are instant
- Conversion happens in background task; frontend polls or receives a redirect

## Frontend Component Changes

### New Files

**`src/components/resume/ResumePreviewer.tsx`**
- Props: `resumeId | fileUrl`
- Renders `<embed>` for PDF with zoom controls
- Handles loading state (spinner), error state (show text fallback with parsed preview), DOCX converting state (polling indicator)

**`src/components/resume/QuestionStream.tsx`**
- Replaces `QuestionList.tsx`
- Manages SSE connection via `fetch()` + `ReadableStream` (POST method, so EventSource doesn't work)
- States: `idle → connecting → receiving → completed | error`
- Each received question appends to list with fade-in animation (not character-by-character typewriter)
- Shows progress bar/badge: "12/75 已生成"
- Bottom: streaming indicator dots animation during "receiving"
- Handles generation interruption (switching resume, leaving page)

### Modified Files

**`src/app/resume-qa/page.tsx`** — Three-column layout restructure
**`src/lib/api.ts`** — Add SSE fetch helper `api.generateQuestionsStream(resumeId): ReadableStream`
**`src/types/index.ts`** — No new types needed (existing Question type works)

### Streaming Client Implementation

```typescript
async function* generateQuestionsStream(resumeId: string): AsyncGenerator<SSEEvent> {
  const response = await fetch(`${API_BASE}/api/v1/resumes/${resumeId}/questions/generate/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const parsed = parseSSEEvent(event);
      if (parsed) yield parsed;
    }
  }
}
```

### Typewriter Animation

Simple approach: each new question card fades in with a slight downward slide using Tailwind:
```tsx
// New questions animate in
<div className="animate-[fadeInSlide_0.3s_ease-out]">
  <QuestionCard ... />
</div>
```

Animation CSS:
```css
@keyframes fadeInSlide {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Data Flow

### Authenticated User
1. Upload file → `POST /resumes/upload` → stores file_data + parses text → returns resume_id
2. Center column shows `<embed src="/resumes/{id}/file">`
3. Auto-trigger `POST /resumes/{id}/questions/generate/stream`
4. Right column streams questions with progress
5. SSE endpoint does batch save internally before `done` event
6. On `done` → left column history list refreshes (question_count updated)

### Guest User
1. Upload file → `POST /resumes/guest/process/stream`
2. Backend parses + generates, streams questions directly (no file stored)
3. No preview available (guest banner explains)
4. Left column shows guest mode info card instead of history

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Switch resume mid-stream | Abort `AbortController` for current stream, load target resume's existing questions |
| Delete resume mid-stream | Abort stream, show toast "已删除" |
| Network error during SSE | `onerror` → show retry button with "网络中断，点击重试" |
| LLM returns <50 questions | Mock-pad to 50 (existing logic, unchanged) |
| PDF fails to load in embed | Show text fallback (parsed content_preview) |
| DOCX first access (converting) | Show "正在转换文档格式，请稍候..." with auto-retry |
| Double-click generate | Button disabled during `connecting`/`receiving` states |
| Mock mode | Same SSE flow, same UI — no special path |
| Empty resume (no text) | Error returned at upload time (existing) |

## Files to Change

### Backend
- `app/models/domain.py` — Resume: add `original_filename`, `file_data`, `file_mime`
- `app/models/schemas.py` — No changes expected
- `app/api/v1/resumes.py` — Add SSE endpoints, file download endpoint; update upload to store raw bytes
- `app/services/generator.py` — Add `generate_questions_stream()` async generator
- `app/services/parser.py` — Return raw bytes alongside parsed text
- `app/db/repository.py` — No interface changes (bytes field is fine)
- `app/db/mock_repository.py` — Schema compatible; large bytes stored in memory dict (acceptable for mock)
- `app/db/mongodb_repository.py` — File data >16MB must use GridFS; smaller files stored as BSON binary (`GridFSBucket` for large resumes)
- `requirements.txt` — Possibly add `python-docx` (already present) + `docx2pdf` / system dependency on LibreOffice

### Frontend
- `src/app/resume-qa/page.tsx` — Three-column layout
- `src/lib/api.ts` — SSE stream helper
- `src/components/resume/QuestionStream.tsx` — New (replaces QuestionList)
- `src/components/resume/ResumePreviewer.tsx` — New
- `src/components/resume/ResumeHistory.tsx` — Style tweaks for left column
- `src/components/resume/FileUploader.tsx` — Layout polish
