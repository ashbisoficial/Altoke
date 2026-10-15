import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";

/**
 * Uploads a file straight from the browser to Firebase Storage and returns
 * its public download URL. Requires Storage Security Rules that allow
 * authenticated writes and public reads under attachments/** and mural/**
 * (see README).
 */
export async function uploadAttachment(file: File, issueId: string) {
  const storage = getFirebaseStorage();
  const path = `attachments/${issueId}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  return { fileUrl, path };
}

/** Same idea as uploadAttachment, but for images dropped onto a mural board. */
export async function uploadMuralImage(file: File, boardId: string) {
  const storage = getFirebaseStorage();
  const path = `mural/${boardId}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  return { fileUrl, path };
}
