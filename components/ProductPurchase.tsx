'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useCart} from '@/components/CartProvider';

type Product={id:string;name:string;price:number;colors:string[];sizes:string[];imageUrl?:string|null;cat?:string};
export default function ProductPurchase({product}:{product:Product}){
  const {add}=useCart(); const router=useRouter();
  const [size,setSize]=useState(product.sizes[0]||'');
  const [color,setColor]=useState(product.colors[0]||'');
  const [qty,setQty]=useState(1); const [message,setMessage]=useState('');
  const unavailable=product.sizes.length===0;
  function addToCart(){
    if(!size||!color)return;
    add({productId:product.id,name:product.name,price:product.price,color,size,qty,imageUrl:product.imageUrl||null});
    setMessage('Added to cart');
    setTimeout(()=>setMessage(''),1800);
  }
  function buyNow(){addToCart();router.push('/cart');}
  return <div className="purchase-box">
    <div className="selector"><strong>Size</strong><div className="choice-row">{product.sizes.map(s=><button type="button" key={s} className={size===s?'choice selected':'choice'} onClick={()=>setSize(s)}>{s}</button>)}</div>{unavailable&&<small className="error-text">Currently out of stock.</small>}</div>
    <div className="selector"><strong>Colour</strong><div className="choice-row">{product.colors.map(c=><button type="button" key={c} className={color===c?'choice selected':'choice'} onClick={()=>setColor(c)}>{c}</button>)}</div></div>
    <div className="selector"><strong>Quantity</strong><div className="qty"><button type="button" onClick={()=>setQty(q=>Math.max(1,q-1))}>−</button><span>{qty}</span><button type="button" onClick={()=>setQty(q=>q+1)}>+</button></div></div>
    <div className="purchase-actions"><button className="btn primary full" disabled={unavailable} onClick={addToCart}>Add to cart</button><button className="btn accent full" disabled={unavailable} onClick={buyNow}>Buy now</button></div>
    {message&&<div className="upload-ok">✓ {message}</div>}
    {product.cat==='custom'&&<div className="notice">Custom product: after adding this tee, upload your artwork during checkout.</div>}
  </div>;
}
