import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAdmin } from '@/lib/auth';

export const runtime='nodejs';
const MAX_BYTES=8*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
function sign(params:Record<string,string>,secret:string){const canonical=Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&');return crypto.createHash('sha1').update(canonical+secret).digest('hex');}
export async function POST(req:Request){
  try{
    await requireAdmin();
    const cloudName=process.env.CLOUDINARY_CLOUD_NAME,apiKey=process.env.CLOUDINARY_API_KEY,apiSecret=process.env.CLOUDINARY_API_SECRET;
    if(!cloudName||!apiKey||!apiSecret)return NextResponse.json({error:'Cloudinary is not configured.'},{status:503});
    const form=await req.formData(); const value=form.get('file');
    if(!(value instanceof File))return NextResponse.json({error:'No product image provided.'},{status:400});
    if(!ALLOWED.has(value.type))return NextResponse.json({error:'Use JPG, PNG, or WebP.'},{status:400});
    if(value.size>MAX_BYTES)return NextResponse.json({error:'Each image must be 8 MB or smaller.'},{status:400});
    const timestamp=Math.floor(Date.now()/1000).toString(),folder='ten-half/products',publicId=`product-${crypto.randomUUID()}`;
    const signature=sign({folder,public_id:publicId,timestamp},apiSecret);
    const upload=new FormData(); upload.append('file',new Blob([await value.arrayBuffer()],{type:value.type}),value.name); upload.append('api_key',apiKey); upload.append('timestamp',timestamp); upload.append('folder',folder); upload.append('public_id',publicId); upload.append('signature',signature);
    const r=await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{method:'POST',body:upload}); const data=await r.json();
    if(!r.ok||!data.secure_url)return NextResponse.json({error:'Cloudinary upload failed.'},{status:502});
    return NextResponse.json({ok:true,url:data.secure_url,publicId:data.public_id,fileName:value.name});
  }catch(e:any){const status=e?.message==='FORBIDDEN'?403:e?.message==='UNAUTHENTICATED'?401:500;return NextResponse.json({error:status===403?'Admin access required.':status===401?'Authentication required.':'Could not upload product image.'},{status});}
}
