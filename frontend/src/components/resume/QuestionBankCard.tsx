"use client";

import { Bookmark, CheckCircle2, ChevronDown, PencilLine, RotateCcw } from "lucide-react";
import { useState } from "react";

import type { QuestionBankDetail } from "@/types";
import { useAuth } from "@/lib/auth-context";

const difficultyLabels: Record<string, string> = {
  junior: "初级",
  mid: "中级",
  senior: "高级",
};

const difficultyColors: Record<string, string> = {
  junior: "bg-green-50 text-green-700",
  mid: "bg-yellow-50 text-yellow-700",
  senior: "bg-red-50 text-red-700",
};

interface Props {
  question: QuestionBankDetail;
  index: number;
  onToggleBookmark?: (id: string) => void;
  onToggleMastered?: (id: string) => void;
  onToggleReview?: (id: string) => void;
  onAnswer?: (id: string) => void;
}

export function QuestionBankCard({
  question,
  index,
  onToggleBookmark,
  onToggleMastered,
  onToggleReview,
  onAnswer,
}: Props) {
  const [showAnswer, setShowAnswer] = useState(false);
  const { user } = useAuth();
  const progress = question.user_progress;
  const isLoggedIn = !!user;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-white">#{index + 1}</span>
          <span className={`rounded-full px-3 py-1 ${difficultyColors[question.difficulty] || "bg-zinc-100 text-zinc-600"}`}>
            {difficultyLabels[question.difficulty] || question.difficulty}
          </span>
          {question.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              {tag}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        {isLoggedIn && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleBookmark?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_bookmarked
                  ? "bg-yellow-100 text-yellow-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_bookmarked ? "取消收藏" : "收藏"}
            >
              <Bookmark aria-hidden="true" className="h-4 w-4" fill={progress?.is_bookmarked ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => onToggleMastered?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_mastered
                  ? "bg-green-100 text-green-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_mastered ? "取消掌握" : "标记掌握"}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleReview?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.is_review
                  ? "bg-violet-100 text-violet-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title={progress?.is_review ? "取消待复习" : "标记待复习"}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onAnswer?.(question.id)}
              className={`rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                progress?.answered_at
                  ? "bg-blue-100 text-blue-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
              title="作答"
            >
              <PencilLine aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Question text */}
      <p className="leading-7 text-zinc-900">{question.question_text}</p>

      {/* Answer toggle */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <button
          aria-expanded={showAnswer}
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setShowAnswer((v) => !v)}
          type="button"
        >
          {showAnswer ? "隐藏参考回答" : "显示参考回答"}
          <ChevronDown
            aria-hidden="true"
            className={`ml-2 h-4 w-4 transition-transform duration-200 ${showAnswer ? "rotate-180" : ""}`}
          />
        </button>
        {showAnswer && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-zinc-700">
            <p className="mb-2 font-semibold text-blue-900">参考回答</p>
            <p className="whitespace-pre-wrap">{question.reference_answer || "暂无参考回答"}</p>
          </div>
        )}
      </div>
    </article>
  );
}
