import { createClient } from "@/lib/supabase/client";

export const ATTACHMENTS_BUCKET = "attachments";

/**
 * Uploads a file straight from the browser to Supabase Storage and returns
 * its public URL. Requires the "attachments" bucket to exist (public read)
 * with a storage policy allowing authenticated inserts — see README.
 */
export async function uploadAttachment(file: File, issueId: string) {
  const supabase = createClient();
  const path = `${issueId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  return { fileUrl: data.publicUrl, path };
}
