import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ApiKeysManager } from "@/components/account/ApiKeysManager";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/projects", desc: "Lista tus proyectos." },
  { method: "GET", path: "/api/v1/projects/:id/issues", desc: "Lista las incidencias de un proyecto." },
  { method: "POST", path: "/api/v1/projects/:id/issues", desc: "Crea una incidencia." },
  { method: "GET", path: "/api/v1/issues/:id", desc: "Trae una incidencia." },
  { method: "PATCH", path: "/api/v1/issues/:id", desc: "Actualiza una incidencia." },
];

export default async function ApiKeysPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <Link
          href="/account"
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Tu cuenta
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Llaves de API</h1>
      </header>

      <ApiKeysManager
        initialKeys={apiKeys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />

      <section className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-semibold">Cómo usarla</h2>
        <p className="mt-1 text-sm text-ink/60">
          Mandá la llave en el header <code className="text-xs">Authorization</code> de cada pedido:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 text-xs text-white">
          {`curl https://altoke-one.vercel.app/api/v1/projects \\
  -H "Authorization: Bearer altk_tu_llave_aca"`}
        </pre>
        <table className="mt-4 w-full text-left text-xs">
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.method + e.path} className="border-t border-border">
                <td className="py-1.5 pr-2 font-mono font-medium text-accent">{e.method}</td>
                <td className="py-1.5 pr-2 font-mono">{e.path}</td>
                <td className="py-1.5 text-ink/60">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
