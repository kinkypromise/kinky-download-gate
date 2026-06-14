/**
 * Admin middleware: verifies session token on /admin/* and /api/admin/* routes.
 * Also gates the whole app behind /setup until Settings.isConfigured is true.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/session-edge";
import { getSettings } from "@/lib/settings";

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js|json)$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and the setup API are never gated by configuration status.
  if (isStaticAsset(pathname) || pathname === "/api/setup") {
    return NextResponse.next();
  }

  const settings = await getSettings();

  // Setup wizard is public only until the app is configured.
  if (pathname.startsWith("/setup")) {
    if (settings.isConfigured) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Until configured, every other route redirects to the setup wizard.
  if (!settings.isConfigured) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // From here on the app is configured: enforce admin session on admin routes.
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
