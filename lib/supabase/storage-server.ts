import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Almacenamiento de archivos (Supabase Storage). Se usa solo desde el servidor,
 * con la clave de servicio: el navegador nunca sube directamente, así que el
 * permiso lo comprueba Altoke con la sesión de Firebase y no el de Supabase.
 */
export const ATTACHMENTS_BUCKET = "attachments";
export const MURAL_BUCKET = "mural";

function storageClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function uploadToBucket(bucket: string, folder: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 150) || "archivo";
  const path = `${folder}/${Date.now()}-${safeName}`;
  const supabase = storageClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { fileUrl: data.publicUrl, path };
}
