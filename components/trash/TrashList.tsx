"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Trash = {
  issues: { id: string; key: string; title: string; deletedAt: string }[];
  testCases: { id: string; key: string; title: string; deletedAt: string }[];
  comments: { id: string; key: string; body: string; deletedAt: string }[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TrashList({ trash }: { trash: Trash }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(kind: "issues" | "test-cases" | "comments", id: string) {
    setBusy(id);
    setError(null);
    const path = kind === "issues" ? "issues" : kind === "test-cases" ? "test-cases" : "comments";
    const res = await fetch(`/api/${path}/${id}/restore`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo restaurar");
      return;
    }
    router.refresh();
  }

  const empty = trash.issues.length + trash.testCases.length + trash.comments.length === 0;

  return (
    <div className="flex flex-col gap-6" data-testid="trash-list">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {empty && <p className="text-sm text-ink/50">La papelera está vacía.</p>}

      {trash.issues.length > 0 && (
        <section>
          <h2 className="mb-2 font-heading text-sm font-semibold">Incidencias</h2>
          <ul className="flex flex-col gap-1.5">
            {trash.issues.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-mono text-xs text-accent">{i.key}</span>
                <span className="flex-1 truncate">{i.title}</span>
                <span className="text-xs text-ink/40">Borrada {formatDate(i.deletedAt)}</span>
                <Button
                  variant="secondary"
                  disabled={busy === i.id}
                  onClick={() => restore("issues", i.id)}
                  data-testid={`trash-restore-issue-${i.key}`}
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trash.testCases.length > 0 && (
        <section>
          <h2 className="mb-2 font-heading text-sm font-semibold">Casos de prueba</h2>
          <ul className="flex flex-col gap-1.5">
            {trash.testCases.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-mono text-xs text-accent">{t.key}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-xs text-ink/40">Borrado {formatDate(t.deletedAt)}</span>
                <Button
                  variant="secondary"
                  disabled={busy === t.id}
                  onClick={() => restore("test-cases", t.id)}
                  data-testid={`trash-restore-test-case-${t.key}`}
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trash.comments.length > 0 && (
        <section>
          <h2 className="mb-2 font-heading text-sm font-semibold">Tus comentarios</h2>
          <ul className="flex flex-col gap-1.5">
            {trash.comments.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-mono text-xs text-accent">{c.key}</span>
                <span className="flex-1 truncate">{c.body}</span>
                <span className="text-xs text-ink/40">Borrado {formatDate(c.deletedAt)}</span>
                <Button
                  variant="secondary"
                  disabled={busy === c.id}
                  onClick={() => restore("comments", c.id)}
                  data-testid={`trash-restore-comment-${c.id}`}
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
