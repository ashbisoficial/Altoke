import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-2xl font-semibold">El enlace no es válido</h1>
      <p className="max-w-sm text-sm text-ink/70">
        El enlace de acceso expiró o ya fue usado. Solicita uno nuevo para continuar.
      </p>
      <Link href="/login" className="text-accent underline underline-offset-4">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
