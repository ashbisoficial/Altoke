import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { CustomFieldsManager, type FieldRow } from "@/components/fields/CustomFieldsManager";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function ProjectFieldsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!(await isProjectMember(user.id, id))) notFound();

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!project) notFound();
  const canManage = await hasProjectPermission(user.id, id, "project.manage");

  const fields = await prisma.customField.findMany({ where: { projectId: id }, orderBy: { position: "asc" } });
  const rows: FieldRow[] = fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    options: (f.options as string[] | null) ?? null,
    required: f.required,
    position: f.position,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Campos — {project.name}</h1>
        <ProjectNav projectId={project.id} active="fields" />
      </header>
      {canManage ? (
        <CustomFieldsManager projectId={id} initialFields={rows} />
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.map((f) => (
            <li key={f.id} className="rounded-lg border border-border bg-surface px-3 py-2">
              {f.name} <span className="text-xs text-ink/50">({f.type})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
