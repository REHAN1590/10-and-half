import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { OrderModel } from '@/models/Order';
import { getSession } from '@/lib/auth';

const Schema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

function validSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment payload.' }, { status: 400 });

  await connectDB();
  const order = await OrderModel.findOne({ id: parsed.data.orderId, userId: session.id });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.paymentStatus === 'paid') return NextResponse.json({ ok: true, status: 'paid', orderId: order.id });
  if (order.paymentStatus === 'refund_pending') {
    return NextResponse.json({ error: 'Payment was captured after the stock reservation expired. Refund review is required.' }, { status: 409 });
  }
  if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return NextResponse.json({ error: 'Payment/order mismatch.' }, { status: 400 });
  }

  if (!validSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature, process.env.RAZORPAY_KEY_SECRET)) {
    return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 });
  }

  // Never trust the browser's success callback alone. Confirm the payment with Razorpay.
  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  let payment: any;
  try {
    payment = await razorpay.payments.fetch(parsed.data.razorpayPaymentId);
  } catch {
    return NextResponse.json({ error: 'Could not verify payment with Razorpay.' }, { status: 502 });
  }

  if (payment.order_id !== parsed.data.razorpayOrderId || Number(payment.amount) !== Number(order.amount) * 100 || payment.currency !== 'INR') {
    return NextResponse.json({ error: 'Payment details do not match the order.' }, { status: 400 });
  }
  if (payment.status !== 'captured') {
    return NextResponse.json({ error: 'Payment has not been captured.' }, { status: 409 });
  }

  const now = new Date();
  const paid = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      reservationExpiresAt: { $gt: now },
      stockReleasedAt: { $exists: false },
    },
    {
      $set: { paymentStatus: 'paid', status: 'new', razorpayPaymentId: parsed.data.razorpayPaymentId },
      $unset: { reservationExpiresAt: 1 },
    },
    { new: true },
  );
  if (!paid) {
    const latest = await OrderModel.findById(order._id).lean();
    if (latest?.paymentStatus === 'paid') return NextResponse.json({ ok: true, status: 'paid', orderId: order.id });
    await OrderModel.updateOne(
      { _id: order._id, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'refund_pending', razorpayPaymentId: parsed.data.razorpayPaymentId } },
    );
    return NextResponse.json({ error: 'Payment was captured after the stock reservation expired or the order was no longer payable. Refund review is required.', status: 'refund_pending', orderId: order.id }, { status: 409 });
  }
  return NextResponse.json({ ok: true, status: 'paid', orderId: order.id });
}
