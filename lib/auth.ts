import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { connectDB } from '@/lib/db';
import { UserModel } from '@/models/User';

const COOKIE_NAME = 'tenhalf_session';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export type SessionUser = { id: string; email: string; name: string; role: 'customer' | 'admin' };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.id || !payload.email || !payload.role) return null;
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name || ''),
      role: payload.role === 'admin' ? 'admin' : 'customer',
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== 'admin') throw new Error('FORBIDDEN');
  return session;
}

export async function findUserByEmail(email: string) {
  await connectDB();
  return UserModel.findOne({ email: email.toLowerCase().trim() });
}
