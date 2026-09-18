import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Qué rutas de /panel puede pisar cada rol. superadmin siempre puede todo.
const PANEL_ACCESS: Record<string, string[]> = {
  vendedor: ['/panel/ventas', '/panel/envios'],
  administrador: ['/panel/ventas', '/panel/envios', '/panel/productos', '/panel/whatsapp'],
  supervisor: ['/panel/dashboard', '/panel/ventas', '/panel/envios', '/panel/productos', '/panel/tecnicos'],
  administrador_tecnico: ['/panel/tecnicos'],
  tecnico: ['/panel/tecnicos'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/panel')) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('login', '1');
    return NextResponse.redirect(loginUrl);
  }

  const role = (token as { role?: string }).role || '';

  if (role === 'superadmin') return NextResponse.next();

  const allowed = PANEL_ACCESS[role] || [];
  const canAccess = allowed.some((prefix) => pathname.startsWith(prefix));

  if (!canAccess) {
    return NextResponse.redirect(new URL('/panel/no-autorizado', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*'],
};
