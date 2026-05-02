import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    try {
        const res = await fetch(`${BACKEND_URL}/users/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ detail: 'User service unavailable.' }, { status: 503 });
    }
}
