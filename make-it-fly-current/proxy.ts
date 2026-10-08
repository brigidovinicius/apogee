import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: só confere se existe cookie de sessão. A validação real
// acontece no servidor (lib/members/dal.ts) em cada página e action.
const PUBLIC_MEMBER_PATHS = new Set(["/membros/entrar", "/membros/cadastro"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_MEMBER_PATHS.has(pathname)) return NextResponse.next();

  if (!getSessionCookie(request)) {
    const login = new URL("/membros/entrar", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/membros", "/membros/:path*", "/admin", "/admin/:path*"],
};
