"use client";

import { Bookmark, CheckCircle2, RotateCcw } from "lucide-react";

import type { ProgressStats, QuestionBankTopic } from "@/types";
import { useAuth } from "@/lib/auth-context";

interface Props {
  topics: QuestionBankTopic[];
  selectedTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
  progress?: ProgressStats;
}

export function TopicSidebar({ topics, selectedTopic, onSelectTopic, progress }: Props) {
  const { user } = useAuth();

  return (
    <aside className="flex h-full flex-col">
      {/* Topic list */}
      <nav className="flex-1 overflow-y-auto" aria-label="科目列表">
        <div className="px-3 pb-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            全部科目
          </h3>
          <button
            type="button"
            onClick={() => onSelectTopic(null)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selectedTopic === null
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center justify-between">
              <span>全部</span>
              <span className="text-xs opacity-60">
                {topics.reduce((sum, t) => sum + t.question_count, 0)}
              </span>
            </span>
          </button>
        </div>
        <div className="space-y-0.5 px-3">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onSelectTopic(topic.name)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selectedTopic === topic.name
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <span className="flex items-center justify-between">
                <span>{topic.name}</span>
                <span className="text-xs opacity-60">{topic.question_count}</span>
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Progress summary */}
      {user && progress && (
        <div className="flex-shrink-0 border-t border-zinc-200 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            进度概览
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Bookmark aria-hidden="true" className="h-3.5 w-3.5 text-yellow-500" />
              <span>收藏 {progress.bookmarked}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-green-500" />
              <span>掌握 {progress.mastered}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 text-violet-500" />
              <span>待复习 {progress.review}</span>
            </div>
          </div>
        </div>
      )}

      {/* Login prompt for guest */}
      {!user && (
        <div className="flex-shrink-0 border-t border-zinc-200 p-4">
          <p className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-500">
            登录后可收藏题目、标记进度
          </p>
        </div>
      )}
    </aside>
  );
}
