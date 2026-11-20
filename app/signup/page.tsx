"use client";

import { useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { authErrorMessage, establishSession } from "@/lib/firebase/session-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/layout/Logo";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
      if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      await establishSession(await credential.user.getIdToken(true));
    } catch (err) {
      setLoading(false);
      setError(authErrorMessage(err));
      return;
    }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-soft">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-ink/60">Empieza a usar Altoke gratis</p>

          <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="name">
              Nombre
            </label>
            <Input data-testid="page-input-1"
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
            <Input data-testid="page-input-2"
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
            <Input data-testid="page-input-3"
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button data-testid="page-button-4" type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
          </form>

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
