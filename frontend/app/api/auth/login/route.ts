import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

export async function POST(request: NextRequest) {
    const body = await request.json();
    try {
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        const response = NextResponse.json({ user_id: data.user_id });

        // JWT stored in HttpOnly cookie — never exposed to browser JS
        response.cookies.set('auth_token', data.access_token, {
            httpOnly: true,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60, // 1 hour
        });
        // user_id in a readable cookie for server components
        response.cookies.set('user_id', String(data.user_id), {
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60,
        });

        return response;
    } catch {
        return NextResponse.json({ detail: 'Auth service unavailable.' }, { status: 503 });
    }
}
