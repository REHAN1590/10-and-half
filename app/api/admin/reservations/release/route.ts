import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { releaseExpiredReservations } from '@/lib/orders';

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  await connectDB();
  const released = await releaseExpiredReservations();
  return NextResponse.json({ ok: true, released });
}
