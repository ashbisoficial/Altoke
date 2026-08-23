"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadAttachment } from "@/lib/supabase/storage";
import { PRIORITY_LABEL, type Priority } from "@/lib/priority";

type PersonRef = { id: string; name: string | null; email: string; avatarUrl: string | null };

type Status = { id: string; name: string; color: string; order: number; category?: string };
type Transition = { id: string; fromStatusId: string; toStatusId: string; name: string };

export type IssueDetailData = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  priority: Priority;
  statusId: string;
  status: Status;
  issueTypeId: string;
  issueType: { id: string; name: string; color: string | null };
  assignee: PersonRef | null;
  reporter: PersonRef;
  sprintId: string | null;
  storyPoints: number | null;
  dueDate: Date | null;
  parent: { id: string; key: string; title: string } | null;
  children: {
    id: string;
    key: string;
    title: string;
    issueType: { name: string; color: string | null };
    status: Status;
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    author: PersonRef;
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    uploaderId: string;
  }[];
  linksFrom: { id: string; type: string; target: { id: string; key: string; title: string } }[];
  linksTo: { id: string; type: string; source: { id: string; key: string; title: string } }[];
  labels: { label: { id: string; name: string; color: string } }[];
  activity: {
    id: string;
    field: string;
    fromLabel: string | null;
    toLabel: string | null;
    createdAt: Date;
    actor: PersonRef;
  }[];
};

export type IssueDetailProject = {
  id: string;
  key: string;
  name: string;
  issueTypes: { id: string; name: string; isSubtask: boolean }[];
  sprints: { id: string; name: string; status: string }[];
  members: { user: PersonRef }[];
  workflow: { statuses: Status[]; transitions: Transition[] };
  labels: { id: string; name: string; color: string }[];
};

const LINK_TYPE_LABEL: Record<string, string> = {
  BLOCKS: "bloquea a",
  IS_BLOCKED_BY: "bloqueada por",
  RELATES_TO: "relacionada con",
  DUPLICATES: "duplica a",
  IS_DUPLICATED_BY: "duplicada por",
  CAUSES: "causa a",
  IS_CAUSED_BY: "causada por",
};

async function patchIssue(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudo guardar el cambio");
  }
  return res.json();
}

export function IssueDetail({
  issue,
  project,
  currentUserId,
  otherIssues,
}: {
  issue: IssueDetailData;
  project: IssueDetailProject;
  currentUserId: string;
  otherIssues: { id: string; key: string; title: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  async function save(field: string, body: Record<string, unknown>) {
    setSavingField(field);
    setError(null);
    try {
      await patchIssue(issue.id, body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSavingField(null);
    }
  }

  async function moveToStatus(toStatusId: string) {
    setError(null);
    const res = await fetch(`/api/issues/${issue.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatusId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo mover la incidencia");
      return;
    }
    router.refresh();
  }

  const availableTransitions = project.workflow.transitions.filter(
    (t) => t.fromStatusId === issue.statusId,
  );

  const subtaskType = project.issueTypes.find((t) => t.isSubtask);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/board?projectId=${project.id}`}
        className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
      >
        <ArrowLeft size={13} />
        Volver al tablero
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-sm text-accent">{issue.key}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
        >
          {issue.issueType.name}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== issue.title && save("title", { title: title.trim() })}
        className="mt-2 w-full border-none bg-transparent font-heading text-2xl font-semibold outline-none focus-visible:ring-1 focus-visible:ring-accent"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink/70">Descripción</h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (issue.description ?? "") &&
                save("description", { description: description || null })
              }
              rows={6}
              placeholder="Añade una descripción…"
              className="w-full rounded-md border border-border bg-surface p-3 text-sm focus-visible:border-accent"
            />
          </section>

          <SubtasksSection issue={issue} subtaskType={subtaskType} projectId={project.id} onChanged={() => router.refresh()} />

          <LinksSection issue={issue} otherIssues={otherIssues} onChanged={() => router.refresh()} />

          <AttachmentsSection issue={issue} currentUserId={currentUserId} onChanged={() => router.refresh()} />

          <CommentsSection issue={issue} onChanged={() => router.refresh()} />

          <ActivitySection issue={issue} />
        </div>

        <aside className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 text-sm">
          <div>
            <label className="text-xs font-medium text-ink/60">Estado</label>
            <div className="mt-1 flex flex-wrap gap-1">
              <span
                className="rounded px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: issue.status.color }}
              >
                {issue.status.name}
              </span>
            </div>
            {availableTransitions.length > 0 && (
              <select
                className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                value=""
                onChange={(e) => e.target.value && moveToStatus(e.target.value)}
              >
                <option value="">Mover a…</option>
                {availableTransitions.map((t) => {
                  const target = project.workflow.statuses.find((s) => s.id === t.toStatusId);
                  return (
                    <option key={t.id} value={t.toStatusId}>
                      {t.name} ({target?.name})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-ink/60">Prioridad</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={issue.priority}
              disabled={savingField === "priority"}
              onChange={(e) => save("priority", { priority: e.target.value })}
            >
              {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-ink/60">Asignado</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={issue.assignee?.id ?? ""}
              disabled={savingField === "assignee"}
              onChange={(e) => save("assignee", { assigneeId: e.target.value || null })}
            >
              <option value="">Sin asignar</option>
              {project.members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-ink/60">Sprint</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={issue.sprintId ?? ""}
              disabled={savingField === "sprint"}
              onChange={(e) => save("sprint", { sprintId: e.target.value || null })}
            >
              <option value="">Backlog</option>
              {project.sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-ink/60">Puntos de historia</label>
            <Input
              type="number"
              min={0}
              defaultValue={issue.storyPoints ?? ""}
              onBlur={(e) =>
                save("storyPoints", {
                  storyPoints: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1"
            />
          </div>

          <LabelsSection
            issue={issue}
            projectId={project.id}
            projectLabels={project.labels}
            onChanged={() => router.refresh()}
          />

          <div className="border-t border-border pt-3 text-xs text-ink/60">
            Reportado por {issue.reporter.name ?? issue.reporter.email}
          </div>

          {issue.parent && (
            <div className="border-t border-border pt-3 text-xs">
              <span className="text-ink/60">Incidencia padre: </span>
              <Link href={`/issues/${issue.parent.id}`} className="font-mono text-accent">
                {issue.parent.key}
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

const LABEL_COLORS = ["#2952CC", "#16A34A", "#D97706", "#DC2626", "#7C3AED", "#0EA5E9", "#DB2777", "#64748B"];

function LabelsSection({
  issue,
  projectId,
  projectLabels,
  onChanged,
}: {
  issue: IssueDetailData;
  projectId: string;
  projectLabels: { id: string; name: string; color: string }[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLabelIds = new Set(issue.labels.map((l) => l.label.id));
  const availableToAdd = projectLabels.filter((l) => !currentLabelIds.has(l.id));

  async function attachExisting(labelId: string) {
    if (!labelId) return;
    setError(null);
    const res = await fetch(`/api/issues/${issue.id}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo agregar la etiqueta");
      return;
    }
    onChanged();
  }

  async function removeLabel(labelId: string) {
    await fetch(`/api/issues/${issue.id}/labels/${labelId}`, { method: "DELETE" });
    onChanged();
  }

  async function createAndAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "No se pudo crear la etiqueta");
      return;
    }
    await attachExisting(data.label.id);
    setLoading(false);
    setNewName("");
    setAdding(false);
  }

  return (
    <div>
      <label className="text-xs font-medium text-ink/60">Etiquetas</label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {issue.labels.map(({ label }) => (
          <span
            key={label.id}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <button
              type="button"
              onClick={() => removeLabel(label.id)}
              aria-label={`Quitar etiqueta ${label.name}`}
              className="opacity-80 hover:opacity-100"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {issue.labels.length === 0 && <span className="text-xs text-ink/40">Sin etiquetas todavía.</span>}
      </div>

      {availableToAdd.length > 0 && (
        <select
          className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          value=""
          onChange={(e) => attachExisting(e.target.value)}
        >
          <option value="">Añadir etiqueta existente…</option>
          {availableToAdd.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {adding ? (
        <form onSubmit={createAndAttach} className="mt-2 flex flex-col gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la etiqueta"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {LABEL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                aria-label={`Color ${color}`}
                className={`h-6 w-6 rounded-full ${
                  newColor === color ? "ring-2 ring-offset-2 ring-accent" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={loading || !newName.trim()}>
              Crear
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 text-xs text-accent hover:underline underline-offset-4"
        >
          + Nueva etiqueta
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SubtasksSection({
  issue,
  subtaskType,
  projectId,
  onChanged,
}: {
  issue: IssueDetailData;
  subtaskType: { id: string; name: string } | undefined;
  projectId: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!subtaskType || !title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        issueTypeId: subtaskType.id,
        title: title.trim(),
        parentId: issue.id,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle("");
      onChanged();
    }
  }

  if (issue.issueType.name === "Subtarea") return null;

  const total = issue.children.length;
  const done = issue.children.filter((c) => c.status.category === "DONE").length;
  const isBigItem = issue.issueType.name === "Épica" || issue.issueType.name === "Historia";

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink/70">Subtareas</h2>
        {total > 0 && (
          <span className="text-xs text-ink/50">
            {done} de {total} completadas
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-status-done transition-all"
            style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }}
          />
        </div>
      )}
      {total === 0 && isBigItem && (
        <p className="mb-2 text-xs text-ink/50">
          ¿Esta {issue.issueType.name.toLowerCase()} es grande? Divídela en pasos más chicos para
          avanzar más fácil — añade la primera subtarea abajo.
        </p>
      )}
      {issue.children.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {issue.children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/issues/${child.id}`}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
              >
                <span className="font-mono text-xs text-accent">{child.key}</span>
                <span className="flex-1">{child.title}</span>
                <span
                  className="rounded px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: child.status.color }}
                >
                  {child.status.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {subtaskType && (
        <form onSubmit={addSubtask} className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Añadir subtarea…"
          />
          <Button type="submit" variant="secondary" disabled={loading}>
            Añadir
          </Button>
        </form>
      )}
    </section>
  );
}

function LinksSection({
  issue,
  otherIssues,
  onChanged,
}: {
  issue: IssueDetailData;
  otherIssues: { id: string; key: string; title: string }[];
  onChanged: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState("RELATES_TO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/issues/${issue.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, type }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el enlace");
      return;
    }
    setTargetId("");
    onChanged();
  }

  async function removeLink(id: string) {
    await fetch(`/api/issue-links/${id}`, { method: "DELETE" });
    onChanged();
  }

  const allLinks = [
    ...issue.linksFrom.map((l) => ({ id: l.id, label: LINK_TYPE_LABEL[l.type] ?? l.type, issue: l.target })),
    ...issue.linksTo.map((l) => ({ id: l.id, label: `es ${LINK_TYPE_LABEL[l.type] ?? l.type}`, issue: l.source })),
  ];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Incidencias enlazadas</h2>
      {allLinks.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {allLinks.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="text-ink/60">{l.label}</span>
              <Link href={`/issues/${l.issue.id}`} className="font-mono text-xs text-accent">
                {l.issue.key}
              </Link>
              <span className="flex-1 truncate">{l.issue.title}</span>
              <button
                type="button"
                onClick={() => removeLink(l.id)}
                className="text-ink/40 hover:text-red-600"
                aria-label="Quitar enlace"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addLink} className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {Object.entries(LINK_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="min-w-40 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">Elige una incidencia…</option>
          {otherIssues.map((i) => (
            <option key={i.id} value={i.id}>
              {i.key} — {i.title}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" disabled={loading || !targetId}>
          Enlazar
        </Button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function AttachmentsSection({
  issue,
  currentUserId,
  onChanged,
}: {
  issue: IssueDetailData;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { fileUrl } = await uploadAttachment(file, issue.id);
      const res = await fetch(`/api/issues/${issue.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo guardar el adjunto");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Adjuntos</h2>
      {issue.attachments.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {issue.attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-accent">
                {a.fileName}
              </a>
              <span className="text-xs text-ink/50">{Math.round(a.fileSize / 1024)} KB</span>
              {a.uploaderId === currentUserId && (
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="text-ink/40 hover:text-red-600"
                  aria-label="Eliminar adjunto"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="inline-block">
        <span className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-bg">
          {uploading ? "Subiendo…" : "Subir archivo"}
        </span>
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}

const ACTIVITY_FIELD_LABEL: Record<string, string> = {
  status: "el estado",
  assignee: "quién está asignado",
  priority: "la prioridad",
  sprint: "el sprint",
};

function ActivitySection({ issue }: { issue: IssueDetailData }) {
  if (issue.activity.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Historial</h2>
      <ul className="flex flex-col gap-1.5">
        {issue.activity.map((a) => (
          <li key={a.id} className="text-xs text-ink/60">
            <span className="font-medium text-ink/80">{a.actor.name ?? a.actor.email}</span> cambió{" "}
            {ACTIVITY_FIELD_LABEL[a.field] ?? a.field}
            {a.fromLabel && (
              <>
                {" "}
                de <span className="font-medium">{a.fromLabel}</span>
              </>
            )}
            {a.toLabel && (
              <>
                {" "}
                a <span className="font-medium">{a.toLabel}</span>
              </>
            )}
            <span className="text-ink/40"> · {new Date(a.createdAt).toLocaleString("es")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentsSection({ issue, onChanged }: { issue: IssueDetailData; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/issues/${issue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      setBody("");
      onChanged();
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Comentarios</h2>
      <ul className="mb-3 flex flex-col gap-2">
        {issue.comments.map((c) => (
          <li key={c.id} className="rounded-md border border-border bg-surface p-3 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-ink/50">
              <span className="font-medium text-ink/80">{c.author.name ?? c.author.email}</span>
              <span>{new Date(c.createdAt).toLocaleString("es")}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={addComment} className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Escribe un comentario…"
          className="w-full rounded-md border border-border bg-surface p-3 text-sm focus-visible:border-accent"
        />
        <Button type="submit" disabled={loading || !body.trim()} className="self-start">
          Comentar
        </Button>
      </form>
    </section>
  );
}
