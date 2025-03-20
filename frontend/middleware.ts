import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /about, /auth/login)
  const path = request.nextUrl.pathname;

  // Skip proxying for the error page
  if (path === '/error') {
    return NextResponse.next();
  }

  // Proxy auth and api requests to backend
  const isInternalAPI =
    path.startsWith('/api/chat') || path.startsWith('/api/completion');

  if (path.startsWith('/auth') || path.startsWith('/api') || !isInternalAPI) {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

    // Create the URL for rewriting
    const url = new URL(path, backendUrl);

    // Preserve all query parameters from the original request
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/auth/:path*', '/api/:path*', '/error'],
};
