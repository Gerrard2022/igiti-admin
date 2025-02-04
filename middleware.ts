import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default authMiddleware({
  publicRoutes: ["/api/:path*"],
});

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
  response.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
