/** Hex ("#rrggbb") <-> "R G B" (space-separated, 0-255) helpers for theming. */

export function hexToRgbTriple(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function rgbTripleToHex(triple: string): string {
  const [r, g, b] = triple.split(" ").map((n) => Number(n));
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Picks readable black/white ink for a background color, by relative luminance. */
export function readableInkFor(triple: string): string {
  const [r, g, b] = triple.split(" ").map((n) => Number(n) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.5 ? "10 10 15" : "255 255 255";
}
