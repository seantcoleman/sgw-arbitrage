import { type NextRequest } from "next/server";
import { attachAcquisition } from "@/lib/capture-acquisition";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return attachAcquisition(request, response);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, Next internals, and /backend
     * (rewritten to FastAPI — must not be intercepted by auth redirects).
     */
    "/((?!_next/static|_next/image|backend/|favicon.ico|icon.svg|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
