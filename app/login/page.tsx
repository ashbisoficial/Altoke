"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-soft">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-ink/60">Inicia sesión para continuar</p>

        <div className="mt-6 flex gap-2 rounded-lg border border-border p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded px-3 py-1.5 ${mode === "password" ? "bg-accent text-accentInk" : "text-ink/70"}`}
          >
            Contraseña
          </button>
          <button
            type="button"
            onClick={() => setMode("magic-link")}
            className={`flex-1 rounded px-3 py-1.5 ${mode === "magic-link" ? "bg-accent text-accentInk" : "text-ink/70"}`}
          >
            Enlace mágico
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordSignIn} className="mt-6 flex flex-col gap-3">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        ) : magicLinkSent ? (
          <p className="mt-6 text-sm text-ink/70">
            Revisa tu correo <strong>{email}</strong> y sigue el enlace para entrar.
          </p>
        ) : (
          <form onSubmit={handleMagicLink} className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="magic-email">
              Correo
            </label>
            <Input
              id="magic-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Enviando…" : "Enviar enlace mágico"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/60">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="text-accent underline underline-offset-4">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}
