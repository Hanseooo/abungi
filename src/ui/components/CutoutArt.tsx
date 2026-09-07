import { useState } from 'react';
import { cutoutUrl } from '../../services/assets/assetRegistry';
export function CutoutArt({assetId,name,className=''}:{assetId:string;name:string;className?:string}){
  const[failed,setFailed]=useState(false);
  if(failed)return <div className={`cutout-fallback ${className}`} role="img" aria-label={`${name} artwork unavailable`}><span aria-hidden="true" /></div>;
  return <img className={`cutout-art ${className}`} src={cutoutUrl(assetId)} alt={`${name} cardboard cutout`} draggable={false} onError={()=>setFailed(true)}/>;
}
