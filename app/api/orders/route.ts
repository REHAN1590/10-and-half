import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import { OrderModel } from '@/models/Order';
import { requireUser } from '@/lib/auth';
import { releaseExpiredReservations, PAYMENT_RESERVATION_MINUTES } from '@/lib/orders';

const Schema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(8).max(20),
    email: z.string().email(),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(80),
    pin: z.string().regex(/^\d{6}$/),
  }),
  paymentMethod: z.enum(['UPI', 'CARD', 'COD']).default('UPI'),
  artwork: z.object({ url: z.string().url(), publicId: z.string().min(1), fileName: z.string().min(1).max(255) }).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().min(1),
    size: z.string().min(1),
    color: z.string().min(1),
    qty: z.number().int().positive().max(20),
  })).min(1).max(50),
});

const SHIPPING = 79;
const FREE_SHIPPING_THRESHOLD = 999;
const COD_FEE = 49;

function orderId() {
  return `TH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let session;
  try {
    session = await requireUser();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message === 'FORBIDDEN' ? 'Forbidden.' : 'Authentication required.' }, { status: e?.message === 'FORBIDDEN' ? 403 : 401 });
  }
  await connectDB();
  await releaseExpiredReservations();

  const dbSession = await mongoose.startSession();
  try {
    let created: any;
    await dbSession.withTransaction(async () => {
      const productIds = [...new Set(parsed.data.items.map(i => i.productId))];
      const products = await ProductModel.find({ _id: { $in: productIds }, active: true }).session(dbSession).lean();
      const byId = new Map(products.map(p => [String(p._id), p]));

      let subtotal = 0;
      const orderItems: any[] = [];

      for (const item of parsed.data.items) {
        const product = byId.get(item.productId);
        if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
        if (!product.colors.includes(item.color)) throw new Error(`INVALID_COLOR:${product.name}`);

        const sizeStock = Number((product.sizes as any)?.[item.size] ?? 0);
        if (sizeStock < item.qty) throw new Error(`INSUFFICIENT_STOCK:${product.name}:${item.size}`);

        const stockPath = `sizes.${item.size}`;
        const updated = await ProductModel.findOneAndUpdate(
          { _id: item.productId, active: true, [stockPath]: { $gte: item.qty } },
          { $inc: { [stockPath]: -item.qty } },
          { new: true, session: dbSession },
        );
        if (!updated) throw new Error(`INSUFFICIENT_STOCK:${product.name}:${item.size}`);

        const lineTotal = Number(product.price) * item.qty;
        subtotal += lineTotal;
        orderItems.push({ productId: item.productId, name: product.name, size: item.size, color: item.color, qty: item.qty, unitPrice: product.price, lineTotal });
      }

      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING;
      const codFee = parsed.data.paymentMethod === 'COD' ? COD_FEE : 0;
      const amount = subtotal + shipping + codFee;
      const isOnline = parsed.data.paymentMethod !== 'COD';
      const reservationExpiresAt = isOnline ? new Date(Date.now() + PAYMENT_RESERVATION_MINUTES * 60_000) : undefined;

      const docs = await OrderModel.create([{
        _id: new mongoose.Types.ObjectId(),
        userId: session?.id,
        id: orderId(),
        customer: parsed.data.customer,
        items: orderItems,
        subtotal,
        shipping,
        codFee,
        amount,
        paymentMethod: parsed.data.paymentMethod,
        paymentStatus: 'pending',
        status: isOnline ? 'awaiting_payment' : 'new',
        reservationExpiresAt,
        artwork: parsed.data.artwork ?? undefined,
        statusHistory: [{ status: isOnline ? 'awaiting_payment' : 'new', note: 'Order placed', at: new Date() }],
      }], { session: dbSession });
      created = docs[0].toObject();
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: created.id,
        subtotal: created.subtotal,
        shipping: created.shipping,
        codFee: created.codFee,
        amount: created.amount,
        paymentMethod: created.paymentMethod,
        paymentStatus: created.paymentStatus,
        status: created.status,
        reservationExpiresAt: created.reservationExpiresAt,
      },
    }, { status: 201 });
  } catch (e: any) {
    const message = String(e?.message || 'Order creation failed');
    if (message.startsWith('PRODUCT_NOT_FOUND:')) return NextResponse.json({ error: 'One of the products is no longer available.' }, { status: 409 });
    if (message.startsWith('INVALID_COLOR:')) return NextResponse.json({ error: 'One selected colour is no longer available.' }, { status: 409 });
    if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: 'One or more selected sizes do not have enough stock.' }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }
}

export async function GET() {
  let session;
  try {
    session = await requireUser();
  } catch (e: any) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    await connectDB();
    const orders = await OrderModel.find({ userId: session.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ orders });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not load orders.' }, { status: 500 });
  }
}
