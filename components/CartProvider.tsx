'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = { productId:string; name:string; price:number; color:string; size:string; qty:number; imageUrl?:string|null };
type CartContextType = { items:CartItem[]; add:(item:CartItem)=>void; remove:(key:string)=>void; update:(key:string,qty:number)=>void; clear:()=>void; count:number; subtotal:number };
const Ctx=createContext<CartContextType|null>(null);
const key=(i:Pick<CartItem,'productId'|'color'|'size'>)=>`${i.productId}|${i.color}|${i.size}`;
export function CartProvider({children}:{children:React.ReactNode}){
 const [items,setItems]=useState<CartItem[]>([]); const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem('tenhalf-cart');if(raw)setItems(JSON.parse(raw));}catch{} setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem('tenhalf-cart',JSON.stringify(items))},[items,ready]);
 const value=useMemo(()=>({items,add:(item:CartItem)=>setItems(x=>{const k=key(item),i=x.findIndex(a=>key(a)===k);if(i<0)return [...x,item];const n=[...x];n[i]={...n[i],qty:n[i].qty+item.qty};return n}),remove:(k:string)=>setItems(x=>x.filter(i=>key(i)!==k)),update:(k:string,q:number)=>setItems(x=>x.map(i=>key(i)===k?{...i,qty:Math.max(1,q)}:i)),clear:()=>setItems([]),count:items.reduce((s,i)=>s+i.qty,0),subtotal:items.reduce((s,i)=>s+i.price*i.qty,0)}),[items]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCart(){const c=useContext(Ctx);if(!c)throw new Error('useCart must be used inside CartProvider');return c}
