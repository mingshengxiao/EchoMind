"use client";

import { useEffect, useRef, useState } from "react";
import { QuestionCard } from "@/components/resume/QuestionCard";
import type { Question, SSEEvent } from "@/types";

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
  const streamStateRef = useRef(streamState);
  streamStateRef.current = streamState;

  // Auto-start streaming when mounted with onGenerate (no existing questions)
  useEffect(() => {
    // Skip if this is a history-browsing mount (already has questions)
    if (existingQuestions.length > 0) return;

    // Use a flag to handle React Strict Mode double-invoke:
    //  1st invoke → started = false → startStream() → schedule
    //  cleanup  → abortRef aborts, but we'll re-start on 2nd invoke
    //  2nd invoke → starts a fresh stream that won't be aborted
    let started = false;
    const timer = setTimeout(() => {
      started = true;
      startStream();
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!started) abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startStream() {
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
      if (!abortController.signal.aborted && streamStateRef.current !== "error") {
        setStreamState("completed");
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : "生成失败");
        setStreamState("error");
      }
    }
  }

  // Loading skeleton for existing questions
  if (isLoadingExisting) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">面试题</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-4 text-sm font-medium text-zinc-700">正在加载...</p>
          <div className="space-y-3" aria-live="polite">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none" />
            ))}
          </div>
        </div>
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
                上传简历后即可开始
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
