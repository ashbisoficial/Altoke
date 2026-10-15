import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { CreateMuralForm } from "@/components/mural/CreateMuralForm";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function ProjectMuralsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const muralsSnap = await adminDb
    .collection("boards")
    .where("projectId", "==", projectId)
    .where("type", "==", "MURAL")
    .get();

  const murals = await Promise.all(
    muralsSnap.docs.map(async (d) => {
      const count = await adminDb.collection("muralElements").where("boardId", "==", d.id).count().get();
      const data = d.data();
      return { id: d.id, name: data.name as string, createdAt: data.createdAt, elementCount: count.data().count };
    }),
  );
  murals.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold">Murales — {project.name}</h1>
          <CreateMuralForm projectId={projectId} />
        </div>
        <ProjectNav projectId={projectId} active="murals" />
      </header>

      {murals.length === 0 ? (
        <p className="text-sm text-ink/60">Todavía no hay murales. Crea el primero para empezar.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {murals.map((mural) => (
            <li key={mural.id}>
              <Link
                href={`/mural/${mural.id}`}
                className="shadow-soft-hover block rounded-xl border border-border bg-surface p-4 hover:border-accent"
              >
                <p className="font-heading text-base font-medium">{mural.name}</p>
                <p className="mt-1 text-xs text-ink/50">{mural.elementCount} elementos</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
