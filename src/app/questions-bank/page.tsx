"use client";

import { useCallback, useEffect, useState } from "react";

import { AnswerDialog } from "@/components/resume/AnswerDialog";
import { QuestionBankCard } from "@/components/resume/QuestionBankCard";
import { QuestionFilterBar } from "@/components/resume/QuestionFilterBar";
import { TopicSidebar } from "@/components/resume/TopicSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ProgressStats, QuestionBankDetail, QuestionBankTopic } from "@/types";

export default function QuestionsBankPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<QuestionBankTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questions, setQuestions] = useState<QuestionBankDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 20;

  // Answer dialog state
  const [answerQuestionId, setAnswerQuestionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressStats | undefined>();

  // Load topics once
  useEffect(() => {
    api.questionsBank.listTopics().then(setTopics).catch(() => {});
  }, []);

  // Load progress when user logs in
  useEffect(() => {
    if (!user) {
      setProgress(undefined);
      return;
    }
    api.questionsBank.getProgress().then(setProgress).catch(() => {});
  }, [user]);

  // Load questions when filters change
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.questionsBank.listQuestions({
        topic: selectedTopic || undefined,
        difficulty: difficulty || undefined,
        search: search || undefined,
        page,
        size: pageSize,
      });
      setQuestions(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, difficulty, search, page]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Reset to page 1 when filters change
  const handleTopicChange = useCallback((topic: string | null) => {
    setSelectedTopic(topic);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleDifficultyChange = useCallback((value: string) => {
    setDifficulty(value);
    setPage(1);
  }, []);

  // Action handlers
  const handleToggleBookmark = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleBookmark(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_bookmarked: result.new_value,
                },
              }
            : q
        )
      );
      // Refresh progress
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleToggleMastered = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleMastered(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_mastered: result.new_value,
                },
              }
            : q
        )
      );
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleToggleReview = useCallback(async (questionId: string) => {
    try {
      const result = await api.questionsBank.toggleReview(questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                user_progress: {
                  ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                  is_review: result.new_value,
                },
              }
            : q
        )
      );
      const p = await api.questionsBank.getProgress();
      setProgress(p);
    } catch {
      // silent
    }
  }, []);

  const handleSaveAnswer = useCallback(async (answer: string) => {
    if (!answerQuestionId) return;
    await api.questionsBank.saveAnswer(answerQuestionId, answer);
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === answerQuestionId
          ? {
              ...q,
              user_progress: {
                ...q.user_progress || { is_bookmarked: false, is_mastered: false, is_review: false, user_answer: "", answered_at: null },
                user_answer: answer,
                answered_at: new Date().toISOString(),
              },
            }
          : q
      )
    );
    const p = await api.questionsBank.getProgress();
    setProgress(p);
  }, [answerQuestionId]);

  const totalPages = Math.ceil(total / pageSize);

  const answerQuestion = questions.find((q) => q.id === answerQuestionId);

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex-shrink-0 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Questions Bank
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          面试题集
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-4 overflow-hidden pb-4">
        {/* Left sidebar */}
        <div className="flex w-[240px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          <TopicSidebar
            topics={topics}
            selectedTopic={selectedTopic}
            onSelectTopic={handleTopicChange}
            progress={progress}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {/* Filter bar */}
          <div className="flex-shrink-0 border-b border-zinc-100 p-4">
            <QuestionFilterBar
              search={search}
              difficulty={difficulty}
              onSearchChange={handleSearchChange}
              onDifficultyChange={handleDifficultyChange}
            />
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : questions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-semibold text-zinc-950">暂无题目</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {search || difficulty
                      ? "没有匹配的题目，试试其他筛选条件"
                      : "题库还没有数据，请先运行导入脚本"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionBankCard
                    key={q.id}
                    question={q}
                    index={(page - 1) * pageSize + i}
                    onToggleBookmark={handleToggleBookmark}
                    onToggleMastered={handleToggleMastered}
                    onToggleReview={handleToggleReview}
                    onAnswer={(id) => setAnswerQuestionId(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex-shrink-0 border-t border-zinc-100 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        page === pageNum
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Answer dialog */}
      {answerQuestion && (
        <AnswerDialog
          questionText={answerQuestion.question_text}
          existingAnswer={answerQuestion.user_progress?.user_answer}
          onSave={handleSaveAnswer}
          onClose={() => setAnswerQuestionId(null)}
        />
      )}
    </div>
  );
}
