"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";

export function LogoutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Cerrar sesión"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 hover:bg-bg hover:text-ink"
      >
        <LogOut size={17} />
      </button>
    );
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      <LogOut size={14} />
      Cerrar sesión
    </Button>
  );
}
