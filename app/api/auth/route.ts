import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { clearSession, createSession, findUserByEmail, getSession } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { UserModel } from '@/models/User';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(7).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(128),
});

function publicUser(user: { _id: unknown; name: string; email: string; role: string; phone?: string }) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, phone: user.phone || '' };
}

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ authenticated: Boolean(session), user: session });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'register') {
      const input = registerSchema.parse(body);
      await connectDB();
      const email = input.email.toLowerCase().trim();
      if (await UserModel.exists({ email })) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await UserModel.create({ name: input.name, email, passwordHash, phone: input.phone || undefined, role: 'customer' });
      const session = { id: String(user._id), name: user.name, email: user.email, role: 'customer' as const };
      await createSession(session);
      return NextResponse.json({ user: publicUser(user) }, { status: 201 });
    }

    if (action === 'login') {
      const input = loginSchema.parse(body);
      const user = await findUserByEmail(input.email);
      if (!user || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }
      const role = user.role === 'admin' ? 'admin' as const : 'customer' as const;
      await createSession({ id: String(user._id), name: user.name, email: user.email, role });
      return NextResponse.json({ user: publicUser(user) });
    }

    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown auth action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'Authentication service error.' }, { status: 500 });
  }
}
