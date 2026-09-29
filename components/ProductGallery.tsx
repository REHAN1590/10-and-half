
'use client';
import {useMemo,useState} from 'react';
export default function ProductGallery({name,imageUrl,images,print}:{name:string;imageUrl?:string;images:{url:string;publicId:string;alt?:string}[];print?:string}){
 const all=useMemo(()=>{const list=[...(images||[])].filter(x=>x?.url); if(imageUrl&&!list.some(x=>x.url===imageUrl))list.unshift({url:imageUrl,publicId:'legacy',alt:name}); return list;},[images,imageUrl,name]);
 const [active,setActive]=useState(0); const current=all[active];
 return <div className="product-gallery"><div className="product-detail-art">{current?<img src={current.url} alt={current.alt||name}/>:<div>{print||'TEE'}</div>}</div>{all.length>1&&<div className="gallery-thumbs" aria-label="Product images">{all.map((x,i)=><button type="button" className={`gallery-thumb ${i===active?'selected':''}`} key={x.publicId+i} onClick={()=>setActive(i)}><img src={x.url} alt=""/></button>)}</div>}</div>;
}
