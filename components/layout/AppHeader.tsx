import Link from "next/link";
import { ListTodo, UserRound } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { LogoMark } from "@/components/layout/Logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <LogoMark size="sm" />
        <span className="hidden font-heading text-lg font-semibold sm:inline">Altoke</span>
      </Link>
      <Link
        href="/my-tasks"
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink/70 hover:bg-bg hover:text-ink"
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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 hover:bg-bg hover:text-ink"
        >
          <UserRound size={17} />
        </Link>
        <LogoutButton compact />
      </div>
    </header>
  );
}
