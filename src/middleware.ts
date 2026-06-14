/**
 * Admin middleware: verifies session token on /admin/* and /api/admin/* routes.
 * Runs in the Edge runtime — MUST NOT import Node.js modules (Prisma, fs, etc.).
 * Configuration gating is handled by the Node runtime Server Component layout.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/session-edge";

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js|json)$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets are never gated.
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Pass the path to Server Components so they can run Node-side config gating
  // without re-parsing the URL.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Admin/session checks only run on configured routes; the Server Component
  // layout will redirect unconfigured traffic to /setup before these are reached.
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return response;
  }

  // Login routes are public.
  if (pathname === "/admin" || pathname === "/api/admin/login") {
    return response;
  }

  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const session = await verifySessionTokenEdge(token);
  if (!session) {
    const r = NextResponse.redirect(new URL("/admin", request.url));
    r.cookies.delete("admin_session");
    return r;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
