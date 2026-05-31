"use client";

import { useEffect, useState } from "react";

import { GuestBanner } from "@/components/layout/GuestBanner";
import { FileUploader } from "@/components/resume/FileUploader";
import { QuestionList } from "@/components/resume/QuestionList";
import { ResumeHistory } from "@/components/resume/ResumeHistory";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Question, ResumeListItem } from "@/types";

export default function ResumeQaPage() {
  const { user, isGuest, continueAsGuest } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"deepseek" | "mock" | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  const selectedResume = resumes.find((resume) => resume.id === selectedResumeId) || null;
  const selectedResumeIndex = selectedResumeId ? resumes.findIndex((resume) => resume.id === selectedResumeId) : -1;
  const hasPreviousResume = selectedResumeIndex > 0;
  const hasNextResume = selectedResumeIndex >= 0 && selectedResumeIndex < resumes.length - 1;

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

  async function handleGenerate() {
    if (!file) return;
    if (!user && !isGuest) continueAsGuest();
    setError("");
    setIsLoading(true);
    setQuestions([]);
    try {
      const result = user
        ? await api.uploadResume(file).then(async (resume) => {
            setSelectedResumeId(resume.id);
            return api.generateQuestions(resume.id);
          })
        : await api.processGuestResume(file);
      setQuestions(result.questions);
      setSource(result.source);
      if (user) setResumes(await api.listResumes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadQuestions(resumeId: string) {
    setSelectedResumeId(resumeId);
    setError("");
    setIsLoading(true);
    try {
      const result = await api.getQuestions(resumeId);
      setQuestions(result.questions);
      setSource(result.source);
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
        setSource(null);
      }
      setResumes(await api.listResumes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试");
    } finally {
      setIsDeleting(false);
    }
  }

  async function selectAdjacentResume(direction: "previous" | "next") {
    if (selectedResumeIndex < 0) return;
    const nextIndex = direction === "previous" ? selectedResumeIndex - 1 : selectedResumeIndex + 1;
    const nextResume = resumes[nextIndex];
    if (nextResume) await loadQuestions(nextResume.id);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">Resume QA</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">简历问答</h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          上传简历后，EchoMind 会解析你的经历并生成一组面试官可能追问的问题。登录用户会保存历史；游客用户仅即时生成。
        </p>
      </div>

      {!user ? <GuestBanner /> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <FileUploader file={file} isBusy={isLoading} onFileSelect={setFile} onSubmit={handleGenerate} />
            {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {source === "mock" && questions.length ? (
              <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                当前未配置 DeepSeek API Key，已使用本地 mock 生成器演示完整流程。
              </p>
            ) : null}
          </Card>
          <QuestionList
            hasNext={hasNextResume}
            hasPrevious={hasPreviousResume}
            isLoading={isLoading}
            onNext={() => selectAdjacentResume("next")}
            onPrevious={() => selectAdjacentResume("previous")}
            questions={questions}
            selectedResume={selectedResume}
          />
        </div>
        <div className="space-y-6">
          {user ? (
            <ResumeHistory
              isDeleting={isDeleting}
              onDelete={handleDeleteResume}
              onSelect={loadQuestions}
              resumes={resumes}
              selectedResumeId={selectedResumeId}
            />
          ) : (
            <Card>
              <h2 className="text-lg font-semibold text-zinc-950">默认 user 游客模式</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                你可以不登录直接使用。游客模式不会保存上传文件、解析文本或生成问题，适合快速体验。
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
