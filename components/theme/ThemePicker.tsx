"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { THEMES, CUSTOM_COLORS_STORAGE_KEY, DEFAULT_THEME } from "@/lib/themes";
import { hexToRgbTriple, rgbTripleToHex, readableInkFor } from "@/lib/color";
import { useTheme } from "@/lib/hooks/useTheme";

type CustomColors = { accent?: string; accent2?: string; accent3?: string };

const COLOR_LABELS: { key: keyof CustomColors; label: string }[] = [
  { key: "accent", label: "Acento principal (botones, enlaces)" },
  { key: "accent2", label: "Acento secundario" },
  { key: "accent3", label: "Acento terciario" },
];

function currentColors(): CustomColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => {
    const triple = style.getPropertyValue(name).trim();
    return triple ? rgbTripleToHex(triple) : undefined;
  };
  return { accent: read("--accent"), accent2: read("--accent2"), accent3: read("--accent3") };
}

export function ThemePicker() {
  const { theme, setTheme, mounted: themeMounted } = useTheme();
  const [customEnabled, setCustomEnabled] = useState(false);
  const [colors, setColors] = useState<CustomColors>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedColorsRaw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    if (savedColorsRaw) {
      try {
        setColors(JSON.parse(savedColorsRaw));
        setCustomEnabled(true);
      } catch {
        setColors(currentColors());
      }
    } else {
      setColors(currentColors());
    }
    setMounted(true);
  }, []);

  function applyTheme(id: typeof theme) {
    setTheme(id);
    if (!customEnabled) setColors(currentColors());
  }

  function persistAndApply(next: CustomColors) {
    localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(next));
    for (const { key } of COLOR_LABELS) {
      const hex = next[key];
      if (!hex) continue;
      const triple = hexToRgbTriple(hex);
      if (!triple) continue;
      document.documentElement.style.setProperty(`--${key}`, triple);
      if (key === "accent") document.documentElement.style.setProperty("--accent-ink", readableInkFor(triple));
    }
  }

  function applyCustomColor(key: keyof CustomColors, hex: string) {
    const next = { ...colors, [key]: hex };
    setColors(next);
    if (customEnabled) persistAndApply(next);
  }

  function toggleCustom(enabled: boolean) {
    setCustomEnabled(enabled);
    if (enabled) {
      persistAndApply(colors);
      return;
    }
    localStorage.removeItem(CUSTOM_COLORS_STORAGE_KEY);
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-ink");
    document.documentElement.style.removeProperty("--accent2");
    document.documentElement.style.removeProperty("--accent3");
    setColors(currentColors());
  }

  function resetAll() {
    setTheme(DEFAULT_THEME);
    localStorage.removeItem(CUSTOM_COLORS_STORAGE_KEY);
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-ink");
    document.documentElement.style.removeProperty("--accent2");
    document.documentElement.style.removeProperty("--accent3");
    setCustomEnabled(false);
    setColors(currentColors());
  }

  if (!mounted || !themeMounted) return null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-heading text-sm font-semibold">Tema</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTheme(t.id)}
              className={`shadow-soft-hover flex items-center gap-3 rounded-xl border-2 bg-surface p-3 text-left transition-colors ${
                theme === t.id ? "border-accent" : "border-border"
              }`}
            >
              <span className="flex -space-x-1.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border-2 border-surface"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="flex-1 text-sm font-medium">{t.label}</span>
              {theme === t.id && <Check size={16} className="text-accent" />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">Colores personalizados</h2>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={customEnabled}
              onChange={(e) => toggleCustom(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Activar
          </label>
        </div>
        <p className="mb-3 text-xs text-ink/50">
          Elegí tus propios colores de acento — se aplican encima del tema que elijas arriba.
        </p>
        <div className="flex flex-col gap-2">
          {COLOR_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <input
                type="color"
                value={colors[key] ?? "#000000"}
                disabled={!customEnabled}
                onChange={(e) => applyCustomColor(key, e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-border disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-sm">{label}</span>
              <code className="ml-auto text-xs text-ink/40">{(colors[key] ?? "").toUpperCase()}</code>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={resetAll}
        className="flex w-fit items-center gap-1.5 text-xs text-ink/50 hover:text-ink"
      >
        <RotateCcw size={12} />
        Restablecer todo al tema por defecto
      </button>
    </div>
  );
}
