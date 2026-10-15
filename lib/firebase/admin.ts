import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Admin SDK — server-only, full-privilege access (bypasses Firestore/Storage
 * Security Rules). Never import this from a Client Component. Route handlers
 * and server components use it as the single write path to Firestore,
 * mirroring how lib/prisma.ts used to be the only thing touching Postgres.
 */
// Lazily initialized: building without real service-account credentials
// (e.g. CI, or before the Firebase project is fully set up) must not crash
// just because this module got imported — only an actual Firestore/Auth/
// Storage call should fail at that point, not every route that imports
// getSessionUser().
let app: App | undefined;

function getAdminApp(): App {
  if (!app) {
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
  }
  return app;
}

// Binds methods to the real instance — a plain Reflect.get would hand back
// an unbound method whose `this` becomes this Proxy at the call site
// (`adminDb.collection(...)`), breaking any internal state the SDK classes
// keep on `this`.
function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = resolve();
      const value = Reflect.get(real as object, prop);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

export const adminAuth = lazyProxy(() => getAuth(getAdminApp()));
export const adminDb = lazyProxy(() => getFirestore(getAdminApp()));
export const adminStorage = lazyProxy(() => getStorage(getAdminApp()));
