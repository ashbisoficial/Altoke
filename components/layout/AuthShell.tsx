import { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/* Shared frame for /login and /signup: a faint dotted field plus a soft
   accent glow behind the card, instead of a plain card floating on an
   empty flat background. */
export function AuthShell({ tagline, children }: { tagline: string; children: ReactNode }) {
  return (
    <main className="bg-dot-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[8%] h-72 w-72 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--accent)), transparent 70%)" }}
      />
      <div className="shadow-elevated animate-rise relative w-full max-w-sm rounded-xl border border-border bg-surface p-8">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-ink/60">{tagline}</p>
        {children}
      </div>
    </main>
  );
}
