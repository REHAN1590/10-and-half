import Link from 'next/link';

type SuccessPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

export default async function Success({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const order = params.order || '—';

  return (
    <main className="wrap section success">
      <div className="success-icon">✓</div>

      <div className="eyebrow">10 & Half</div>

      <h1>Order confirmed</h1>

      <p>
        Your order <b className="mono">{order}</b> has been received.
        We’ll process it and update you when it ships.
      </p>

      <div>
        <Link className="btn accent" href="/shop">
          Continue shopping
        </Link>{' '}
        <Link className="btn" href="/account">
          View orders
        </Link>
      </div>
    </main>
  );
}