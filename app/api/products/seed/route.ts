import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { sampleProducts } from '@/lib/products';

export async function POST(){
  if (process.env.NODE_ENV === 'production') return NextResponse.json({error:'Seed endpoint disabled in production'},{status:404});
  try { await requireAdmin(); await connectDB();
    for(const [index,p] of sampleProducts.entries()) await ProductModel.findByIdAndUpdate(p.id,{_id:p.id,...p,order:index},{upsert:true,new:true,setDefaultsOnInsert:true});
    return NextResponse.json({ok:true,count:sampleProducts.length});
  } catch(e:any){ return NextResponse.json({error:e?.message||'Seed failed'},{status:e?.message==='FORBIDDEN'?403:401}); }
}
