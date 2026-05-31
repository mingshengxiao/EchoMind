import { QuestionCard } from "@/components/resume/QuestionCard";
import { Card } from "@/components/ui/Card";
import type { Question, ResumeListItem } from "@/types";

interface QuestionListProps {
  questions: Question[];
  isLoading: boolean;
  selectedResume?: ResumeListItem | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function QuestionList({
  questions,
  isLoading,
  selectedResume,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: QuestionListProps) {
  if (isLoading) {
    return (
      <Card className="space-y-4" aria-live="polite">
        <p className="text-sm font-medium text-zinc-700">正在读取面试题，请稍候...</p>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none" key={index} />
        ))}
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card className="text-center">
        <p className="text-lg font-semibold text-zinc-950">还没有面试题</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">上传简历后，EchoMind 会根据你的经历生成一组可追问、可复盘的问题。</p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-live="polite">
      <div className="rounded-3xl border border-zinc-200 bg-white/85 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand">当前查看</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-zinc-950">{selectedResume?.filename || "生成的问题"}</h2>
            <p className="mt-1 text-sm text-zinc-600">共 {questions.length} 个问题，可按顺序进行自测。</p>
          </div>
          {(onPrevious || onNext) && (
            <div className="flex gap-2">
              <button
                className="min-h-[44px] cursor-pointer rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                disabled={!hasPrevious}
                onClick={onPrevious}
                type="button"
              >
                上一份
              </button>
              <button
                className="min-h-[44px] cursor-pointer rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                disabled={!hasNext}
                onClick={onNext}
                type="button"
              >
                下一份
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <QuestionCard index={index} key={question.id} question={question} />
        ))}
      </div>
    </section>
  );
}
