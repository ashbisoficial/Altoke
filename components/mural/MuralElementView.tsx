"use client";

import { useRef, useState } from "react";
import type { MuralElementData } from "./types";

const MIN_SIZE = 40;

export function MuralElementView({
  element,
  scale,
  selected,
  canEdit,
  onSelect,
  onMove,
  onMoveEnd,
  onResize,
  onResizeEnd,
  onTextChange,
}: {
  element: MuralElementData;
  scale: number;
  selected: boolean;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onTextChange: (id: string, text: string) => void;
}) {
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);

  function handlePointerDown(e: React.PointerEvent) {
    if (!canEdit) return;
    onSelect(element.id);
    if (editing) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, x: element.x, y: element.y };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = (e.clientX - dragStart.current.px) / scale;
    const dy = (e.clientY - dragStart.current.py) / scale;
    onMove(element.id, dragStart.current.x + dx, dragStart.current.y + dy);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = (e.clientX - dragStart.current.px) / scale;
    const dy = (e.clientY - dragStart.current.py) / scale;
    onMoveEnd(element.id, dragStart.current.x + dx, dragStart.current.y + dy);
    dragStart.current = null;
  }

  function handleResizeStart(e: React.PointerEvent, corner: "nw" | "ne" | "sw" | "se") {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, x: element.x, y: element.y, w: element.width, h: element.height };

    function onMoveResize(ev: PointerEvent) {
      const dx = (ev.clientX - start.px) / scale;
      const dy = (ev.clientY - start.py) / scale;
      let { x, y, w, h } = start;
      if (corner.includes("e")) w = Math.max(MIN_SIZE, start.w + dx);
      if (corner.includes("s")) h = Math.max(MIN_SIZE, start.h + dy);
      if (corner.includes("w")) {
        w = Math.max(MIN_SIZE, start.w - dx);
        x = start.x + (start.w - w);
      }
      if (corner.includes("n")) {
        h = Math.max(MIN_SIZE, start.h - dy);
        y = start.y + (start.h - h);
      }
      onResize(element.id, x, y, w, h);
    }

    function onUpResize(ev: PointerEvent) {
      const dx = (ev.clientX - start.px) / scale;
      const dy = (ev.clientY - start.py) / scale;
      let { x, y, w, h } = start;
      if (corner.includes("e")) w = Math.max(MIN_SIZE, start.w + dx);
      if (corner.includes("s")) h = Math.max(MIN_SIZE, start.h + dy);
      if (corner.includes("w")) {
        w = Math.max(MIN_SIZE, start.w - dx);
        x = start.x + (start.w - w);
      }
      if (corner.includes("n")) {
        h = Math.max(MIN_SIZE, start.h - dy);
        y = start.y + (start.h - h);
      }
      onResizeEnd(element.id, x, y, w, h);
      window.removeEventListener("pointermove", onMoveResize);
      window.removeEventListener("pointerup", onUpResize);
    }

    window.addEventListener("pointermove", onMoveResize);
    window.addEventListener("pointerup", onUpResize);
  }

  const text = typeof element.content.text === "string" ? element.content.text : "";
  const title = typeof element.content.title === "string" ? element.content.title : "";

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    touchAction: "none",
  };

  let body: React.ReactNode;

  if (element.type === "STICKY_NOTE") {
    body = editing ? (
      <textarea
        autoFocus
        defaultValue={text}
        onBlur={(e) => {
          setEditing(false);
          onTextChange(element.id, e.target.value);
        }}
        className="h-full w-full resize-none bg-transparent p-3 text-sm outline-none"
      />
    ) : (
      <p className="h-full w-full overflow-hidden whitespace-pre-wrap p-3 text-sm">{text || "Escribe algo…"}</p>
    );
  } else if (element.type === "TEXT") {
    body = editing ? (
      <textarea
        autoFocus
        defaultValue={text}
        onBlur={(e) => {
          setEditing(false);
          onTextChange(element.id, e.target.value);
        }}
        className="h-full w-full resize-none bg-transparent p-1 text-lg font-medium outline-none"
      />
    ) : (
      <p className="h-full w-full overflow-hidden whitespace-pre-wrap p-1 text-lg font-medium">
        {text || "Texto"}
      </p>
    );
  } else if (element.type === "FRAME") {
    body = (
      <div className="h-full w-full rounded-md border-2 border-ink/20 bg-ink/[0.02]">
        {editing ? (
          <input
            autoFocus
            defaultValue={title}
            onBlur={(e) => {
              setEditing(false);
              onTextChange(element.id, e.target.value);
            }}
            className="absolute -top-7 left-0 rounded bg-surface px-2 py-0.5 text-xs font-semibold outline-none"
          />
        ) : (
          <span className="absolute -top-7 left-0 rounded bg-surface px-2 py-0.5 text-xs font-semibold text-ink/70">
            {title || "Marco"}
          </span>
        )}
      </div>
    );
  } else if (element.type === "IMAGE") {
    const url = typeof element.content.url === "string" ? element.content.url : "";
    body = url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-full w-full rounded-md object-cover" draggable={false} />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded-md bg-ink/5 text-xs text-ink/40">
        Imagen
      </div>
    );
  } else {
    const points = Array.isArray(element.content.points)
      ? (element.content.points as { x: number; y: number }[])
      : [];
    const pointsAttr = points.map((p) => `${p.x - element.x},${p.y - element.y}`).join(" ");
    body = (
      <svg width={element.width} height={element.height} className="pointer-events-none overflow-visible">
        <polyline
          points={pointsAttr}
          fill="none"
          stroke={element.color ?? "#14161F"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        backgroundColor: element.type === "STICKY_NOTE" ? (element.color ?? "#FEF08A") : undefined,
      }}
      className={`group ${element.type === "STICKY_NOTE" ? "rounded-md shadow-sm" : ""} ${
        selected ? "ring-2 ring-accent ring-offset-2" : ""
      } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => canEdit && element.type !== "IMAGE" && element.type !== "DRAWING" && setEditing(true)}
    >
      {body}
      {selected && canEdit && (
        <>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              onPointerDown={(e) => handleResizeStart(e, corner)}
              className="absolute h-3 w-3 rounded-full border-2 border-accent bg-surface"
              style={{
                top: corner.includes("n") ? -6 : undefined,
                bottom: corner.includes("s") ? -6 : undefined,
                left: corner.includes("w") ? -6 : undefined,
                right: corner.includes("e") ? -6 : undefined,
                cursor: `${corner}-resize`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
