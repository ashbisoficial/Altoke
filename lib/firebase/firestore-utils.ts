import type { Timestamp } from "firebase-admin/firestore";

/** Firestore Timestamp -> ISO string, matching how Prisma's DateTime used to serialize in JSON responses. */
export function tsToISO(value: Timestamp | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate().toISOString();
  return null;
}
