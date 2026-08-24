"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchIssue = {
  id: string;
  key: string;
  title: string;
  project: { key: string; name: string };
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchIssue[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.issues);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function goTo(issue: SearchIssue) {
    setOpen(false);
    setQuery("");
    router.push(`/issues/${issue.id}`);
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-sm flex-1">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 py-1.5">
        <Search size={14} className="shrink-0 text-ink/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar una incidencia…"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-ink/50">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink/50">Sin resultados para: {query}</p>
          ) : (
            results.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => goTo(issue)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-bg"
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-accent">{issue.key}</span>
                  <span className="truncate text-xs text-ink/40">{issue.project.name}</span>
                </span>
                <span className="line-clamp-1">{issue.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
