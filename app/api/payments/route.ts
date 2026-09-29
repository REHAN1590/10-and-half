import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { OrderModel } from '@/models/Order';
import { getSession } from '@/lib/auth';
import { releaseExpiredReservations } from '@/lib/orders';

const Schema = z.object({ orderId: z.string().min(1) });

export async function POST(req: Request) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });

  await connectDB();
  await releaseExpiredReservations();
  const order = await OrderModel.findOne({ id: parsed.data.orderId, userId: session.id });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.paymentMethod === 'COD') return NextResponse.json({ error: 'COD orders do not need online payment.' }, { status: 400 });
  if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Order is already paid.' }, { status: 409 });
  if (order.status !== 'awaiting_payment' || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) {
    return NextResponse.json({ error: 'Payment window expired. Please create a new order.' }, { status: 409 });
  }

  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  if (!order.razorpayOrderId) {
    const rp = await razorpay.orders.create({ amount: order.amount * 100, currency: 'INR', receipt: order.id, notes: { storeOrderId: order.id } });
    order.razorpayOrderId = rp.id;
    await order.save();
  }

  return NextResponse.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId: order.razorpayOrderId,
    amount: order.amount * 100,
    currency: 'INR',
    storeOrderId: order.id,
  });
}
