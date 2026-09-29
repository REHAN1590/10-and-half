'use client';

import { useMemo, useState } from 'react';

type Product = {
  id: string; name: string; fit: string; cat: string; price: number; was?: number | null;
  gsm: number; method: string; colors: string[]; print: string; tag?: string;
  sizes: Record<string, number>; desc: string; active: boolean; imageUrl?: string | null; images?: {url:string;publicId:string;alt?:string}[]; order?: number;
};

const blank: Product = { id:'', name:'', fit:'oversized', cat:'graphic', price:799, was:null, gsm:240, method:'DTF', colors:['black','white'], print:'', tag:'', sizes:{S:0,M:0,L:0,XL:0,XXL:0}, desc:'', active:true, imageUrl:'', images:[], order:0 };
const fits = ['oversized','regular','fullsleeve','crop','kids'];
const cats = ['graphic','plain','custom'];
const sizeKeys = ['XS','S','M','L','XL','XXL'];

export default function AdminProductManager({ initial }: { initial: Product[] }) {
  const [products,setProducts] = useState(initial);
  const [form,setForm] = useState<Product>(blank);
  const [editing,setEditing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [uploading,setUploading] = useState(false);
  const totalStock = useMemo(()=>Object.values(form.sizes).reduce((a,b)=>a+Number(b||0),0),[form.sizes]);

  function reset(){setForm(blank);setEditing(false);setMessage('');setError('');}
  function edit(p:Product){setForm({...p,colors:[...p.colors],sizes:{...p.sizes}});setEditing(true);setMessage('');setError('');window.scrollTo({top:0,behavior:'smooth'});}
  function setSize(k:string,v:string){setForm(f=>({...f,sizes:{...f.sizes,[k]:Math.max(0,Number(v)||0)}}));}
  async function uploadImages(files:FileList|null){
    if(!files?.length)return;
    setUploading(true);setError('');setMessage('');
    try{
      const uploaded=[...(form.images||[])];
      for(const file of Array.from(files)){
        const fd=new FormData();fd.append('file',file);
        const res=await fetch('/api/admin/uploads',{method:'POST',body:fd});
        const data=await res.json();if(!res.ok)throw new Error(data.error||'Upload failed.');
        if(uploaded.length>=8)break;
        uploaded.push({url:data.url,publicId:data.publicId,alt:form.name||file.name});
      }
      setForm(f=>({...f,images:uploaded,imageUrl:uploaded[0]?.url||f.imageUrl||''}));
      setMessage('Image upload complete. Save the product to keep the gallery.');
    }catch(e:any){setError(e.message)}finally{setUploading(false)}
  }
  function removeImage(index:number){setForm(f=>{const images=[...(f.images||[])];images.splice(index,1);return {...f,images,imageUrl:images[0]?.url||''}})}
  function setColors(v:string){setForm(f=>({...f,colors:v.split(',').map(x=>x.trim()).filter(Boolean)}));}

  async function save(){
    setBusy(true);setError('');setMessage('');
    try{
      const payload={...form, id: form.id || undefined, price:Number(form.price), was:form.was?Number(form.was):null, gsm:Number(form.gsm), order:Number(form.order)||0};
      const res=await fetch('/api/products',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Could not save product.');
      setProducts(p=>editing?p.map(x=>x.id===data.id?data:x):[data,...p]);
      setMessage(editing?'Product updated.':'Product created.');
      setForm(data);setEditing(true);
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }
  async function remove(id:string){
    if(!confirm('Delete this product? Existing orders are not changed.')) return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/products?id='+encodeURIComponent(id),{method:'DELETE'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not delete.');setProducts(p=>p.filter(x=>x.id!==id));if(form.id===id)reset();setMessage('Product deleted.');}catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  return <div className="admin-products">
    <section className="card admin-editor">
      <div className="admin-editor-head"><div><div className="eyebrow">Catalog editor</div><h2>{editing?'Edit product':'Add product'}</h2></div><button className="btn" onClick={reset}>New</button></div>
      <div className="form admin-form">
        <div className="two"><label className="field"><span>Name</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Product ID</span><input value={form.id} disabled={editing} placeholder="auto-from-name" onChange={e=>setForm({...form,id:e.target.value})}/></label></div>
        <div className="two"><label className="field"><span>Fit</span><select value={form.fit} onChange={e=>setForm({...form,fit:e.target.value})}>{fits.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Category</span><select value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{cats.map(x=><option key={x}>{x}</option>)}</select></label></div>
        <div className="two"><label className="field"><span>Price ₹</span><input type="number" min="1" value={form.price} onChange={e=>setForm({...form,price:Number(e.target.value)})}/></label><label className="field"><span>Compare-at price ₹</span><input type="number" min="1" value={form.was??''} onChange={e=>setForm({...form,was:e.target.value?Number(e.target.value):null})}/></label></div>
        <div className="two"><label className="field"><span>GSM</span><input type="number" min="100" value={form.gsm} onChange={e=>setForm({...form,gsm:Number(e.target.value)})}/></label><label className="field"><span>Printing method</span><input value={form.method} onChange={e=>setForm({...form,method:e.target.value})}/></label></div>
        <label className="field"><span>Colours — comma separated</span><input value={form.colors.join(', ')} onChange={e=>setColors(e.target.value)}/></label>
        <div><div className="eyebrow">Stock by size · total {totalStock}</div><div className="size-stock">{sizeKeys.map(k=><label className="field" key={k}><span>{k}</span><input type="number" min="0" value={form.sizes[k]??0} onChange={e=>setSize(k,e.target.value)}/></label>)}</div></div>
        <div className="two"><label className="field"><span>Print/design label</span><input value={form.print} onChange={e=>setForm({...form,print:e.target.value})}/></label><label className="field"><span>Tag</span><input value={form.tag??''} onChange={e=>setForm({...form,tag:e.target.value})}/></label></div>
        <div className="field"><span>Product images · up to 8</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e=>uploadImages(e.target.files)}/><small className="muted">JPG, PNG or WebP · max 8 MB each. First image is the primary.</small>{(form.images||[]).length>0&&<div className="admin-image-grid">{(form.images||[]).map((img,i)=><div className="admin-image-card" key={img.publicId+i}><img src={img.url} alt=""/><div><small>{i===0?'Primary':'Gallery '+(i+1)}</small><button type="button" className="btn" onClick={()=>removeImage(i)}>Remove</button></div></div>)}</div>}</div><label className="field"><span>Or use an image URL</span><input type="url" value={form.imageUrl??''} placeholder="https://..." onChange={e=>setForm({...form,imageUrl:e.target.value})}/></label>
        <label className="field"><span>Description</span><textarea rows={4} value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/></label>
        <div className="two"><label className="field"><span>Sort order</span><input type="number" value={form.order??0} onChange={e=>setForm({...form,order:Number(e.target.value)})}/></label><label className="toggle"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/><span>Visible in storefront</span></label></div>
        {error&&<div className="notice error">{error}</div>}{message&&<div className="notice">{message}</div>}
        <div className="purchase-actions"><button className="btn accent" disabled={busy||!form.name||!form.desc} onClick={save}>{busy?'Saving…':editing?'Save changes':'Create product'}</button>{editing&&<button className="btn" onClick={()=>remove(form.id)} disabled={busy}>Delete</button>}</div>
      </div>
    </section>
    <section className="section"><div className="admin-editor-head"><div><div className="eyebrow">Inventory</div><h2>Products</h2></div><span className="muted">{products.length} total</span></div><div className="admin-product-list">{products.map(p=><article className="admin-product-row" key={p.id}><div className="admin-thumb">{p.imageUrl?<img src={p.imageUrl} alt=""/>:<span>10½</span>}</div><div><strong>{p.name}</strong><div className="muted">{p.id} · {p.fit} · {p.cat}</div></div><div><strong>₹{p.price}</strong><div className="muted">{Object.values(p.sizes||{}).reduce((a,b)=>a+Number(b||0),0)} stock</div></div><div><span className={p.active?'status-live':'status-hidden'}>{p.active?'LIVE':'HIDDEN'}</span></div><div className="admin-row-actions"><button className="btn" onClick={()=>edit(p)}>Edit</button><button className="btn" onClick={()=>remove(p.id)}>Delete</button></div></article>)}</div></section>
  </div>;
}
