"use client";

import { useCallback, useEffect, useState } from "react";
import { GuestBanner } from "@/components/layout/GuestBanner";
import { FileUploader } from "@/components/resume/FileUploader";
import { QuestionStream } from "@/components/resume/QuestionStream";
import { ResumePreviewer } from "@/components/resume/ResumePreviewer";
import { ResumeHistory } from "@/components/resume/ResumeHistory";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ResumeListItem } from "@/types";

export default function ResumeQaPage() {
  const { user, isGuest, continueAsGuest } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // Currently selected / streaming resume
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Questions state
  const [existingQuestions, setExistingQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || null;
  const selectedResumeIndex = selectedResumeId
    ? resumes.findIndex((r) => r.id === selectedResumeId)
    : -1;
  const hasPreviousResume = selectedResumeIndex > 0;
  const hasNextResume =
    selectedResumeIndex >= 0 && selectedResumeIndex < resumes.length - 1;

  useEffect(() => {
    if (!user) return;
    api.listResumes().then(setResumes).catch(() => setResumes([]));
  }, [user]);

  // Generate button: upload then stream
  const handleGenerate = useCallback(async () => {
    if (!file) return;
    if (!user && !isGuest) { continueAsGuest(); return; }
    setError("");

    try {
      if (user) {
        const resume = await api.uploadResume(file);
        setSelectedResumeId(resume.id);
        setSelectedFilename(resume.filename);
        setIsStreaming(true);
        setExistingQuestions([]);
        setStreamKey((k) => k + 1);
        setResumes(await api.listResumes());
      } else {
        setSelectedResumeId("guest");
        setSelectedFilename(file.name);
        setIsStreaming(true);
        setExistingQuestions([]);
        setStreamKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }, [file, user, isGuest, continueAsGuest]);

  const streamGenerator = useCallback(
    (signal: AbortSignal) => {
      if (selectedResumeId === "guest") {
        return api.streamProcessGuestResume(file!, signal);
      }
      return api.streamGenerateQuestions(selectedResumeId!, signal);
    },
    [selectedResumeId, file]
  );

  const handleStreamDone = useCallback(() => {
    setIsStreaming(false);
    if (user) {
      api.listResumes().then(setResumes).catch(() => {});
    }
  }, [user]);

  // Load existing questions when clicking history item
  async function loadQuestions(resumeId: string) {
    if (isStreaming) return;
    setSelectedResumeId(resumeId);
    setSelectedFilename(resumes.find((r) => r.id === resumeId)?.filename || "");
    setIsStreaming(false);
    setError("");
    setIsLoadingQuestions(true);
    try {
      const result = await api.getQuestions(resumeId);
      setExistingQuestions(result.questions);
      setStreamKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取历史问题失败");
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  async function handleDeleteResume(resumeId: string) {
    setError("");
    setIsDeleting(true);
    try {
      await api.deleteResume(resumeId);
      if (selectedResumeId === resumeId) {
        setSelectedResumeId(null);
        setSelectedFilename("");
        setExistingQuestions([]);
        setIsStreaming(false);
      }
      setResumes(await api.listResumes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  }

  const hasPreview = user && selectedResumeId && selectedResumeId !== "guest";

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
        {/* Left column — Upload + History */}
        <div className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          <div className="flex-shrink-0 border-b border-zinc-100 p-4">
            <FileUploader
              file={file}
              isBusy={isStreaming}
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

        {/* Center column — Preview */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {hasPreview && selectedResumeId ? (
            <ResumePreviewer
              resumeId={selectedResumeId}
              filename={selectedFilename}
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

        {/* Right column — Questions */}
        <div className="flex w-[380px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm">
          {isStreaming ? (
            <QuestionStream
              key={streamKey}
              onGenerate={streamGenerator}
              onDone={handleStreamDone}
            />
          ) : (
            <QuestionStream
              key={streamKey}
              onGenerate={streamGenerator}
              existingQuestions={existingQuestions}
              isLoadingExisting={isLoadingQuestions && existingQuestions.length === 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
