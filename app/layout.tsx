import './globals.css';
import Link from 'next/link';
import { CartProvider } from '@/components/CartProvider';

export const metadata = { title: '10 & Half — Tees that get you noticed', description: '10 & Half T-shirts and custom printing.' };

export default function RootLayout({children}:{children:React.ReactNode}){
 return <><CartProvider><header className="nav"><div className="wrap navin"><Link href="/" className="logo"><i/>10 &amp; Half</Link><nav className="navlinks"><Link href="/shop">Shop</Link><Link href="/shop?fit=oversized">Oversized</Link><Link href="/shop?cat=graphic">Graphic</Link><Link href="/shop?cat=plain">Plain</Link><Link href="/shop?cat=custom">Custom print</Link></nav><div className="spacer"/><Link href="/account" className="btn">Account</Link><Link href="/cart" className="btn">Cart</Link></div></header>{children}<footer className="wrap footer">© 2026 10 &amp; Half · Kolkata, India · Bulk &amp; B2B: hello@10andhalf.in</footer></CartProvider></>
}
