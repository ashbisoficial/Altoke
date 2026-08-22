import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AccountSettings } from "@/components/account/AccountSettings";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Panel
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Tu cuenta</h1>
      </header>

      <AccountSettings initialName={user.name} email={user.email} />
    </main>
  );
}
