// Position is the fraction of available space (or overflow) on each axis.
export function normalizeCrop(value){
  const number=(key,fallback,min,max)=>typeof value?.[key]==='number'&&Number.isFinite(value[key])?Math.max(min,Math.min(max,value[key])):fallback;
  return {fit:value?.fit==='contain'?'contain':'cover',zoom:number('zoom',1,.25,4),x:number('x',.5,0,1),y:number('y',.5,0,1)};
}
export function cropRect(iw,ih,w,h,value){
  const crop=normalizeCrop(value);
  if(![iw,ih,w,h].every(n=>Number.isFinite(n)&&n>0))return {x:0,y:0,width:0,height:0};
  const scale=(crop.fit==='contain'?Math.min(w/iw,h/ih):Math.max(w/iw,h/ih))*crop.zoom;
  const width=iw*scale,height=ih*scale;
  return {x:(w-width)*crop.x||0,y:(h-height)*crop.y||0,width,height};
}
