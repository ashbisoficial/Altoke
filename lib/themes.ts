export type ThemeId = "light" | "dark" | "retro" | "minimal" | "maximal" | "futuristic" | "gamer";

export const THEME_STORAGE_KEY = "altoke-theme";
export const CUSTOM_COLORS_STORAGE_KEY = "altoke-custom-colors";

/** Mirrors the palettes defined in app/globals.css — only used to preview
 * themes in the picker UI, the actual colors always come from the CSS. */
export const THEMES: { id: ThemeId; label: string; swatches: [string, string, string] }[] = [
  { id: "light", label: "Claro", swatches: ["#FAF7F2", "#2952CC", "#7C3AED"] },
  { id: "dark", label: "Oscuro", swatches: ["#15131C", "#4C6FFF", "#A78BFA"] },
  { id: "retro", label: "Retro", swatches: ["#F1E4CE", "#B4552A", "#7C8A4A"] },
  { id: "minimal", label: "Minimalista", swatches: ["#FFFFFF", "#171717", "#737373"] },
  { id: "maximal", label: "Maximalista", swatches: ["#FFF4FB", "#FF2D78", "#FFB800"] },
  { id: "futuristic", label: "Futurista", swatches: ["#060B18", "#00E5FF", "#7C4DFF"] },
  { id: "gamer", label: "Gamer", swatches: ["#0A0A0F", "#39FF14", "#B026FF"] },
];

export const DEFAULT_THEME: ThemeId = "light";
