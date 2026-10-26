"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, sendSignInLinkToEmail, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { firebaseErrorMessage } from "@/lib/firebase/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/components/layout/AuthShell";
import { SocialAuthButtons } from "@/components/layout/SocialAuthButtons";

const EMAIL_FOR_SIGN_IN_KEY = "altoke:emailForSignIn";

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

  async function establishSession(idToken: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("No se pudo iniciar sesión");
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const auth = getFirebaseAuth();
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        await signOut(auth);
        setError("Confirma tu correo antes de iniciar sesión — revisa tu bandeja de entrada.");
        setLoading(false);
        return;
      }
      await establishSession(await credential.user.getIdToken());
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const auth = getFirebaseAuth();
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
      setMagicLinkSent(true);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell tagline="Inicia sesión para continuar">
        <div className="mt-6">
          <SocialAuthButtons next={next} onError={setError} />
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-ink/40">
          <span className="h-px flex-1 bg-border" />
          o con tu correo
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-2 rounded-lg border border-border p-1 text-sm">
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
    </AuthShell>
  );
}
