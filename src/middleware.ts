/**
 * Admin middleware: verifies session token on /admin/* and /api/admin/* routes.
 * Also gates the whole app behind /setup until Settings.isConfigured is true.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/session-edge";
import { getSettings } from "@/lib/settings";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isStaticAsset = pathname.startsWith("/_next/") || pathname.startsWith("/static/") || pathname.endsWith(".ico") || pathname.endsWith(".svg") || pathname.endsWith(".png") || pathname.endsWith(".jpg") || pathname.endsWith(".jpeg") || pathname.endsWith(".woff2");

  // Setup wizard is always public; static assets are never gated
  if (pathname.startsWith("/setup") || isStaticAsset) {
    return NextResponse.next();
  }

  // If the app is not configured yet, every other route redirects to /setup
  // except the setup API itself.
  if (!isApi || pathname !== "/api/setup") {
    const settings = await getSettings();
    if (!settings.isConfigured) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  }

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Login routes are public
  if (pathname === "/admin" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const session = await verifySessionTokenEdge(token);
  if (!session) {
    const response = NextResponse.redirect(new URL("/admin", request.url));
    response.cookies.delete("admin_session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
