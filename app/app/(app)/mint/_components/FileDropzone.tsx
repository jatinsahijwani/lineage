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
        "group relative flex flex-col items-center justify-center border border-dashed px-6 py-12 text-center transition-colors",
        isOver
          ? "border-copper bg-copper/5"
          : "border-rule hover:border-rule-strong",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer",
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
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-copper/40 bg-copper/10">
              <FileText className="h-5 w-5 text-copper" />
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate font-mono text-sm text-paper">
                {file.name}
              </div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-faint tabular">
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
            className="p-2 text-paper-faint transition-colors hover:text-rust"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="mb-4 h-7 w-7 text-paper-faint transition-colors group-hover:text-copper" />
          <div className="font-display italic text-lg text-paper">
            Drop a file here, or click to browse.
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-faint">
            Encrypted client-side · pushed to 0G storage
          </div>
        </>
      )}
    </div>
  );
}
