import Link from 'next/link';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import { sampleProducts } from '@/lib/products';

export const dynamic='force-dynamic';

async function getProducts(){
  try { await connectDB(); const rows=await ProductModel.find({active:true}).sort({order:1,createdAt:-1}).lean(); if(rows.length)return rows.map((p:any)=>({...p,id:String(p._id),_id:undefined})); }
  catch {}
  return sampleProducts;
}

export default async function Shop({searchParams}:{searchParams:Promise<{fit?:string;cat?:string}>}){
  const q=await searchParams; const products=await getProducts(); const ps=products.filter((p:any)=>(!q.fit||p.fit===q.fit)&&(!q.cat||p.cat===q.cat));
  return <main className="wrap section"><div className="eyebrow">The catalog</div><h1>All tees</h1><p className="muted">{ps.length} styles</p><div className="grid">{ps.map((p:any)=><Link href={`/product/${p.id}`} className="card" key={p.id}><div className="product-art">{p.print||'TEE'}</div><h3>{p.name}</h3><p className="muted">{p.gsm} GSM · {p.method}</p><div className="price">₹{Number(p.price).toLocaleString('en-IN')}</div></Link>)}</div></main>
}
