import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

/**
 * Cliente de Firebase para el navegador (solo Auth; la base va en el servidor).
 * La configuración pública viene de variables NEXT_PUBLIC_*. Si
 * NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL está definida, se usa el emulador local.
 */

let cached: { app: FirebaseApp; auth: Auth } | null = null;

export function firebaseAuth(): Auth {
  if (cached) return cached.auth;

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  const auth = getAuth(app);

  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });

  cached = { app, auth };
  return auth;
}
