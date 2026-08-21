"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-ink/60">Empieza a usar La Pega gratis</p>

        {done ? (
          <p className="mt-6 text-sm text-ink/70">
            Revisa tu correo <strong>{email}</strong> para confirmar tu cuenta.
          </p>
        ) : (
          <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="name">
              Nombre
            </label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="text-sm font-medium" htmlFor="email">
              Correo
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/60">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-accent underline underline-offset-4">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
