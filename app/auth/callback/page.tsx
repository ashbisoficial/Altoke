"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink, applyActionCode } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const EMAIL_FOR_SIGN_IN_KEY = "altoke:emailForSignIn";

/**
 * Lands here from two kinds of Firebase email links: a magic-link sign-in
 * (isSignInWithEmailLink) or an email-verification link from signup
 * (?mode=verifyEmail). Both are resolved client-side — Firebase's
 * action-link handling lives in the client SDK, there's no server-side
 * "exchange a code" step like Supabase's old callback route had.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "need-email" | "verified">("working");
  const [email, setEmail] = useState("");

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(emailOverride?: string) {
    const auth = getFirebaseAuth();
    const href = window.location.href;
    const next = searchParams.get("next") ?? "/dashboard";

    if (isSignInWithEmailLink(auth, href)) {
      const storedEmail = emailOverride ?? window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (!storedEmail) {
        setStatus("need-email");
        return;
      }
      try {
        const credential = await signInWithEmailLink(auth, storedEmail, href);
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
        const idToken = await credential.user.getIdToken();
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error();
        router.push(next);
        router.refresh();
      } catch {
        router.replace("/auth/auth-code-error");
      }
      return;
    }

    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    if (mode === "verifyEmail" && oobCode) {
      try {
        await applyActionCode(auth, oobCode);
        setStatus("verified");
      } catch {
        router.replace("/auth/auth-code-error");
      }
      return;
    }

    router.replace("/auth/auth-code-error");
  }

  if (status === "need-email") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStatus("working");
            void run(email);
          }}
          className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-soft"
        >
          <h1 className="font-heading text-xl font-semibold">Confirma tu correo</h1>
          <p className="mt-2 text-sm text-ink/60">
            Abriste el enlace en otro dispositivo o navegador — escribe tu correo para continuar.
          </p>
          <label className="mt-4 block text-sm font-medium" htmlFor="confirm-email">
            Correo
          </label>
          <Input
            id="confirm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
          <Button type="submit" className="mt-4 w-full">
            Continuar
          </Button>
        </form>
      </main>
    );
  }

  if (status === "verified") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-heading text-2xl font-semibold">¡Correo confirmado!</h1>
        <p className="max-w-sm text-sm text-ink/70">Ya puedes iniciar sesión con tu contraseña.</p>
        <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-ink/60">Confirmando…</p>
    </main>
  );
}
