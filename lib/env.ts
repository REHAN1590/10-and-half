const required = [
  'MONGODB_URI',
  'AUTH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

export function getServerEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  if (process.env.AUTH_SECRET!.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return Object.fromEntries(required.map((key) => [key, process.env[key]!])) as Record<(typeof required)[number], string>;
}
