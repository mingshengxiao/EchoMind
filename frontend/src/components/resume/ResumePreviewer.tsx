"use client";

import { useEffect, useRef, useState } from "react";

interface ResumePreviewerProps {
  fileUrl: string;
  filename: string;
  textFallback?: string;
}

export function ResumePreviewer({ fileUrl, filename, textFallback }: ResumePreviewerProps) {
  const [embedError, setEmbedError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const isPdf = filename.toLowerCase().endsWith(".pdf");

  // Fetch with auth header and create blob URL (embed can't set Authorization header)
  useEffect(() => {
    if (!isPdf || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.blob();
      })
      .then((blob) => {
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        setEmbedError(true);
      });

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, isPdf]);

  if (embedError || !isPdf) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">简历内容</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {textFallback ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700">
              {textFallback}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              {isPdf ? "PDF 预览加载失败" : "暂不支持此文件格式的预览"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with zoom controls */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">简历预览</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            disabled={zoom <= 50}
            type="button"
            aria-label="缩小"
          >
            −
          </button>
          <span className="min-w-[3ch] text-center text-xs tabular-nums text-zinc-600">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            disabled={zoom >= 200}
            type="button"
            aria-label="放大"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF embed */}
      <div className="flex-1 overflow-y-auto bg-zinc-100">
        {blobUrl ? (
          <embed
            src={blobUrl}
            type="application/pdf"
            className="mx-auto block min-h-full w-full"
            style={{ width: `${zoom}%`, minWidth: "100%" }}
            onError={() => setEmbedError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" />
              <p className="mt-3 text-sm text-zinc-500">加载中...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
