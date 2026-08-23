import Link from "next/link";
import { ListTodo, UserRound } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
      <Link href="/dashboard" className="shrink-0 font-heading text-lg font-semibold">
        Altoke
      </Link>
      <Link
        href="/my-tasks"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-ink/70 hover:bg-bg hover:text-ink"
      >
        <ListTodo size={16} />
        <span className="hidden sm:inline">Mis tareas</span>
      </Link>
      <GlobalSearch />
      <div className="ml-auto flex shrink-0 items-center gap-1">
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
