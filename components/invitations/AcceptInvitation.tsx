"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AcceptInvitation({ token, isLoggedIn }: { token: string; isLoggedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo aceptar la invitación");
      return;
    }
    const { redirectTo } = await res.json();
    router.push(redirectTo ?? "/dashboard");
    router.refresh();
  }

  if (!isLoggedIn) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button data-testid="accept-invitation-button-1" onClick={() => router.push(`/signup?next=${next}`)}>Crear cuenta y unirme</Button>
        <Button data-testid="accept-invitation-button-2" variant="secondary" onClick={() => router.push(`/login?next=${next}`)}>
          Ya tengo cuenta
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button data-testid="accept-invitation-button-3" onClick={accept} disabled={loading}>
        {loading ? "Uniéndote…" : "Aceptar invitación"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
