import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ProductModel } from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const productSchema = z.object({
  id: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(2), fit: z.enum(['oversized','regular','fullsleeve','crop','kids']),
  cat: z.enum(['graphic','plain','custom']), price: z.number().positive(), was: z.number().positive().optional().nullable(),
  gsm: z.number().int().min(100), method: z.string().min(1), colors: z.array(z.string()).min(1),
  images: z.array(z.object({url:z.string().url(),publicId:z.string().min(1),alt:z.string().optional()})).max(8).optional().default([]),
  customColors: z.record(z.string(), z.string()).optional(), print: z.string().default('none'), tag: z.string().optional(),
  desc: z.string().min(1), sizes: z.record(z.string(), z.number().int().min(0)), active: z.boolean().default(true), imageUrl: z.string().url().optional().nullable(), order: z.number().int().optional()
});

function serialize(p:any){ return {...p, id:String(p._id), _id:undefined}; }

export async function GET(req:NextRequest){
  try {
    await connectDB();
    const includeHidden = req.nextUrl.searchParams.get('admin') === '1';
    if(includeHidden){ try{ await requireAdmin(); }catch{return NextResponse.json({error:'Forbidden'},{status:403});} }
    const filter = includeHidden ? {} : {active:true};
    const products = await ProductModel.find(filter).sort({order:1,createdAt:-1}).lean();
    return NextResponse.json(products.map(serialize));
  } catch { return NextResponse.json({error:'Database unavailable'},{status:500}); }
}

export async function POST(req:NextRequest){
  try { await requireAdmin(); await connectDB(); const body=productSchema.parse(await req.json());
    const id=body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if(await ProductModel.exists({_id:id})) return NextResponse.json({error:'Product id already exists'},{status:409});
    const product=await ProductModel.create({_id:id,...body});
    return NextResponse.json(serialize(product.toObject()),{status:201});
  } catch(e:any){ const status=e?.message==='FORBIDDEN'?403:e?.name==='ZodError'?400:401; return NextResponse.json({error:e?.message||'Could not create product'},{status}); }
}

export async function PATCH(req:NextRequest){
  try { await requireAdmin(); await connectDB(); const body=await req.json(); const id=String(body.id||''); if(!id)return NextResponse.json({error:'id required'},{status:400}); delete body.id; const clean=productSchema.partial().parse(body); const product=await ProductModel.findByIdAndUpdate(id,clean,{new:true,runValidators:true}).lean(); if(!product)return NextResponse.json({error:'Not found'},{status:404}); return NextResponse.json(serialize(product)); }
  catch(e:any){ const status=e?.message==='FORBIDDEN'?403:e?.name==='ZodError'?400:401; return NextResponse.json({error:e?.message||'Could not update product'},{status}); }
}

export async function DELETE(req:NextRequest){
  try { await requireAdmin(); await connectDB(); const id=req.nextUrl.searchParams.get('id'); if(!id)return NextResponse.json({error:'id required'},{status:400}); const result=await ProductModel.findByIdAndDelete(id); if(!result)return NextResponse.json({error:'Not found'},{status:404}); return NextResponse.json({ok:true}); }
  catch(e:any){ const status=e?.message==='FORBIDDEN'?403:401; return NextResponse.json({error:e?.message||'Could not delete product'},{status}); }
}
