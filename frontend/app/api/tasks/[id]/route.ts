import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

async function getToken() {
    const cookieStore = await cookies();
    return cookieStore.get('auth_token')?.value;
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const token = await getToken();
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await props.params;
    const body = await request.json();
    try {
        const res = await fetch(`${BACKEND_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ detail: 'Task service unavailable.' }, { status: 503 });
    }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const token = await getToken();
    if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await props.params;
    try {
        const res = await fetch(`${BACKEND_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 204) return new NextResponse(null, { status: 204 });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ detail: 'Task service unavailable.' }, { status: 503 });
    }
}
