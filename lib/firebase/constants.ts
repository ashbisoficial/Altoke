// Split out from lib/firebase/session.ts so middleware.ts (Edge runtime) can
// import the cookie name without pulling in firebase-admin, which needs
// Node.js APIs the Edge runtime doesn't have.
export const SESSION_COOKIE_NAME = "__session";
