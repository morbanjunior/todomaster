import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

async function getToken() {
    const cookieStore = await cookies();
    return cookieStore.get('auth_token')?.value;
}

export async function GET() {
    const token = await getToken();
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    try {
        const res = await fetch(`${BACKEND_URL}/tasks/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ detail: 'Task service unavailable.' }, { status: 503 });
    }
}

export async function POST(request: NextRequest) {
    const token = await getToken();
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    try {
        const res = await fetch(`${BACKEND_URL}/tasks/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ detail: 'Task service unavailable.' }, { status: 503 });
    }
}
