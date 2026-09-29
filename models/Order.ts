import { Schema, model, models } from 'mongoose';

const OrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  id: { type: String, unique: true, index: true },
  customer: { type: Schema.Types.Mixed, required: true },
  items: { type: [Schema.Types.Mixed], required: true },
  subtotal: { type: Number, required: true },
  shipping: { type: Number, required: true },
  codFee: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  paymentMethod: { type: String, enum: ['UPI', 'CARD', 'COD'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refund_pending', 'refunded'], default: 'pending' },
  status: { type: String, enum: ['awaiting_payment', 'new', 'printing', 'shipped', 'delivered', 'cancelled', 'expired'], default: 'new' },
  reservationExpiresAt: { type: Date, index: true },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: String,
  stockReleasedAt: Date,
  artwork: {
    url: String,
    publicId: String,
    fileName: String,
  },
  shipment: {
    courier: String,
    awb: String,
    trackingUrl: String,
    shippedAt: Date,
    deliveredAt: Date,
  },
  statusHistory: [{
    status: String,
    note: String,
    at: Date,
  }],
}, { timestamps: true });

export const OrderModel = models.Order || model('Order', OrderSchema);
