"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { Question } from "@/types";

const categoryLabels: Record<string, string> = {
  technical: "技术",
  behavioral: "行为",
  project: "项目",
  experience: "经验",
  scenario: "场景",
};

export function QuestionCard({ question, index }: { question: Question; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const hasAnswer = Boolean(question.reference_answer?.trim());

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-zinc-950 px-3 py-1 text-white">#{index + 1}</span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{categoryLabels[question.category] || question.category}</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{question.difficulty}</span>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">{question.focus_area}</span>
      </div>
      <p className="leading-7 text-zinc-900">{question.question_text}</p>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        {hasAnswer ? (
          <>
            <button
              aria-expanded={showAnswer}
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={() => setShowAnswer((current) => !current)}
              type="button"
            >
              {showAnswer ? "隐藏参考回答" : "显示参考回答"}
              <ChevronDown aria-hidden="true" className={`ml-2 h-4 w-4 transition-transform duration-200 ${showAnswer ? "rotate-180" : ""}`} />
            </button>
            {showAnswer ? (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-zinc-700">
                <p className="mb-2 font-semibold text-blue-900">参考回答</p>
                <p className="whitespace-pre-wrap">{question.reference_answer}</p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">这道题暂无参考回答，可重新生成问题获得参考答案。</p>
        )}
      </div>
    </article>
  );
}
