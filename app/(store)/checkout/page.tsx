
'use client';
import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';

declare global { interface Window { Razorpay?:new (options:any)=>{open:()=>void} } }
const money=(n:number)=>`₹${n.toLocaleString('en-IN')}`;
type Artwork={url:string;publicId:string;fileName:string};

export default function Checkout(){
 const {items,subtotal,clear}=useCart(); const router=useRouter(); const [pay,setPay]=useState<'UPI'|'CARD'|'COD'>('UPI'); const [busy,setBusy]=useState(false); const [uploading,setUploading]=useState(false); const [error,setError]=useState(''); const [user,setUser]=useState<any>(null); const [artwork,setArtwork]=useState<Artwork|null>(null);
 useEffect(()=>{fetch('/api/auth').then(r=>r.json()).then(x=>{if(!x.authenticated)router.push('/account?next=/checkout');else setUser(x.user)}).catch(()=>{})},[router]);
 const shipping=subtotal>=999?0:79; const codFee=pay==='COD'?49:0; const total=subtotal+shipping+codFee;
 async function uploadArtwork(file:File){
   setUploading(true); setError('');
   try{const fd=new FormData();fd.append('file',file);const r=await fetch('/api/uploads',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Artwork upload failed');setArtwork({url:d.url,publicId:d.publicId,fileName:d.fileName});}
   catch(err:any){setError(err.message||'Artwork upload failed.');}
   finally{setUploading(false)}
 }
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!items.length)return;setBusy(true);setError('');const f=new FormData(e.currentTarget);const body={customer:{name:String(f.get('name')),phone:String(f.get('phone')),email:String(f.get('email')),address:String(f.get('address')),city:String(f.get('city')),pin:String(f.get('pin'))},paymentMethod:pay,artwork,items:items.map(i=>({productId:i.productId,size:i.size,color:i.color,qty:i.qty}))};
  try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create order');
   if(pay==='COD'){clear();router.push(`/checkout/success?order=${encodeURIComponent(d.order.id)}`);return;}
   const pr=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:d.order.id})});const pd=await pr.json();if(!pr.ok)throw new Error(pd.error||'Could not start payment');
   if(!window.Razorpay)throw new Error('Payment checkout is still loading. Try again.');
   const rz=new window.Razorpay({key:pd.keyId,amount:pd.amount,currency:pd.currency,name:'10 & Half',description:'T-shirt order',order_id:pd.razorpayOrderId,prefill:{name:body.customer.name,email:body.customer.email,contact:body.customer.phone},theme:{color:'#FF4D1C'},handler:async (resp:any)=>{const vr=await fetch('/api/payments/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:d.order.id,razorpayOrderId:resp.razorpay_order_id,razorpayPaymentId:resp.razorpay_payment_id,razorpaySignature:resp.razorpay_signature})});const vd=await vr.json();if(!vr.ok){setError(vd.error||'Payment verification failed. Contact support if money was debited.');setBusy(false);return}clear();router.push(`/checkout/success?order=${encodeURIComponent(d.order.id)}`)}});rz.open();
  }catch(err:any){setError(err.message||'Something went wrong.');setBusy(false)}
 }
 if(!items.length)return <main className="wrap section"><h1>Cart is empty</h1><Link className="btn accent" href="/shop">Shop tees</Link></main>;
 return <><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"/><main className="wrap section"><div className="eyebrow">Secure checkout</div><h1>Checkout</h1>{error&&<div className="notice error">{error}</div>}<div className="checkout-layout"><form className="form" onSubmit={submit}><label className="field">Full name<input name="name" defaultValue={user?.name||''} required/></label><label className="field">Phone<input name="phone" inputMode="tel" required/></label><label className="field">Email<input name="email" type="email" defaultValue={user?.email||''} required/></label><label className="field">Address<textarea name="address" rows={3} required/></label><div className="two"><label className="field">City<input name="city" required/></label><label className="field">PIN code<input name="pin" inputMode="numeric" pattern="[0-9]{6}" required/></label></div><div className="artwork-box"><b>Custom artwork</b><p className="muted">Optional. JPG, PNG or WebP, maximum 8 MB.</p><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)uploadArtwork(file)}} disabled={uploading||busy}/>{uploading&&<small>Uploading artwork…</small>}{artwork&&<div className="upload-ok">✓ {artwork.fileName}<button type="button" onClick={()=>setArtwork(null)}>Remove</button></div>}</div><div className="pay"><b>Payment</b><label><input type="radio" checked={pay==='UPI'} onChange={()=>setPay('UPI')}/> UPI</label><label><input type="radio" checked={pay==='CARD'} onChange={()=>setPay('CARD')}/> Card</label><label><input type="radio" checked={pay==='COD'} onChange={()=>setPay('COD')}/> Cash on delivery <small>+ ₹49</small></label></div><button className="btn accent" disabled={busy||uploading}>{busy?'Processing…':pay==='COD'?'Place COD order':'Pay securely'}</button></form><aside className="summary"><h3>Your order</h3>{items.map(i=><p key={`${i.productId}|${i.color}|${i.size}`}><span>{i.name} × {i.qty}</span><b>{money(i.price*i.qty)}</b></p>)}<p><span>Shipping</span><b>{shipping?'₹79':'Free'}</b></p>{codFee>0&&<p><span>COD fee</span><b>₹49</b></p>}<hr/><p className="total"><span>Total</span><b>{money(total)}</b></p></aside></div></main></>
}
