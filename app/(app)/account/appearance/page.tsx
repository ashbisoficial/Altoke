import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemePicker } from "@/components/theme/ThemePicker";

export default function AppearancePage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <Link
          href="/account"
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Tu cuenta
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Apariencia</h1>
        <p className="mt-1 text-sm text-ink/60">
          Elegí cómo se ve Altoke en este dispositivo. El tema se guarda solo acá, en tu navegador.
        </p>
      </header>

      <ThemePicker />
    </main>
  );
}
