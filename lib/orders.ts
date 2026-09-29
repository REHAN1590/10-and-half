import mongoose from 'mongoose';
import { ProductModel } from '@/models/Product';
import { OrderModel } from '@/models/Order';

export const PAYMENT_RESERVATION_MINUTES = 15;

export async function releaseExpiredReservations() {
  const now = new Date();
  const expired = await OrderModel.find({
    status: 'awaiting_payment',
    paymentStatus: { $in: ['pending', 'failed'] },
    reservationExpiresAt: { $lte: now },
    stockReleasedAt: { $exists: false },
  }).lean();

  let released = 0;
  for (const order of expired) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const locked = await OrderModel.findOneAndUpdate(
          {
            _id: order._id,
            status: 'awaiting_payment',
            paymentStatus: { $in: ['pending', 'failed'] },
            stockReleasedAt: { $exists: false },
          },
          { $set: { status: 'expired', stockReleasedAt: now } },
          { new: true, session },
        );
        if (!locked) return;

        for (const item of order.items as any[]) {
          await ProductModel.updateOne(
            { _id: item.productId },
            { $inc: { [`sizes.${item.size}`]: Number(item.qty) } },
            { session },
          );
        }
        released += 1;
      });
    } finally {
      await session.endSession();
    }
  }
  return released;
}

export async function cancelAndReleaseOrderStock(orderId: string) {
  const session = await mongoose.startSession();
  try {
    let released = false;
    await session.withTransaction(async () => {
      const order = await OrderModel.findOne({ id: orderId }).session(session);
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.stockReleasedAt) {
        if (order.status !== 'cancelled') {
          order.status = 'cancelled';
          order.statusHistory.push({ status: 'cancelled', note: 'Order cancelled', at: new Date() });
          await order.save({ session });
        }
        return;
      }
      if (order.paymentStatus === 'paid') throw new Error('PAID_ORDER_REQUIRES_REFUND');

      for (const item of order.items as any[]) {
        await ProductModel.updateOne(
          { _id: item.productId },
          { $inc: { [`sizes.${item.size}`]: Number(item.qty) } },
          { session },
        );
      }

      order.status = 'cancelled';
      order.stockReleasedAt = new Date();
      order.reservationExpiresAt = undefined;
      order.statusHistory.push({ status: 'cancelled', note: 'Order cancelled and stock released', at: new Date() });
      await order.save({ session });
      released = true;
    });
    return released;
  } finally {
    await session.endSession();
  }
}
