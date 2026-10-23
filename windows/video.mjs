import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {lstat,open,readFile,mkdir,rename,unlink} from 'node:fs/promises';
import {join,isAbsolute,extname} from 'node:path';
import {safeImageName} from './wallpaper.mjs';
const exec=promisify(execFile);
export const MAX_VIDEO_BYTES=200*1024*1024;
const types={'.mp4':'video/mp4','.m4v':'video/mp4','.mov':'video/quicktime','.webm':'video/webm'};
export const videoMime=name=>types[extname(name).toLowerCase()];
export async function videoRuntime(root){
  try{const value=JSON.parse(await readFile(join(root,'video-runtime.json'),'utf8'));
    for(const key of ['ffmpeg','ffprobe'])if(!isAbsolute(value[key])||!(await lstat(value[key])).isFile())throw new Error();
    return value;
  }catch{throw new Error('Chưa có bộ giải mã video. Cài FFmpeg rồi chạy lại bộ cài Codex Wallpaper.');}
}
export async function videoFile(root,name){
  name=safeImageName(name);const path=join(root,'videos',name),info=await lstat(path),mime=videoMime(name);
  if(!mime||!info.isFile()||info.size<16||info.size>MAX_VIDEO_BYTES)throw new Error('Video không hợp lệ hoặc vượt 200 MB.');
  const handle=await open(path,'r'),head=Buffer.alloc(16);try{await handle.read(head,0,16,0);}finally{await handle.close();}
  if(mime==='video/webm'?!head.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])):head.toString('ascii',4,8)!=='ftyp')throw new Error('Nội dung không khớp định dạng video.');
  return {name,path,size:info.size,mime,revision:`${info.size}:${info.mtimeMs}`};
}
const pending=new Map();
export async function readVideo(root,name){
  const file=await videoFile(root,name),runtime=await videoRuntime(root);
  const key=createHash('sha256').update(file.name+':'+file.revision).digest('hex'),cache=join(root,'video-cache');
  await mkdir(cache,{recursive:true});
  const metadataPath=join(cache,key+'.json');
  try{const metadata=JSON.parse(await readFile(metadataPath,'utf8'));if(metadata.version===1&&(await lstat(join(cache,key+'.jpg'))).isFile())return {...file,...metadata,poster:`/video-posters/${key}.jpg`};}catch{}
  const taskKey=metadataPath;if(pending.has(taskKey))return pending.get(taskKey);
  const task=(async()=>{
    const {stdout}=await exec(runtime.ffprobe,['-v','error','-protocol_whitelist','file,pipe','-select_streams','v:0','-show_streams','-show_format','-of','json',file.path],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const value=JSON.parse(stdout),stream=value.streams?.[0];
    let width=Number(stream?.width),height=Number(stream?.height),duration=Number(value.format?.duration||stream?.duration);
    const rotation=Number(stream?.side_data_list?.find(item=>item.rotation!==undefined)?.rotation||stream?.tags?.rotate||0);
    if(Math.abs(rotation)%180===90)[width,height]=[height,width];
    if(!['h264','vp8','vp9','av1'].includes(stream?.codec_name)||!Number.isFinite(duration)||duration<=0||duration>600||!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>8294400)throw new Error('Video cần H.264/VP8/VP9/AV1, tối đa 10 phút và 8,3 megapixel. MP4 H.264 tương thích tốt nhất.');
    const scale=Math.min(1,1280/width,720/height),renderWidth=Math.max(2,Math.floor(width*scale/2)*2),renderHeight=Math.max(2,Math.floor(height*scale/2)*2);
    const temporary=join(cache,key+'-'+randomUUID()+'.jpg');
    try{
      await exec(runtime.ffmpeg,['-nostdin','-v','error','-threads','2','-protocol_whitelist','file,pipe','-i',file.path,'-map','0:v:0','-frames:v','1','-an','-vf',`scale=${renderWidth}:${renderHeight}`,'-q:v','3','-y',temporary],{windowsHide:true,timeout:30000,maxBuffer:1024*1024});
      await rename(temporary,join(cache,key+'.jpg'));
    }finally{await unlink(temporary).catch(()=>{});}
    const metadata={version:1,width,height,duration,renderWidth,renderHeight,codec:stream.codec_name};
    // Cache is expendable; a partial write is regenerated on the next read.
    const {writeFile}=await import('node:fs/promises');await writeFile(metadataPath,JSON.stringify(metadata));
    return {...file,...metadata,poster:`/video-posters/${key}.jpg`};
  })();pending.set(taskKey,task);try{return await task;}finally{pending.delete(taskKey);}
}
