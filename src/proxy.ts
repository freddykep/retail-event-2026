import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "admin_session";
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

/**
 * Grobe Vorpruefung: verhindert, dass unauthentifizierte Anfragen ueberhaupt an
 * geschuetzte Seiten/Routen ausgeliefert werden. Der Proxy kann Firebase-Session-
 * Cookies (erfordern Node/Admin-SDK) nicht kryptografisch verifizieren, daher pruefen
 * alle Server Components/Route Handler unter /admin ZUSAETZLICH `getAdminSession()`
 * (siehe lib/auth/admin-session.ts) - dieser Proxy ist nur Convenience, keine
 * alleinige Sicherheitsgrenze.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname.startsWith("/admin");
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  if (isAdminArea && !isPublicAdminPath) {
    const hasCookie = request.cookies.has(ADMIN_COOKIE_NAME);
    if (!hasCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
