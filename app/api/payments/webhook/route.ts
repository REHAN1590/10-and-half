import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import { OrderModel } from '@/models/Order';
import { releaseExpiredReservations, cancelAndReleaseOrderStock } from '@/lib/orders';

function validSignature(body: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 });
  const signature = req.headers.get('x-razorpay-signature');
  const body = await req.text();
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  if (!validSignature(body, signature, secret)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });

  let event: any;
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  await connectDB();
  await releaseExpiredReservations();

  const paymentEntity = event?.payload?.payment?.entity;
  const orderEntity = event?.payload?.order?.entity;
  const rpOrderId = paymentEntity?.order_id || orderEntity?.id;
  const paymentId = paymentEntity?.id;
  if (!rpOrderId) return NextResponse.json({ ok: true });

  const order = await OrderModel.findOne({ razorpayOrderId: rpOrderId });
  if (!order) return NextResponse.json({ ok: true });

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return NextResponse.json({ ok: true });

    const amount = Number(paymentEntity?.amount ?? orderEntity?.amount_paid ?? 0);
    const currency = paymentEntity?.currency || orderEntity?.currency;
    if (amount !== Number(order.amount) * 100 || currency !== 'INR') {
      return NextResponse.json({ error: 'Payment amount/currency mismatch.' }, { status: 400 });
    }

    const paid = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: 'awaiting_payment',
        paymentStatus: 'pending',
        reservationExpiresAt: { $gt: new Date() },
        stockReleasedAt: { $exists: false },
      },
      {
        $set: { paymentStatus: 'paid', status: 'new', ...(paymentId ? { razorpayPaymentId: paymentId } : {}) },
        $unset: { reservationExpiresAt: 1 },
      },
      { new: true },
    );
    if (!paid) {
      const latest = await OrderModel.findById(order._id).lean();
      if (latest?.paymentStatus !== 'paid') {
        await OrderModel.updateOne(
          { _id: order._id, paymentStatus: { $ne: 'paid' } },
          { $set: { paymentStatus: 'refund_pending', ...(paymentId ? { razorpayPaymentId: paymentId } : {}) } },
        );
        return NextResponse.json({ ok: true, action: 'refund_pending' });
      }
    }
  } else if (event.event === 'payment.failed' && order.paymentStatus === 'pending') {
    order.paymentStatus = 'failed';
    await order.save();
    try {
      await cancelAndReleaseOrderStock(order.id);
    } catch (e) {
      console.error('Failed to release stock after payment failure', e);
    }
  }

  return NextResponse.json({ ok: true });
}
