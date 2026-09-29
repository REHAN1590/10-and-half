import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import { sampleProducts } from '@/lib/products';
import ProductPurchase from '@/components/ProductPurchase';
import ProductGallery from '@/components/ProductGallery';

export const dynamic = 'force-dynamic';

type Product = {
  id:string; name:string; fit:string; cat:string; price:number; was?:number; gsm:number;
  method:string; colors:string[]; print?:string; tag?:string; sizes:Record<string,number>;
  desc:string; imageUrl?:string; images?:{url:string;publicId:string;alt?:string}[];
};

async function getProduct(id:string):Promise<Product|null>{
  try {
    await connectDB();
    const row:any = await ProductModel.findOne({$or:[{_id:id},{id:id}], active:true}).lean();
    if(row) return {...row, id:String(row._id), _id:undefined, sizes:Object.fromEntries(row.sizes || [])};
  } catch {}
  return sampleProducts.find(p=>p.id===id) || null;
}

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const product=await getProduct(id);
  if(!product) notFound();
  const availableSizes=Object.entries(product.sizes || {}).filter(([,stock])=>Number(stock)>0).map(([size])=>size);
  return <main className="wrap section product-page">
    <Link href="/shop" className="muted">← Back to shop</Link>
    <div className="product-detail">
      <ProductGallery name={product.name} imageUrl={product.imageUrl} images={product.images || []} print={product.print}/>
      <div className="product-info">
        <div className="eyebrow">{product.cat} · {product.fit}</div>
        <h1>{product.name}</h1>
        {product.tag && <span className="tag">{product.tag}</span>}
        <div className="product-price">₹{Number(product.price).toLocaleString('en-IN')} {product.was ? <del>₹{Number(product.was).toLocaleString('en-IN')}</del> : null}</div>
        <p className="product-desc">{product.desc}</p>
        <div className="product-meta"><span>{product.gsm} GSM</span><span>{product.method}</span><span>Ships across India</span></div>
        <ProductPurchase product={{...product, sizes:availableSizes}} />
      </div>
    </div>
  </main>;
}
