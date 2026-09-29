'use client';
import { useEffect, useState } from 'react';

const statuses = ['new','printing','shipped','delivered','cancelled'] as const;
type Order = any;

export default function AdminOrderManager(){
  const [orders,setOrders]=useState<Order[]>([]); const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [note,setNote]=useState<Record<string,string>>({});
  async function load(){ const r=await fetch('/api/admin/orders'); const d=await r.json(); if(!r.ok){setError(d.error||'Could not load orders.');return;} setOrders(d.orders||[]); }
  useEffect(()=>{load()},[]);
  async function update(o:Order,status:string){
    setBusy(o.id);setError('');
    const shipping=o.shipment||{};
    const payload={id:o.id,status,note:note[o.id]||'',courier:shipping.courier||'',awb:shipping.awb||'',trackingUrl:shipping.trackingUrl||''};
    const r=await fetch('/api/admin/orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json();
    if(!r.ok){setError(d.error||'Could not update order.');setBusy('');return;} setOrders(xs=>xs.map(x=>x.id===o.id?d.order:x)); setBusy('');
  }
  function setShipping(id:string,key:string,value:string){setOrders(xs=>xs.map(x=>x.id===id?{...x,shipment:{...(x.shipment||{}),[key]:value}}:x))}
  return <section className="section admin-orders"><div className="admin-editor-head"><div><div className="eyebrow">Fulfillment</div><h2>Orders</h2></div><button className="btn" onClick={load}>Refresh</button></div>{error&&<div className="notice error">{error}</div>}
    <div className="admin-order-list">{orders.map(o=><article className="card admin-order-card" key={o.id}><div className="admin-order-top"><div><strong>{o.id}</strong><div className="muted">{new Date(o.createdAt).toLocaleString('en-IN')} · {o.customer?.name} · {o.customer?.phone}</div></div><div className="order-badges"><span className="status-live">{o.status}</span><span className="status-hidden">{o.paymentStatus}</span></div></div>
      <div className="admin-order-items">{(o.items||[]).map((i:any,idx:number)=><div key={idx}>{i.name} · {i.size} · {i.color} × {i.qty} — ₹{i.lineTotal}</div>)}</div>
      <div className="admin-order-meta"><strong>₹{o.amount}</strong><span>{o.paymentMethod}</span><span>{o.customer?.city} · {o.customer?.pin}</span>{o.artwork?.url&&<a className="btn" href={o.artwork.url} target="_blank">Artwork</a>}</div>
      <div className="two"><label className="field"><span>Courier</span><input value={o.shipment?.courier||''} onChange={e=>setShipping(o.id,'courier',e.target.value)} placeholder="Delhivery / DTDC / India Post"/></label><label className="field"><span>AWB / Tracking ID</span><input value={o.shipment?.awb||''} onChange={e=>setShipping(o.id,'awb',e.target.value)} placeholder="Tracking number"/></label></div>
      <label className="field"><span>Tracking URL</span><input type="url" value={o.shipment?.trackingUrl||''} onChange={e=>setShipping(o.id,'trackingUrl',e.target.value)} placeholder="https://..."/></label>
      <label className="field"><span>Status note</span><input value={note[o.id]||''} onChange={e=>setNote(n=>({...n,[o.id]:e.target.value}))} placeholder="Optional customer-facing note"/></label>
      <div className="admin-status-actions">{statuses.map(s=><button key={s} className={`btn ${o.status===s?'primary':''}`} disabled={busy===o.id} onClick={()=>update(o,s)}>{busy===o.id?'Saving…':s}</button>)}</div>
      {(o.statusHistory||[]).length>0&&<div className="timeline compact">{[...(o.statusHistory||[])].reverse().slice(0,5).map((h:any,i:number)=><div className="timeline-item" key={i}><b>{h.status}</b><span>{new Date(h.at).toLocaleString('en-IN')}</span>{h.note&&<small>{h.note}</small>}</div>)}</div>}
    </article>)}</div></section>
}
