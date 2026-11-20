"use client";

/** Lleva el ID token de Firebase al servidor para crear la cookie de sesión. */
export async function establishSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "No se pudo iniciar sesión");
  }
}

export async function endSession() {
  await fetch("/api/auth/session", { method: "DELETE" });
}

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "El correo no es válido",
  "auth/missing-password": "Escribe tu contraseña",
  "auth/invalid-credential": "Correo o contraseña incorrectos",
  "auth/wrong-password": "Correo o contraseña incorrectos",
  "auth/user-not-found": "Correo o contraseña incorrectos",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo",
  "auth/network-request-failed": "No hay conexión con el servidor de autenticación",
  "auth/requires-recent-login": "Vuelve a iniciar sesión para cambiar la contraseña",
  "auth/invalid-action-code": "El enlace ya se usó o no es válido",
  "auth/expired-action-code": "El enlace caducó. Pide uno nuevo",
};

/** Mensaje en español para un error de Firebase Auth (o de nuestra propia API). */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (error instanceof Error && error.message) return error.message;
  return "Algo salió mal. Inténtalo de nuevo";
}
