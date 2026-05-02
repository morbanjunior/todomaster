import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
const ALLOWED = ['auth', 'users', 'tasks'];

export async function GET(_request: NextRequest, props: { params: Promise<{ service: string }> }) {
    const { service } = await props.params;

    if (!ALLOWED.includes(service)) {
        return NextResponse.json({ detail: 'Unknown service' }, { status: 404 });
    }

    try {
        const res = await fetch(`${BACKEND_URL}/health/${service}`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ status: 'down', service }, { status: 503 });
    }
}
