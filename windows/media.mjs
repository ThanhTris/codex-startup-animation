import {gifInfo,readLibraryImage} from './wallpaper.mjs';
import {join} from 'node:path';
import {readVideo} from './video.mjs';

export const mediaKind=value=>value==='video'?'video':value==='gif'?'gif':'image';
export const mediaFolder=(root,kind)=>join(root,({video:'videos',gif:'gifs',image:'images'})[mediaKind(kind)]);
export async function readMedia(root,kind,name){
  kind=mediaKind(kind);
  if(kind==='video'){const video=await readVideo(root,name);return {...video,kind,id:`video:${video.name}`,url:`/videos/${encodeURIComponent(video.name)}`};}
  const image=await readLibraryImage(mediaFolder(root,kind),name);
  if((image.mime==='image/gif')!==(kind==='gif'))throw new Error('Loại ảnh không đúng thư mục.');
  const info=kind==='gif'?gifInfo(image.bytes):{};
  return {...image,...info,kind,id:`${kind}:${image.name}`,url:`/${kind==='gif'?'gifs':'images'}/${encodeURIComponent(image.name)}`};
}
