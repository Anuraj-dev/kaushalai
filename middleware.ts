import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Stub auth guard for /admin and /api/matrices (R2-07, AUTH-001)
// Currently permissive for seeded demo; replace with real session check before prod.
// TODO(C-AUTH): enforce session.user.role === "admin" and derive created_by from session
// instead of hard-coded 'admin-001' in src/data/admin-repository.ts:55 and route handlers.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") || path.startsWith("/api/matrices");
  if (!isAdminRoute) return NextResponse.next();

  // Demo mode: allow all, but log and expose header for future enforcement
  const adminToken = request.headers.get("x-admin-token") ?? request.cookies.get("admin_token")?.value;
  // In prod, require adminToken or session; for now, continue
  if (!adminToken) {
    // Intentionally permissive — add enforcement: return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })
    // console.warn(`[auth] missing admin token for ${path} — allowed in demo`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/matrices", "/api/matrices/:path*"],
};
