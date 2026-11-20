import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin para el servidor. Credenciales, en orden de preferencia:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON: JSON completo de la cuenta de servicio.
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 *   3. Emulador: si FIREBASE_AUTH_EMULATOR_HOST está definido, no hacen falta credenciales.
 * La cuenta de servicio es un secreto: solo va en variables del servidor.
 */

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const account = JSON.parse(json) as Parameters<typeof cert>[0];
    return initializeApp({ credential: cert(account), projectId: projectId ?? (account as { project_id?: string }).project_id });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: projectId ?? "altoke-local" });
  }

  throw new Error(
    "Falta la configuración de Firebase Admin: define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY (ver docs/firebase.md).",
  );
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
