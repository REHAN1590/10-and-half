import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sign(params: Record<string, string>, secret: string) {
  const canonical = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHash('sha1').update(canonical + secret).digest('hex');
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Artwork uploads are not configured yet.' }, { status: 503 });
    }

    const form = await req.formData();
    const value = form.get('file');
    if (!(value instanceof File)) return NextResponse.json({ error: 'No artwork file was provided.' }, { status: 400 });
    if (!ALLOWED.has(value.type)) return NextResponse.json({ error: 'Use JPG, PNG, or WebP artwork.' }, { status: 400 });
    if (value.size > MAX_BYTES) return NextResponse.json({ error: 'Artwork must be 8 MB or smaller.' }, { status: 400 });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `custom-${crypto.randomUUID()}`;
    const folder = 'ten-half/custom-artwork';
    const signature = sign({ folder, public_id: publicId, timestamp }, apiSecret);

    const upload = new FormData();
    upload.append('file', new Blob([await value.arrayBuffer()], { type: value.type }), value.name);
    upload.append('api_key', apiKey);
    upload.append('timestamp', timestamp);
    upload.append('folder', folder);
    upload.append('public_id', publicId);
    upload.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: upload });
    const data = await response.json();
    if (!response.ok || !data.secure_url) {
      console.error('Cloudinary upload failed', data);
      return NextResponse.json({ error: 'Could not upload artwork.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: data.secure_url, publicId: data.public_id, fileName: value.name });
  } catch (e: any) {
    const status = e?.message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : 'Could not upload artwork.' }, { status });
  }
}
