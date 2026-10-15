import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { IssueDetail, type IssueDetailData, type IssueDetailProject } from "@/components/issue/IssueDetail";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const issueRef = adminDb.doc(`issues/${id}`);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) notFound();
  const issueData = issueSnap.data()!;
  if (!(await isProjectMember(user.id, issueData.projectId))) notFound();

  const [
    commentsSnap,
    attachmentsSnap,
    childrenSnap,
    parentSnap,
    linksFromSnap,
    linksToSnap,
    activitySnap,
    projectSnap,
    issueTypesSnap,
    sprintsSnap,
    membersSnap,
    labelsSnap,
    otherIssuesSnap,
  ] = await Promise.all([
    adminDb.collection("comments").where("issueId", "==", id).orderBy("createdAt", "asc").get(),
    adminDb.collection("attachments").where("issueId", "==", id).orderBy("createdAt", "desc").get(),
    adminDb.collection("issues").where("parentId", "==", id).orderBy("number", "asc").get(),
    issueData.parentId ? adminDb.doc(`issues/${issueData.parentId}`).get() : Promise.resolve(null),
    adminDb.collection("issueLinks").where("sourceId", "==", id).orderBy("createdAt", "asc").get(),
    adminDb.collection("issueLinks").where("targetId", "==", id).orderBy("createdAt", "asc").get(),
    issueRef.collection("activity").orderBy("createdAt", "desc").limit(30).get(),
    adminDb.doc(`projects/${issueData.projectId}`).get(),
    adminDb.collection(`projects/${issueData.projectId}/issueTypes`).get(),
    adminDb.collection(`projects/${issueData.projectId}/sprints`).orderBy("createdAt", "desc").get(),
    adminDb.collection(`projects/${issueData.projectId}/members`).get(),
    adminDb.collection("labels").where("projectId", "==", issueData.projectId).get(),
    adminDb.collection("issues").where("projectId", "==", issueData.projectId).orderBy("number", "asc").get(),
  ]);

  const memberUserIds = membersSnap.docs.map((d) => d.id);
  const memberUserSnaps = memberUserIds.length
    ? await adminDb.getAll(...memberUserIds.map((uid) => adminDb.doc(`users/${uid}`)))
    : [];
  const userById = new Map(memberUserSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const dueDateIso = tsToISO(issueData.dueDate);

  const issue = {
    id,
    ...issueData,
    dueDate: dueDateIso ? new Date(dueDateIso) : null,
    comments: commentsSnap.docs.map((d) => {
      const createdAtIso = tsToISO(d.data().createdAt);
      return { id: d.id, ...d.data(), createdAt: createdAtIso ? new Date(createdAtIso) : new Date() };
    }),
    attachments: attachmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    children: childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    parent: parentSnap?.exists ? { id: parentSnap.id, key: parentSnap.data()!.key, title: parentSnap.data()!.title } : null,
    linksFrom: linksFromSnap.docs.map((d) => ({ id: d.id, type: d.data().type, target: d.data().target })),
    linksTo: linksToSnap.docs.map((d) => ({ id: d.id, type: d.data().type, source: d.data().source })),
    activity: activitySnap.docs.map((d) => {
      const createdAtIso = tsToISO(d.data().createdAt);
      return { id: d.id, ...d.data(), createdAt: createdAtIso ? new Date(createdAtIso) : new Date() };
    }),
  };

  const workflow = projectSnap.data()?.workflow ?? { statuses: [], transitions: [] };

  const project = {
    id: issueData.projectId,
    key: projectSnap.data()?.key,
    name: projectSnap.data()?.name,
    issueTypes: issueTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    sprints: sprintsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    members: membersSnap.docs.map((d) => {
      const u = userById.get(d.id);
      return { user: { id: d.id, name: u?.name ?? null, email: u?.email ?? "", avatarUrl: u?.avatarUrl ?? null } };
    }),
    workflow: {
      statuses: [...(workflow.statuses ?? [])].sort((a: { order: number }, b: { order: number }) => a.order - b.order),
      transitions: workflow.transitions ?? [],
    },
    labels: labelsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };

  const otherIssues = otherIssuesSnap.docs
    .filter((d) => d.id !== id)
    .map((d) => ({ id: d.id, key: d.data().key, title: d.data().title }));

  return (
    <IssueDetail
      issue={issue as unknown as IssueDetailData}
      project={project as unknown as IssueDetailProject}
      currentUserId={user.id}
      otherIssues={otherIssues}
    />
  );
}
