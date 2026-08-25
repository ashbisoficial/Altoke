"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Palette } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/lib/hooks/useTheme";

export function ThemeQuickSwitcher() {
  const { theme, setTheme, mounted } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Cambiar tema"
        title="Cambiar tema"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 hover:bg-bg hover:text-ink"
      >
        <Palette size={17} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Tema</span>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg"
              >
                <span className="flex -space-x-1">
                  {t.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="h-4 w-4 rounded-full border-2 border-surface"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="flex-1">{t.label}</span>
                {theme === t.id && <Check size={14} className="text-accent" />}
              </button>
            ))}
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-xs text-accent hover:underline"
          >
            Personalizar colores →
          </Link>
        </div>
      )}
    </div>
  );
}
