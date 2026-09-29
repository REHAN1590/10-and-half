import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { OrderModel } from '@/models/Order';
import { z } from 'zod';
import { cancelAndReleaseOrderStock } from '@/lib/orders';

const statuses = ['new','printing','shipped','delivered','cancelled'] as const;

export async function GET() {
  try { await requireAdmin(); await connectDB(); const orders = await OrderModel.find().sort({ createdAt: -1 }).limit(200).lean(); return NextResponse.json({ orders }); }
  catch (e:any) { return NextResponse.json({ error: e?.message === 'FORBIDDEN' ? 'Forbidden' : 'Authentication required.' }, { status: e?.message === 'FORBIDDEN' ? 403 : 401 }); }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    await connectDB();
    const input = z.object({
      id: z.string().min(1),
      status: z.enum(statuses),
      note: z.string().trim().max(300).optional(),
      courier: z.string().trim().max(80).optional(),
      awb: z.string().trim().max(120).optional(),
      trackingUrl: z.string().url().max(500).optional().or(z.literal('')),
    }).parse(await req.json());

    const current = await OrderModel.findOne({ id: input.id });
    if (!current) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    if (input.status === 'cancelled') {
      if (current.paymentStatus === 'paid') {
        return NextResponse.json({ error: 'Paid orders require refund handling before cancellation.' }, { status: 409 });
      }
      await cancelAndReleaseOrderStock(input.id);
      const cancelled = await OrderModel.findOne({ id: input.id }).lean();
      return NextResponse.json({ order: cancelled });
    }

    const fulfillmentStatuses = new Set(['printing', 'shipped', 'delivered']);
    const isCod = current.paymentMethod === 'COD';
    const isPaidOnline = current.paymentMethod !== 'COD' && current.paymentStatus === 'paid';
    if (fulfillmentStatuses.has(input.status) && !isCod && !isPaidOnline) {
      return NextResponse.json({ error: 'Online payment must be confirmed before fulfillment can advance.' }, { status: 409 });
    }
    if (current.status === 'expired') return NextResponse.json({ error: 'Expired orders cannot be fulfilled.' }, { status: 409 });
    if (current.status === 'cancelled') return NextResponse.json({ error: 'Cancelled orders cannot be reopened from this dashboard.' }, { status: 409 });

    const now = new Date();
    const update: any = { status: input.status };
    if (input.courier !== undefined || input.awb !== undefined || input.trackingUrl !== undefined || input.status === 'shipped' || input.status === 'delivered') {
      update.shipment = {
        courier: input.courier ?? current.shipment?.courier ?? '',
        awb: input.awb ?? current.shipment?.awb ?? '',
        trackingUrl: input.trackingUrl ?? current.shipment?.trackingUrl ?? '',
        shippedAt: input.status === 'shipped' ? (current.shipment?.shippedAt ?? now) : current.shipment?.shippedAt,
        deliveredAt: input.status === 'delivered' ? (current.shipment?.deliveredAt ?? now) : current.shipment?.deliveredAt,
      };
    }
    const historyEntry = { status: input.status, note: input.note || '', at: now };
    const order = await OrderModel.findOneAndUpdate(
      { id: input.id },
      { $set: update, $push: { statusHistory: historyEntry } },
      { new: true },
    ).lean();
    return NextResponse.json({ order });
  } catch(e:any) {
    const status=e?.message==='FORBIDDEN'?403:e?.name==='ZodError'?400:e?.message==='PAID_ORDER_REQUIRES_REFUND'?409:401;
    return NextResponse.json({error:e?.message||'Could not update order.'},{status});
  }
}
