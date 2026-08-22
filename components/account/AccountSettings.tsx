"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AccountSettings({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || null }),
    });
    setSavingName(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNameError(body.error ?? "No se pudo guardar");
      return;
    }
    setNameSaved(true);
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (password.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 font-heading text-lg font-semibold">Información personal</h2>
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium" htmlFor="account-email">
              Correo
            </label>
            <Input id="account-email" value={email} disabled className="opacity-60" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="account-name">
              Nombre
            </label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameSaved(false);
              }}
              placeholder="Tu nombre"
            />
          </div>
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={savingName} className="w-fit">
              {savingName ? "Guardando…" : "Guardar"}
            </Button>
            {nameSaved && <span className="text-sm text-status-done">Guardado</span>}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 font-heading text-lg font-semibold">Cambiar contraseña</h2>
        <form onSubmit={savePassword} className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium" htmlFor="new-password">
              Nueva contraseña
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordSaved(false);
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="confirm-password">
              Repite la nueva contraseña
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordSaved(false);
              }}
            />
          </div>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={savingPassword} className="w-fit">
              {savingPassword ? "Guardando…" : "Cambiar contraseña"}
            </Button>
            {passwordSaved && <span className="text-sm text-status-done">Contraseña actualizada</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
