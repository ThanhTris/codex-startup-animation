import {readFile,lstat} from 'node:fs/promises';
import {extname,basename,join} from 'node:path';

export const MAX_IMAGE_BYTES=30*1024*1024;
const MIME_BY_EXTENSION=new Map([['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.gif','image/gif']]);
export function imageMime(name,bytes){
  const ext=extname(name).toLowerCase(),expected=MIME_BY_EXTENSION.get(ext);
  if(!expected||!Buffer.isBuffer(bytes))return null;
  if(expected==='image/png'&&bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return expected;
  if(expected==='image/jpeg'&&bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return expected;
  if(expected==='image/webp'&&bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return expected;
  if(expected==='image/gif'&&bytes.length>=14&&/^GIF8[79]a$/.test(bytes.toString('ascii',0,6)))return expected;
  return null;
}
// Walk GIF blocks before decoding to bound frame count and decoded pixel work.
export function gifInfo(bytes){
  const invalid=()=>{throw new Error('GIF không hợp lệ hoặc bị thiếu dữ liệu.');};
  if(imageMime('image.gif',bytes)!=='image/gif')invalid();
  const width=bytes.readUInt16LE(6),height=bytes.readUInt16LE(8);
  if(!width||!height||width>4096||height>4096||width*height>2073600)throw new Error('GIF tối đa 2 megapixel (khoảng Full HD).');
  let p=13,frames=0,durationMs=0,delay=100,ended=false;
  const need=n=>{if(p+n>bytes.length)invalid();};
  const blocks=()=>{while(true){need(1);const size=bytes[p++];if(!size)return;need(size);p+=size;}};
  if(bytes[10]&128)p+=3*(2**((bytes[10]&7)+1));
  while(p<bytes.length){
    const marker=bytes[p++];
    if(marker===0x3b){ended=true;break;}
    if(marker===0x21){
      need(1);const label=bytes[p++];
      if(label===0xf9){need(6);if(bytes[p]!==4||bytes[p+5]!==0)invalid();delay=Math.max(20,bytes.readUInt16LE(p+2)*10||100);}
      blocks();
    }else if(marker===0x2c){
      need(9);const left=bytes.readUInt16LE(p),top=bytes.readUInt16LE(p+2),w=bytes.readUInt16LE(p+4),h=bytes.readUInt16LE(p+6),packed=bytes[p+8];p+=9;
      if(!w||!h||left+w>width||top+h>height)invalid();
      if(packed&128)p+=3*(2**((packed&7)+1));
      need(1);const codeSize=bytes[p++];if(codeSize<2||codeSize>8)invalid();blocks();
      frames++;durationMs+=delay;delay=100;
      if(frames>300||frames*width*height>120000000)throw new Error('GIF quá dài hoặc nhiều khung hình. Hãy rút ngắn hoặc giảm kích thước ảnh.');
    }else invalid();
  }
  if(!ended||!frames)invalid();
  return {width,height,frames,durationMs};
}
export function safeImageName(name){
  const clean=basename(String(name||'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')).replace(/[. ]+$/g,'').trim();
  if(!clean||clean.length>150||clean==='.'||clean==='..')throw new Error('Tên ảnh không hợp lệ.');
  return clean;
}
export async function readLibraryImage(library,name){
  const safe=safeImageName(name),path=join(library,safe),info=await lstat(path);
  if(!info.isFile()||info.size>MAX_IMAGE_BYTES)throw new Error('Ảnh không hợp lệ hoặc vượt quá 30 MB.');
  const bytes=await readFile(path),mime=imageMime(safe,bytes);
  if(!mime)throw new Error('Chỉ nhận PNG, JPEG, WebP hoặc GIF hợp lệ.');
  return {name:safe,path,bytes,mime,size:bytes.length};
}
export function wallpaperInjection({data,mime,strength=35,enabled=true}){
  const restore=`(()=>{document.getElementById('codex-user-wallpaper')?.remove();delete document.documentElement.dataset.codexUserWallpaper;if(document.documentElement.__codexWallpaperURL)URL.revokeObjectURL(document.documentElement.__codexWallpaperURL);delete document.documentElement.__codexWallpaperURL;return true})()`;
  if(!enabled)return restore;
  const opacity=Math.max(0,Math.min(75,Number(strength)||0));
  if(opacity===0)return restore;
  const css=`html[data-codex-user-wallpaper]{--codex-wallpaper-wash:${(100-opacity)/100};--app-color-background-surface:transparent!important;--app-color-background-surface-under:transparent!important;--app-color-background-editor-opaque:rgb(18 18 22 / .36)!important;--app-color-background-card:rgb(18 18 22 / .36)!important;--color-token-side-bar-background:transparent!important;--color-token-bg-primary:transparent!important;--color-token-main-surface-primary:transparent!important;--color-surface:transparent!important;--color-surface-secondary:transparent!important;--color-surface-tertiary:rgb(18 18 22 / .36)!important;--chat-background-color:transparent!important;--composer-background-color:rgb(18 18 22 / .72)!important;--app-shell-panel-background:transparent!important;--app-shell-tab-background:rgb(18 18 22 / .36)!important;background:#15151a!important}
html[data-codex-user-wallpaper] body{background-color:#15151a!important;background-image:linear-gradient(rgb(18 18 22 / var(--codex-wallpaper-wash)),rgb(18 18 22 / var(--codex-wallpaper-wash))),var(--codex-wallpaper-image)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;background-attachment:fixed!important}
html[data-codex-user-wallpaper] :is(#root,[data-app-shell-frame],[data-app-shell-page-surface=true]){background:transparent!important}
html[data-codex-user-wallpaper] .app-shell-left-panel{background:rgb(18 18 22 / .18)!important}`;
  return `(()=>{const root=document.documentElement,source=atob(${JSON.stringify(data)}),bytes=new Uint8Array(source.length);for(let i=0;i<source.length;i++)bytes[i]=source.charCodeAt(i);const next=URL.createObjectURL(new Blob([bytes],{type:${JSON.stringify(mime)}}));const previous=root.__codexWallpaperURL;root.__codexWallpaperURL=next;root.dataset.codexUserWallpaper='';let style=document.getElementById('codex-user-wallpaper');if(!style){style=document.createElement('style');style.id='codex-user-wallpaper';document.head.append(style)}style.textContent=${JSON.stringify(css)}+':root{--codex-wallpaper-image:url('+JSON.stringify(next)+')}';if(previous)URL.revokeObjectURL(previous);return true})()`;
}
export async function readWallpaperConfig(root){
  try{const value=JSON.parse(await readFile(join(root,'settings.json'),'utf8'));
    if(!value||typeof value!=='object')return {enabled:false,strength:35};
    const name=typeof value.renderedName==='string'?value.renderedName:value.name;
    const strength=Number(value.strength);
    return {enabled:value.enabled===true,name:typeof name==='string'?safeImageName(name):'',strength:Math.max(0,Math.min(75,Number.isFinite(strength)?strength:35))};
  }catch{return {enabled:false,strength:35};}
}
export function wallpaperFile(root,name){return join(root,'images',safeImageName(name));}
