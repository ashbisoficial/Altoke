import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Cookies de la petición actual, simuladas (en Next las da next/headers).
const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
  }),
}));

import { POST as createSession, DELETE as endSessionRoute } from "@/app/api/auth/session/route";
import { getSessionUid, getSessionUser, verifySessionValue } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Autenticación con el emulador de Firebase Auth: se crea un usuario, se pide
 * la sesión por la API y se verifica la cookie. Requiere
 * `npm run test:emulators` (levanta el emulador) y DATABASE_URL.
 */
const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const enabled = !!emulatorHost && !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;
const email = `auth-${suffix}@test.local`;
const password = "contraseña-de-prueba-1";

async function emulatorSignUp(): Promise<{ idToken: string; localId: string }> {
  const res = await fetch(`http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = (await res.json()) as { idToken: string; localId: string };
  return { idToken: data.idToken, localId: data.localId };
}

describe.runIf(enabled)("sesión de Firebase", () => {
  let uid: string;
  let idToken: string;

  beforeAll(async () => {
    const created = await emulatorSignUp();
    uid = created.localId;
    idToken = created.idToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: uid } });
    await prisma.$disconnect();
  });

  it("sin cookie no hay sesión", async () => {
    jar.values.clear();
    expect(await getSessionUid()).toBeNull();
    expect(await getSessionUser()).toBeNull();
  });

  it("un ID token válido crea la cookie de sesión y deja al usuario en la base", async () => {
    const res = await createSession(
      new NextRequest("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value.length).toBeGreaterThan(20);
    expect(cookie?.httpOnly).toBe(true);

    jar.values.set(SESSION_COOKIE, cookie!.value);
    expect(await getSessionUid()).toBe(uid);
    const user = await getSessionUser();
    expect(user).toMatchObject({ id: uid, email });
  });

  it("una cookie falsa o alterada no sirve", async () => {
    expect(await verifySessionValue("no-es-una-cookie-valida")).toBeNull();
    jar.values.set(SESSION_COOKIE, "x".repeat(40));
    expect(await getSessionUser()).toBeNull();
  });

  it("un ID token inventado se rechaza sin crear cookie", async () => {
    const res = await createSession(
      new NextRequest("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: "token-inventado-que-no-es-un-jwt-valido" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("cerrar sesión borra la cookie", async () => {
    const res = await endSessionRoute();
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.maxAge).toBe(0);
  });
});
