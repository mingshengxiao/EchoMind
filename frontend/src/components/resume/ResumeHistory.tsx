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
                {isActive ? <p className="mt-1 text-xs font-semibold text-brand">正在查看</p> : null}
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
