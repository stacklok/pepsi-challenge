import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /about, /auth/login)
  const path = request.nextUrl.pathname;

  // Skip proxying for the error page
  if (path === '/error') {
    return NextResponse.next();
  }

  // Handle streaming endpoint separately
  if (path === '/api/generate-stream') {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    const url = new URL(path, backendUrl);

    // For streaming endpoints, we need to use a special approach
    // because Next.js rewrite() can buffer the response

    // Clone the request for forwarding
    const requestInit: RequestInit = {
      method: request.method,
      headers: new Headers(request.headers),
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.blob()
          : undefined,
      redirect: 'manual',
      duplex: 'half',
    };

    // Forward the request to the backend
    const response = await fetch(url.toString(), requestInit);

    // Return the response with proper SSE headers to prevent buffering
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
      },
    });
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
