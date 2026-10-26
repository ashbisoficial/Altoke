"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { firebaseErrorMessage } from "@/lib/firebase/errors";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3277-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4404 1.346l2.5818-2.5818C13.4632.8918 11.43 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6723 5.1627 6.6559 3.5795 9 3.5795z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", label: "Google", Icon: GoogleIcon, make: () => new GoogleAuthProvider() },
  { id: "github", label: "GitHub", Icon: GithubIcon, make: () => new GithubAuthProvider() },
  // Microsoft: desactivado hasta tener una app registrada en Entra ID —
  // reactivar agregándolo de vuelta a ACTIVE_PROVIDER_IDS abajo.
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon, make: () => new OAuthProvider("microsoft.com") },
] as const;

const ACTIVE_PROVIDER_IDS: ReadonlySet<string> = new Set(["google", "github"]);

/** Google / GitHub / Microsoft sign-in — shared by /login and /signup since
 *  both just need a Firebase ID token handed to the same session endpoint. */
export function SocialAuthButtons({ next, onError }: { next: string; onError: (message: string) => void }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSignIn(id: string, make: () => GoogleAuthProvider | GithubAuthProvider | OAuthProvider) {
    setLoadingId(id);
    onError("");
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithPopup(auth, make());
      const idToken = await credential.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("No se pudo iniciar sesión");
      router.push(next);
      router.refresh();
    } catch (err) {
      const cancelled =
        err instanceof FirebaseError &&
        (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request");
      if (!cancelled) onError(firebaseErrorMessage(err));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.filter((p) => ACTIVE_PROVIDER_IDS.has(p.id)).map(({ id, label, Icon, make }) => (
        <button
          key={id}
          type="button"
          disabled={loadingId !== null}
          onClick={() => handleSignIn(id, make)}
          className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ink/20 hover:bg-bg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          <Icon />
          {loadingId === id ? "Conectando…" : `Continuar con ${label}`}
        </button>
      ))}
    </div>
  );
}
