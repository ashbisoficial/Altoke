import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos",
  "auth/invalid-email": "El correo no es válido",
  "auth/user-not-found": "Correo o contraseña incorrectos",
  "auth/wrong-password": "Correo o contraseña incorrectos",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo",
  "auth/weak-password": "La contraseña debe tener al menos 8 caracteres",
  "auth/too-many-requests": "Demasiados intentos — espera un momento e intenta de nuevo",
  "auth/requires-recent-login":
    "Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña",
  "auth/network-request-failed": "Error de conexión — intenta de nuevo",
};

export function firebaseErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return MESSAGES[err.code] ?? "Ocurrió un error, intenta de nuevo";
  }
  return "Ocurrió un error, intenta de nuevo";
}
