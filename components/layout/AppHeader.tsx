import Link from "next/link";
import { UserRound } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
      <Link href="/dashboard" className="font-heading text-lg font-semibold">
        Altoke
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <Link
          href="/account"
          aria-label="Tu cuenta"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink/70 hover:bg-bg hover:text-ink"
        >
          <UserRound size={17} />
        </Link>
        <LogoutButton compact />
      </div>
    </header>
  );
}
