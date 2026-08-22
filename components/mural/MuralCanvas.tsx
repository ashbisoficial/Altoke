"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadMuralImage } from "@/lib/supabase/storage";
import { MuralElementView } from "./MuralElementView";
import { STICKY_COLORS, type MuralElementData, type MuralElementType } from "./types";

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

type View = { scale: number; x: number; y: number };

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error de red");
  return res.json();
}

export function MuralCanvas({
  boardId,
  projectId,
  projectName,
  initialElements,
  canEdit,
  taskIssueTypeId,
}: {
  boardId: string;
  projectId: string;
  projectName: string;
  initialElements: MuralElementData[];
  canEdit: boolean;
  taskIssueTypeId: string | null;
}) {
  const [elements, setElements] = useState<MuralElementData[]>(initialElements);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const drawingPoints = useRef<{ x: number; y: number }[]>([]);
  const [liveStroke, setLiveStroke] = useState<{ x: number; y: number }[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`mural:${boardId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "upsert" }, ({ payload }) => {
        const el = payload as MuralElementData;
        setElements((prev) => {
          const exists = prev.some((e) => e.id === el.id);
          return exists ? prev.map((e) => (e.id === el.id ? el : e)) : [...prev, el];
        });
      })
      .on("broadcast", { event: "delete" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setElements((prev) => prev.filter((e) => e.id !== id));
        setSelectedId((s) => (s === id ? null : s));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  const broadcast = useCallback((event: "upsert" | "delete", payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const nextZIndex = useMemo(
    () => (elements.length === 0 ? 1 : Math.max(...elements.map((e) => e.zIndex)) + 1),
    [elements],
  );

  function screenToWorld(clientX: number, clientY: number) {
    const rect = viewportRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  async function createElement(type: MuralElementType, extra: Partial<MuralElementData>) {
    if (!canEdit) return;
    const center = screenToWorld(
      viewportRef.current!.clientWidth / 2 + viewportRef.current!.getBoundingClientRect().left,
      viewportRef.current!.clientHeight / 2 + viewportRef.current!.getBoundingClientRect().top,
    );
    const base = {
      type,
      x: center.x - (extra.width ?? 180) / 2,
      y: center.y - (extra.height ?? 140) / 2,
      width: 180,
      height: 140,
      rotation: 0,
      color: null as string | null,
      zIndex: nextZIndex,
      content: {},
      ...extra,
    };
    try {
      const { element } = await api(`/api/boards/${boardId}/elements`, {
        method: "POST",
        body: JSON.stringify(base),
      });
      setElements((prev) => [...prev, element]);
      broadcast("upsert", element);
      setSelectedId(element.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el elemento");
    }
  }

  function addStickyNote() {
    const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    createElement("STICKY_NOTE", { width: 180, height: 140, color, content: { text: "" } });
  }

  function addText() {
    createElement("TEXT", { width: 200, height: 50, content: { text: "Texto" } });
  }

  function addFrame() {
    createElement("FRAME", {
      width: 360,
      height: 260,
      zIndex: elements.length === 0 ? 0 : Math.min(...elements.map((e) => e.zIndex)) - 1,
      content: { title: "Marco" },
    });
  }

  async function addImage(file: File) {
    if (!canEdit) return;
    try {
      const { fileUrl } = await uploadMuralImage(file, boardId);
      const img = new Image();
      img.src = fileUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const maxDim = 320;
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      const width = ratio >= 1 ? maxDim : maxDim * ratio;
      const height = ratio >= 1 ? maxDim / ratio : maxDim;
      await createElement("IMAGE", { width, height, content: { url: fileUrl } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    }
  }

  async function updateElement(id: string, data: Partial<MuralElementData>, andBroadcast = true) {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    if (!andBroadcast) return;
    try {
      const { element } = await api(`/api/mural-elements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      broadcast("upsert", element);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cambio");
    }
  }

  async function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    setSelectedId(null);
    setElements((prev) => prev.filter((e) => e.id !== id));
    await api(`/api/mural-elements/${id}`, { method: "DELETE" }).catch(() => {});
    broadcast("delete", { id });
  }

  function reorder(direction: "front" | "back") {
    if (!selectedId) return;
    const z =
      direction === "front"
        ? Math.max(...elements.map((e) => e.zIndex), 0) + 1
        : Math.min(...elements.map((e) => e.zIndex), 0) - 1;
    updateElement(selectedId, { zIndex: z });
  }

  function setColor(color: string) {
    if (!selectedId) return;
    updateElement(selectedId, { color });
  }

  async function convertToIssue() {
    const el = elements.find((e) => e.id === selectedId);
    if (!el || !taskIssueTypeId) return;
    const text = typeof el.content.text === "string" ? el.content.text : "";
    if (!text.trim()) {
      setError("Escribe algo en el post-it antes de convertirlo en incidencia");
      return;
    }
    setConverting(true);
    setError(null);
    try {
      const { issue } = await api("/api/issues", {
        method: "POST",
        body: JSON.stringify({ projectId, issueTypeId: taskIssueTypeId, title: text.trim() }),
      });
      await updateElement(el.id, { content: { ...el.content, issueId: issue.id, issueKey: issue.key } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo convertir en incidencia");
    } finally {
      setConverting(false);
    }
  }

  // --- Panning & zoom -------------------------------------------------

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    if (mode === "draw") return;
    if (e.target !== e.currentTarget) return;
    setSelectedId(null);
    (e.target as Element).setPointerCapture(e.pointerId);
    panState.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
  }

  function handleBackgroundPointerMove(e: React.PointerEvent) {
    if (!panState.current) return;
    const dx = e.clientX - panState.current.px;
    const dy = e.clientY - panState.current.py;
    setView((v) => ({ ...v, x: panState.current!.vx + dx, y: panState.current!.vy + dy }));
  }

  function handleBackgroundPointerUp() {
    panState.current = null;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = viewportRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const worldX = (px - v.x) / v.scale;
      const worldY = (py - v.y) / v.scale;
      return { scale: newScale, x: px - worldX * newScale, y: py - worldY * newScale };
    });
  }

  function zoomBy(factor: number) {
    setView((v) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const cx = viewportRef.current!.clientWidth / 2;
      const cy = viewportRef.current!.clientHeight / 2;
      const worldX = (cx - v.x) / v.scale;
      const worldY = (cy - v.y) / v.scale;
      return { scale: newScale, x: cx - worldX * newScale, y: cy - worldY * newScale };
    });
  }

  // --- Free-hand drawing ------------------------------------------------

  function handleDrawPointerDown(e: React.PointerEvent) {
    if (mode !== "draw" || !canEdit) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = screenToWorld(e.clientX, e.clientY);
    drawingPoints.current = [p];
    setLiveStroke([p]);
  }

  function handleDrawPointerMove(e: React.PointerEvent) {
    if (mode !== "draw" || drawingPoints.current.length === 0) return;
    const p = screenToWorld(e.clientX, e.clientY);
    drawingPoints.current.push(p);
    setLiveStroke([...drawingPoints.current]);
  }

  async function handleDrawPointerUp() {
    if (mode !== "draw" || drawingPoints.current.length < 2) {
      drawingPoints.current = [];
      setLiveStroke(null);
      return;
    }
    const points = drawingPoints.current;
    drawingPoints.current = [];
    setLiveStroke(null);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(1, Math.max(...xs) - minX);
    const height = Math.max(1, Math.max(...ys) - minY);
    await createElement("DRAWING", {
      x: minX,
      y: minY,
      width,
      height,
      color: "#14161F",
      content: { points },
    });
  }

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link href={`/projects/${projectId}/murals`} className="text-xs text-accent underline underline-offset-4">
          ← Murales
        </Link>
        <span className="text-sm font-medium">{projectName}</span>

        {canEdit && (
          <div className="ml-4 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`rounded px-2 py-1 text-xs ${mode === "select" ? "bg-accent text-white" : "hover:bg-bg"}`}
            >
              Seleccionar
            </button>
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`rounded px-2 py-1 text-xs ${mode === "draw" ? "bg-accent text-white" : "hover:bg-bg"}`}
            >
              Dibujar
            </button>
            <button type="button" onClick={addStickyNote} className="rounded px-2 py-1 text-xs hover:bg-bg">
              + Post-it
            </button>
            <button type="button" onClick={addText} className="rounded px-2 py-1 text-xs hover:bg-bg">
              + Texto
            </button>
            <button type="button" onClick={addFrame} className="rounded px-2 py-1 text-xs hover:bg-bg">
              + Marco
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded px-2 py-1 text-xs hover:bg-bg"
            >
              + Imagen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) addImage(file);
              }}
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 text-xs">
          <button type="button" onClick={() => zoomBy(1 / 1.2)} className="rounded px-2 py-1 hover:bg-bg">
            −
          </button>
          <span className="w-10 text-center text-ink/60">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.2)} className="rounded px-2 py-1 hover:bg-bg">
            +
          </button>
          <button
            type="button"
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
            className="rounded px-2 py-1 hover:bg-bg"
          >
            Reset
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="bg-red-50 px-3 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {selected && canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
          <span className="font-medium">Elemento seleccionado</span>
          {(selected.type === "STICKY_NOTE" || selected.type === "DRAWING") && (
            <div className="flex gap-1">
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          )}
          <button type="button" onClick={() => reorder("front")} className="rounded px-2 py-1 hover:bg-bg">
            Traer al frente
          </button>
          <button type="button" onClick={() => reorder("back")} className="rounded px-2 py-1 hover:bg-bg">
            Enviar atrás
          </button>
          {selected.type === "STICKY_NOTE" && taskIssueTypeId && (
            <button
              type="button"
              onClick={convertToIssue}
              disabled={converting}
              className="rounded px-2 py-1 text-accent hover:bg-bg"
            >
              {typeof selected.content.issueKey === "string"
                ? `Vinculado a ${selected.content.issueKey}`
                : converting
                  ? "Convirtiendo…"
                  : "Convertir en incidencia"}
            </button>
          )}
          <button
            type="button"
            onClick={deleteSelected}
            className="ml-auto rounded px-2 py-1 text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        </div>
      )}

      <div
        ref={viewportRef}
        onPointerDown={mode === "draw" ? handleDrawPointerDown : handleBackgroundPointerDown}
        onPointerMove={mode === "draw" ? handleDrawPointerMove : handleBackgroundPointerMove}
        onPointerUp={mode === "draw" ? handleDrawPointerUp : handleBackgroundPointerUp}
        onWheel={handleWheel}
        className="relative flex-1 touch-none overflow-hidden bg-bg"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          cursor: mode === "draw" ? "crosshair" : "grab",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {elements.map((el) => (
            <MuralElementView
              key={el.id}
              element={el}
              scale={view.scale}
              selected={el.id === selectedId}
              canEdit={canEdit && mode === "select"}
              onSelect={setSelectedId}
              onMove={(id, x, y) => updateElement(id, { x, y }, false)}
              onMoveEnd={(id, x, y) => updateElement(id, { x, y })}
              onResize={(id, x, y, width, height) => updateElement(id, { x, y, width, height }, false)}
              onResizeEnd={(id, x, y, width, height) => updateElement(id, { x, y, width, height })}
              onTextChange={(id, text) => {
                const el2 = elements.find((e) => e.id === id);
                if (!el2) return;
                const key = el2.type === "FRAME" ? "title" : "text";
                updateElement(id, { content: { ...el2.content, [key]: text } });
              }}
            />
          ))}
          {liveStroke && liveStroke.length > 1 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width={1}
              height={1}
            >
              <polyline
                points={liveStroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#14161F"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
