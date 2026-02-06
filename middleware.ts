import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitHeaders, getClientIp } from './lib/rate-limit';

// Allowed origins for CSRF protection
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://specvault.app',
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.PRODUCTION_URL,
].filter(Boolean) as string[];

// API routes that require rate limiting
const RATE_LIMITED_ROUTES = [
  '/api/chat',
  '/api/documents/upload',
  '/api/documents/upload-url',
  '/api/documents/process',
  '/api/leads',
];

// API routes that require CSRF protection (POST/PUT/DELETE)
const CSRF_PROTECTED_ROUTES = [
  '/api/chat',
  '/api/documents/upload',
  '/api/documents/upload-url',
  '/api/documents/process',
  '/api/leads',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const clientIp = getClientIp(request);

  // CSRF Protection for state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // Check origin header
    if (origin) {
      const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => {
        if (!allowed) return false;
        return origin === allowed || origin.startsWith(allowed);
      });

      if (!isAllowedOrigin) {
        console.warn(`[Middleware] CSRF blocked - Origin: ${origin}, IP: ${clientIp}, Path: ${pathname}`);
        return new NextResponse(
          JSON.stringify({ error: 'Forbidden - Invalid origin' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // If no origin, check referer (some browsers don't send origin)
    if (!origin && referer) {
      const refererUrl = new URL(referer);
      const isAllowedReferer = ALLOWED_ORIGINS.some(allowed => {
        if (!allowed) return false;
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });

      if (!isAllowedReferer) {
        console.warn(`[Middleware] CSRF blocked - Referer: ${referer}, IP: ${clientIp}, Path: ${pathname}`);
        return new NextResponse(
          JSON.stringify({ error: 'Forbidden - Invalid referer' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  }

  // Rate limiting for API routes
  const shouldRateLimit = RATE_LIMITED_ROUTES.some(route => pathname.startsWith(route));

  if (shouldRateLimit) {
    const rateLimitResult = await checkRateLimit(clientIp, pathname);

    if (!rateLimitResult.success) {
      console.warn(`[Middleware] Rate limited - IP: ${clientIp}, Path: ${pathname}`);
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    // Add rate limit headers to successful requests
    const response = NextResponse.next();
    const headers = getRateLimitHeaders(rateLimitResult);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    // Log request for monitoring
    const duration = Date.now() - startTime;
    console.log(`[Middleware] ${method} ${pathname} - IP: ${clientIp}, Duration: ${duration}ms, Remaining: ${rateLimitResult.remaining}`);

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
