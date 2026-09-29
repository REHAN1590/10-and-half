import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ ok: true, service: '10-and-half', database: 'ok' });
  } catch {
    return NextResponse.json({ ok: false, service: '10-and-half', database: 'unavailable' }, { status: 503 });
  }
}
