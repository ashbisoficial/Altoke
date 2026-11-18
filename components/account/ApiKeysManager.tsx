"use client";

import { useState } from "react";
import { Copy, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Scope = "READ" | "WRITE" | "TEST_RESULTS";

const SCOPE_LABEL: Record<Scope, string> = {
  READ: "Leer",
  WRITE: "Crear y editar",
  TEST_RESULTS: "Subir resultados de pruebas",
};

const EXPIRY_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "never", label: "Sin caducidad", days: null },
  { value: "30", label: "30 días", days: 30 },
  { value: "90", label: "90 días", days: 90 },
  { value: "365", label: "1 año", days: 365 },
];

type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: Scope[];
  expiresAt: string | null;
  requestsPerMinute: number;
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
  const [scopes, setScopes] = useState<Scope[]>(["READ"]);
  const [expiry, setExpiry] = useState("never");

  function toggleScope(scope: Scope) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (scopes.length === 0) {
      setError("Elige al menos un alcance");
      return;
    }
    setLoading(true);
    setError(null);
    const days = EXPIRY_OPTIONS.find((o) => o.value === expiry)?.days ?? null;
    const res = await fetch("/api/account/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scopes, expiresInDays: days }),
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
    setScopes(["READ"]);
    setExpiry("never");
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
            <Button type="button" variant="secondary" onClick={copyKey} data-testid="api-key-copy-button">
              <Copy size={14} />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <button data-testid="api-keys-manager-button-ya-la-guarde-cerrar"
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
            id="key-name" data-testid="api-key-name-input"
            placeholder="Ej: Script de reportes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="w-full">
          <fieldset className="flex flex-wrap gap-3 text-xs">
            <legend className="mb-1 font-medium">Alcances</legend>
            {(Object.keys(SCOPE_LABEL) as Scope[]).map((scope) => (
              <label key={scope} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  data-testid={`api-key-scope-${scope.toLowerCase()}-checkbox`}
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                {SCOPE_LABEL[scope]}
              </label>
            ))}
          </fieldset>
          <label className="mt-2 flex items-center gap-2 text-xs">
            Caducidad
            <select
              data-testid="api-key-expiry-select"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" disabled={loading || !name.trim()} data-testid="api-key-create-button">
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
              <span className="text-xs text-ink/50">
                {key.scopes.map((sc) => SCOPE_LABEL[sc]).join(", ") || "Sin alcances"}
              </span>
              <span className="text-xs text-ink/40">
                {key.expiresAt
                  ? `${new Date(key.expiresAt).getTime() <= Date.now() ? "Caducó" : "Caduca"} el ${formatDate(key.expiresAt)}`
                  : "Sin caducidad"}
              </span>
              <span className="text-xs text-ink/40">Creada el {formatDate(key.createdAt)}</span>
              {key.lastUsedAt && (
                <span className="text-xs text-ink/40">Usada por última vez el {formatDate(key.lastUsedAt)}</span>
              )}
              {key.revokedAt ? (
                <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Revocada</span>
              ) : (
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)} data-testid={`api-key-revoke-${key.id}`}
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
