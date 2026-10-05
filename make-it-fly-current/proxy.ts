import { NextResponse, type NextRequest } from "next/server";
import { getHexclaveServerApp } from "@/lib/hexclave/server";

// Proxy reduz navegações desnecessárias; a autorização também é revalidada no
// servidor (lib/members/dal.ts) antes de qualquer leitura ou escrita do fórum.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const member = await getHexclaveServerApp().getUser({ tokenStore: request });
  if (!member) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/membros", "/membros/:path*"],
};
