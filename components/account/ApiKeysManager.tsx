"use client";

import { useState } from "react";
import { Copy, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/account/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la llave");
      return;
    }
    setKeys((prev) => [data.apiKey, ...prev]);
    setNewKey(data.apiKey.key);
    setName("");
  }

  async function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink/60">
        Usá una llave de API para conectar Altoke con otra herramienta o script — crear y leer
        incidencias desde afuera, actuando como vos. Guardá cada llave en un lugar seguro: no la
        volvemos a mostrar completa después de crearla.
      </p>

      {newKey && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium">Tu llave nueva — copiala ahora, no la vas a volver a ver:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs">
              {newKey}
            </code>
            <Button type="button" variant="secondary" onClick={copyKey}>
              <Copy size={14} />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-ink/50 hover:text-ink"
          >
            Ya la guardé, cerrar
          </button>
        </div>
      )}

      <form onSubmit={createKey} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label className="text-xs font-medium" htmlFor="key-name">
            Nombre de la llave
          </label>
          <Input
            id="key-name"
            placeholder="Ej: Script de reportes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading || !name.trim()}>
          <Key size={14} />
          Crear llave
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {keys.length === 0 ? (
        <p className="text-sm text-ink/50">Todavía no creaste ninguna llave.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium">{key.name}</span>
              <code className="text-xs text-ink/50">{key.keyPrefix}…</code>
              <span className="text-xs text-ink/40">Creada el {formatDate(key.createdAt)}</span>
              {key.lastUsedAt && (
                <span className="text-xs text-ink/40">Usada por última vez el {formatDate(key.lastUsedAt)}</span>
              )}
              {key.revokedAt ? (
                <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Revocada</span>
              ) : (
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:underline"
                >
                  <Trash2 size={12} />
                  Revocar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
