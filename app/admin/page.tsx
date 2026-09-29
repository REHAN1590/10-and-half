import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import AdminProductManager from '@/components/AdminProductManager';
import AdminOrderManager from '@/components/AdminOrderManager';

export const dynamic='force-dynamic';

export default async function Admin(){
  try{await requireAdmin();}catch(e){if(e instanceof Error&&e.message==='FORBIDDEN')redirect('/account?error=forbidden');redirect('/account');}
  let products:any[]=[]; let dbError='';
  try{await connectDB();products=await ProductModel.find({}).sort({order:1,createdAt:-1}).lean();}catch{dbError='MongoDB is not connected. Add MONGODB_URI and restart the app.';}
  const serialized=products.map((p:any)=>({...p,id:String(p._id),_id:undefined,colors:[...(p.colors||[])],sizes:Object.fromEntries(p.sizes instanceof Map?p.sizes.entries():Object.entries(p.sizes||{}))}));
  return <main className="wrap section"><div className="eyebrow">10 &amp; Half · Admin</div><h1>Catalog &amp; Inventory</h1>{dbError?<div className="notice error">{dbError}</div>:<><AdminProductManager initial={serialized}/><AdminOrderManager/></>}</main>;
}
