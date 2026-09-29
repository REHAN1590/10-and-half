# 10 & Half — Next.js ecommerce

Step 13 adds a payment/order reliability hardening pass.

## Payment safety
- Payment verification checks the Razorpay signature.
- The server fetches the Razorpay payment and verifies order ID, amount, currency, and captured status.
- A captured payment received after the stock reservation expired is marked `refund_pending` instead of silently becoming a paid order after stock has been released.
- Razorpay webhooks validate their signature and payment amount/currency.
- Paid/refunded orders are idempotent against repeated webhook deliveries.

## Required environment variables
See `.env.example` for MongoDB, JWT, Cloudinary, and Razorpay settings.


## Step 14 — Shipping & order tracking
- Added `shipment` metadata to orders: courier, AWB/tracking ID, tracking URL, shipped/delivered timestamps.
- Added `statusHistory` timeline entries.
- Admin can update fulfillment status and shipping details from `/admin`.
- Customers see order history, shipment details, tracking link, and status timeline in `/account`.
- Kept `shipping` reserved for the numeric shipping charge so order totals remain backward compatible.

## Step 15 — Production reliability audit

This pass tightened the order/payment state machine before adding another external integration.

- Failed online payments now release reserved stock instead of leaving inventory stuck.
- Expired reservations can release stock for both pending and failed payments.
- Admin fulfillment cannot move an unpaid online order into printing/shipped/delivered.
- Expired/cancelled orders cannot be reopened into fulfillment.
- Cancelling unpaid/COD orders restores their stock transactionally.
- Paid online orders cannot be cancelled from the fulfillment dashboard without a refund workflow.
- Razorpay browser verification and webhook payment capture use an atomic order-state transition so reservation expiry cannot race into an accidental paid state.
- Customer order creation/get-history APIs return authentication errors cleanly instead of leaking a server error.

### Verification note
The project environment used for this archive does not contain `node_modules`, so a full Next.js build cannot be truthfully claimed here. A TypeScript pass was attempted; its reported errors are dependency/type-resolution failures caused by missing installed packages rather than a completed production build. Run `npm install` and then `npm run build` locally before deployment.

## Step 16 — Deployment preparation
- Added `/api/health` for basic database/service health checks.
- Added baseline security response headers in `next.config.ts`.
- Disabled the sample-product seed endpoint in production.
- Added `lib/env.ts` for server-side environment validation when a deployment path explicitly invokes it.

### Local production checklist
1. Copy `.env.example` to `.env.local` and fill every secret.
2. Use a production MongoDB database/user with only the permissions the app needs.
3. Keep Razorpay in test mode until checkout, verification, and webhook flows have been tested end-to-end.
4. Configure the Razorpay webhook URL to `/api/payments/webhook` and use the exact webhook secret in the environment.
5. Configure Cloudinary credentials only as server environment variables.
6. Run `npm install`.
7. Run `npm run build`.
8. Run `npm start` and verify `/api/health`, login, product browsing, cart, COD checkout, Razorpay test checkout, webhook handling, admin fulfillment, and artwork upload.
9. Configure the production domain and HTTPS before accepting real customers.

### Do not deploy yet if
- `npm run build` fails locally.
- Razorpay is still using placeholder credentials.
- MongoDB is unreachable from the deployment environment.
- Cloudinary upload credentials have not been tested.
- The production domain has not been added to the payment/provider configuration.
