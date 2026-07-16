import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getDashboardPathByRole, normalizeAppRole } from './lib/auth/redirectByRole';

const protectedPrefixes = ['/customer', '/supplier', '/admin'];

const copyCookies = (source: NextResponse, target: NextResponse) => {
  source.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie as any;
    target.cookies.set(name, value, options);
  });
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  let role = normalizeAppRole(user.user_metadata?.role as string | undefined);

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!error) {
      role = normalizeAppRole(profile?.role) ?? role;
    }
  } catch {
    // Ignore lookup errors and fall back to auth metadata.
  }

  if (!role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'missing-role');
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  const allowedRole =
    (pathname.startsWith('/customer') && role === 'customer') ||
    (pathname.startsWith('/supplier') && role === 'supplier') ||
    (pathname.startsWith('/admin') && role === 'admin') ||
    (pathname.startsWith('/admin/supplier-inbox') && role === 'support');

  if (allowedRole) {
    return response;
  }

  const redirectUrl = new URL(getDashboardPathByRole(role), request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl);
  copyCookies(response, redirectResponse);
  return redirectResponse;
}

export const config = {
  matcher: ['/customer/:path*', '/supplier/:path*', '/admin/:path*'],
};


