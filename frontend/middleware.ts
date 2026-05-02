import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('auth_token');
    const { pathname } = request.nextUrl;

    // Protected: redirect to login if no session
    if (pathname.startsWith('/dashboard') && !token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Already logged in: skip login page
    if (pathname === '/' && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*'],
};
