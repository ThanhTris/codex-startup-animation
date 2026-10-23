import {gifInfo,readLibraryImage} from './wallpaper.mjs';
import {join} from 'node:path';

export const mediaKind=value=>value==='gif'?'gif':'image';
export const mediaFolder=(root,kind)=>join(root,mediaKind(kind)==='gif'?'gifs':'images');
export async function readMedia(root,kind,name){
  kind=mediaKind(kind);
  const image=await readLibraryImage(mediaFolder(root,kind),name);
  if((image.mime==='image/gif')!==(kind==='gif'))throw new Error('Loại ảnh không đúng thư mục.');
  const info=kind==='gif'?gifInfo(image.bytes):{};
  return {...image,...info,kind,id:`${kind}:${image.name}`,url:`/${kind==='gif'?'gifs':'images'}/${encodeURIComponent(image.name)}`};
}
