"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { authErrorMessage, establishSession } from "@/lib/firebase/session-client";

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}

/** Completa el inicio de sesión por enlace mágico (Firebase "email link"). */
function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/dashboard";
    const auth = firebaseAuth();
    const href = window.location.href;

    if (!isSignInWithEmailLink(auth, href)) {
      router.replace("/auth/auth-code-error");
      return;
    }
    // El correo puede abrirse en otro navegador: si no está guardado, se pide.
    const email =
      window.localStorage.getItem("altoke-email-link") ??
      window.prompt("Escribe el correo con el que pediste el enlace") ??
      "";

    signInWithEmailLink(auth, email, href)
      .then((credential) => credential.user.getIdToken(true))
      .then((idToken) => establishSession(idToken))
      .then(() => {
        window.localStorage.removeItem("altoke-email-link");
        router.replace(next);
        router.refresh();
      })
      .catch((err) => setError(authErrorMessage(err)));
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <p className="text-sm text-ink/70">{error ?? "Iniciando sesión…"}</p>
    </main>
  );
}
