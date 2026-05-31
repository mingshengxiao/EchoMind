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
    const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));
    if (!isAllowed) {
      setError("仅支持 PDF、DOCX、MD、TXT 格式");
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
    <section className="space-y-4" aria-labelledby="upload-title">
      <div
        className={cn(
          "rounded-3xl border-2 border-dashed border-zinc-300 bg-white/80 p-8 text-center transition-colors duration-200",
          isDragging && "border-brand bg-blue-50",
          error && "border-red-300 bg-red-50",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) acceptFile(droppedFile);
        }}
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-brand">
          <Upload aria-hidden="true" className="h-7 w-7" />
        </div>
        <h2 id="upload-title" className="text-xl font-semibold text-zinc-950">
          上传你的简历
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          拖放 PDF、DOCX、Markdown 或 TXT 简历到这里，或点击按钮选择文件。系统会生成 50–100 个基于简历内容的问题。
        </p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) acceptFile(selectedFile);
          }}
        />
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => inputRef.current?.click()} type="button" variant="secondary">
            选择文件
          </Button>
          <Button disabled={!file || isBusy} onClick={onSubmit} type="button">
            {isBusy ? "生成中..." : "生成面试题"}
          </Button>
        </div>
      </div>
      {file ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          已选择：<span className="font-medium text-zinc-950">{file.name}</span> · {formatFileSize(file.size)}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
