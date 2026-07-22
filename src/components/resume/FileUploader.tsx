"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn, formatFileSize } from "@/lib/utils";

interface FileUploaderProps {
  file: File | null;
  isBusy: boolean;
  onFileSelect: (file: File) => void;
  onSubmit: () => void;
}

const allowedExtensions = [".pdf", ".docx", ".md", ".markdown", ".txt"];

export function FileUploader({ file, isBusy, onFileSelect, onSubmit }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  function acceptFile(nextFile: File) {
    const lowerName = nextFile.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setError("仅支持 PDF/DOCX/MD/TXT");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError("文件不能超过 10MB");
      return;
    }
    setError("");
    onFileSelect(nextFile);
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl border-2 border-dashed border-zinc-300 bg-white/80 p-4 text-center transition-colors duration-200",
          isDragging && "border-brand bg-blue-50",
          error && "border-red-300 bg-red-50"
        )}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) acceptFile(f);
        }}
      >
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-brand">
          <Upload aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-zinc-950">上传简历</p>
        <p className="mt-1 text-xs text-zinc-500">PDF/DOCX/MD/TXT</p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
        />
        <div className="mt-3 flex flex-col gap-2">
          <Button onClick={() => inputRef.current?.click()} type="button" variant="secondary" className="!w-full text-xs !py-2">
            选择文件
          </Button>
          <Button disabled={!file || isBusy} onClick={onSubmit} type="button" className="!w-full text-xs !py-2">
            {isBusy ? "生成中..." : "生成面试题"}
          </Button>
        </div>
      </div>
      {file && (
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
          {file.name}<br />
          <span className="text-zinc-400">{formatFileSize(file.size)}</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
