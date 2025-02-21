import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /about, /auth/login)
  const path = request.nextUrl.pathname

  // Skip proxying for the error page
  if (path === '/error') {
    return NextResponse.next()
  }

  // Proxy auth and api requests to backend
  if (path.startsWith('/auth') || path.startsWith('/api')) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    return NextResponse.rewrite(new URL(path, backendUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/auth/:path*',
    '/api/:path*',
    '/error',
  ],
} 