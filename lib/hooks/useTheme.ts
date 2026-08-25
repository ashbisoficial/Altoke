"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, DEFAULT_THEME, type ThemeId } from "@/lib/themes";

/** Reads/writes the saved theme (localStorage + the data-theme attribute on <html>). */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? DEFAULT_THEME;
    setThemeState(saved);
    setMounted(true);
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    if (id === DEFAULT_THEME) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
  }

  return { theme, setTheme, mounted };
}
