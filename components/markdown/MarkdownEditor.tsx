"use client";

import { useRef, useState } from "react";
import { Markdown } from "./Markdown";

/**
 * Editor de texto con Markdown y pestaña de vista previa (F1-1). Escribir y
 * Vista previa son botones con su propio data-testid.
 */
export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  rows = 6,
  placeholder,
  testId,
  className = "",
  onUploadFile,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
  testId: string;
  className?: string;
  /** Sube un archivo pegado o soltado y devuelve su URL pública (adjunto en línea). */
  onUploadFile?: (file: File) => Promise<string>;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /** Inserta el texto en la posición del cursor. */
  function insertAtCursor(text: string) {
    const area = areaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
  }

  async function handleFiles(files: File[]) {
    if (!onUploadFile || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const url = await onUploadFile(file);
        const isImage = file.type.startsWith("image/");
        insertAtCursor(`${isImage ? "!" : ""}[${file.name.replace(/[[\]]/g, "")}](${url})\n`);
      }
    } catch {
      setUploadError("No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex gap-1 text-xs" role="tablist">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            data-testid={`${testId}-tab-${t}`}
            className={`rounded-md px-2.5 py-1 font-medium ${tab === t ? "bg-bg text-accent" : "text-ink/50 hover:text-ink"}`}
          >
            {t === "write" ? "Escribir" : "Vista previa"}
          </button>
        ))}
      </div>
      {tab === "write" ? (
        <textarea
          ref={areaRef}
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length && onUploadFile) {
              e.preventDefault();
              void handleFiles(files);
            }
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length && onUploadFile) {
              e.preventDefault();
              void handleFiles(files);
            }
          }}
          onDragOver={(e) => onUploadFile && e.preventDefault()}
          rows={rows}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm focus-visible:border-accent"
        />
      ) : (
        <div className="min-h-24 rounded-lg border border-border bg-surface p-3" data-testid={`${testId}-preview`}>
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-ink/40">Nada que previsualizar.</p>}
        </div>
      )}
      {onUploadFile && (
        <p className="text-xs text-ink/50" data-testid={`${testId}-upload-hint`}>
          {uploading ? "Subiendo archivo…" : "Pega o suelta un archivo para adjuntarlo en línea."}
          {uploadError && <span className="ml-2 text-red-600">{uploadError}</span>}
        </p>
      )}
      <p className="text-xs text-ink/40">
        Markdown: **negrita**, *cursiva*, listas, `código`. Menciona con @nombre.
      </p>
    </div>
  );
}
