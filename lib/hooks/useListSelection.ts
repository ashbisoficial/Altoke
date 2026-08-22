import { useEffect, useState } from "react";

/**
 * Tracks the selected id for a <select> backed by a list that can arrive
 * empty and populate later, grow, or shrink while the component stays
 * mounted (e.g. after router.refresh() following a mutation). A plain
 * `useState(items[0]?.id ?? "")` only evaluates its initializer on the
 * first render, so once the list changes shape the selection silently goes
 * stale — the <select> falls back to showing the first option while the
 * actual state (and whatever gets submitted) stays pointed at nothing.
 */
export function useListSelection<T extends { id: string }>(
  items: T[],
): [string, (id: string) => void] {
  const [selected, setSelected] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    if (!items.some((item) => item.id === selected)) {
      setSelected(items[0].id);
    }
  }, [items, selected]);

  return [selected, setSelected];
}
