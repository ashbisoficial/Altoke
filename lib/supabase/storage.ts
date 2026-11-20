"use client";

/**
 * Subidas de archivos desde el navegador. El archivo viaja al servidor de
 * Altoke (POST /api/uploads), que comprueba el permiso y lo guarda.
 */
export async function uploadFile(file: File, scope: "issue" | "mural", id: string): Promise<{ fileUrl: string; path: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("scope", scope);
  form.append("id", id);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo subir el archivo");
  return data;
}

export const uploadAttachment = (file: File, issueId: string) => uploadFile(file, "issue", issueId);
export const uploadMuralImage = (file: File, boardId: string) => uploadFile(file, "mural", boardId);
