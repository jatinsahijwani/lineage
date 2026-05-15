"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function FileDropzone({ file, onChange, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onChange(f);
    },
    [disabled, onChange],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "group relative flex flex-col items-center justify-center rounded-lg border border-dashed border-white/15 px-6 py-10 text-center transition-colors",
        isOver && "border-blue-400/60 bg-blue-500/5",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:border-white/30 hover:bg-white/[0.02]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      {file ? (
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5">
              <FileText className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-white">
                {file.name}
              </div>
              <div className="text-xs text-white/50">
                {formatBytes(file.size)}
                {file.type ? ` · ${file.type}` : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="mb-3 h-8 w-8 text-white/40 transition-colors group-hover:text-white/70" />
          <div className="text-sm text-white/70">
            Drop a file here or click to browse
          </div>
          <div className="mt-1 text-xs text-white/40">
            Encrypted with libsodium secretbox before upload to 0G Storage
          </div>
        </>
      )}
    </div>
  );
}
