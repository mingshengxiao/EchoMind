"use client";

import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";

interface Props {
  questionText: string;
  existingAnswer?: string;
  onSave: (answer: string) => Promise<void>;
  onClose: () => void;
}

export function AnswerDialog({ questionText, existingAnswer, onSave, onClose }: Props) {
  const [answer, setAnswer] = useState(existingAnswer || "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(answer);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [answer, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">作答</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
          {questionText}
        </div>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="输入你的答案..."
          rows={6}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !answer.trim()}>
            {saving ? "保存中..." : "保存答案"}
          </Button>
        </div>
      </div>
    </div>
  );
}
