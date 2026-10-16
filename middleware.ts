import { type NextRequest } from "next/server";
import { checkSession } from "@/lib/firebase/middleware";

export async function middleware(request: NextRequest) {
  return checkSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and image optimization,
     * so the session cookie stays fresh on every navigation and API call.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
