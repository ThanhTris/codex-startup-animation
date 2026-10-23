import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,mkdir,readdir,readFile,writeFile,rename,unlink,rmdir} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {mediaFolder} from './media.mjs';
import {readSettings,writeSettings} from './settings.mjs';

export function libraryName(kind,name){
  if(!['image','gif','video'].includes(kind)||typeof name!=='string'||!name||name.length>255||name.startsWith('.')||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||!(/\.(png|jpe?g|webp|gif|mp4|m4v|webm|mov)$/i).test(name))throw new Error('Tệp thư viện không hợp lệ.');
  return name;
}
export async function fileHash(path){
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');
}
export async function findDuplicates(root,size,digest){
  const duplicates=[];
  for(const kind of ['image','gif','video'])for(const entry of await readdir(mediaFolder(root,kind),{withFileTypes:true})){
    if(!entry.isFile()||entry.name.startsWith('.')||!(/\.(png|jpe?g|webp|gif|mp4|m4v|webm|mov)$/i).test(entry.name))continue;
    const path=join(mediaFolder(root,kind),entry.name);
    try{const info=await lstat(path);if(info.isFile()&&info.size===size&&await fileHash(path)===digest)duplicates.push({kind,name:entry.name,id:`${kind}:${entry.name}`});}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return duplicates;
}
export function rejectDuplicates(duplicates){
  if(duplicates.length)throw Object.assign(new Error('Tệp này có nội dung trùng với tệp trong thư viện.'),{status:409,code:'DUPLICATE_MEDIA',duplicates});
}
export function copyName(name,index,limit=150){
  const extension=extname(name),suffix=`-${index}${extension}`;
  return name.slice(0,Math.min(name.length-extension.length,limit-suffix.length))+suffix;
}
async function moveFile(from,to){
  for(let attempt=0;;attempt++)try{await rename(from,to);return;}catch(error){
    if(!['EBUSY','EACCES','EPERM'].includes(error.code)||attempt>=12)throw error;
    await delay(50*(attempt+1));
  }
}
// A small manifest is written first so the original can be recovered even after a restart.
export async function deleteMedia(root,kind,name){
  libraryName(kind,name);const path=join(mediaFolder(root,kind),name),info=await lstat(path);
  if(!info.isFile())throw new Error('Chỉ xóa tệp trong thư viện.');
  const previous=await readSettings(root).catch(error=>{if(error instanceof SyntaxError||error.code==='INVALID_SETTINGS')return {};throw error;});
  const active=previous.enabled===true&&previous.name===name&&(previous.kind||'image')===kind;
  const id=randomUUID(),folder=join(root,'trash',id);await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'entry.json'),JSON.stringify({kind,name,deletedAt:new Date().toISOString()}),{flag:'wx'});
  let disabled=false;
  try{
    if(active){await writeSettings(root,{...previous,enabled:false,revision:randomUUID()});disabled=true;}
    await moveFile(path,join(folder,'original'));
  }catch(error){
    if(disabled)await writeSettings(root,previous);
    await unlink(join(folder,'entry.json')).catch(()=>{});await rmdir(folder).catch(()=>{});throw error;
  }
  return {id,name,kind,active};
}
export async function undoDelete(root,id){
  if(typeof id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))throw new Error('Mã hoàn tác không hợp lệ.');
  const folder=join(root,'trash',id),entry=JSON.parse(await readFile(join(folder,'entry.json'),'utf8'));
  const {kind}=entry,name=libraryName(kind,entry.name),source=join(folder,'original');
  if(!(await lstat(source)).isFile())throw new Error('Không còn tệp để hoàn tác.');
  // Never overwrite a file added while the original was in the trash.
  const {link}=await import('node:fs/promises');let target=name,index=1;
  while(true)try{await link(source,join(mediaFolder(root,kind),target));break;}catch(error){if(error.code!=='EEXIST')throw error;target=copyName(name,index++,255);}
  await unlink(source);await unlink(join(folder,'entry.json'));await rmdir(folder);
  return {name:target,kind,id:`${kind}:${target}`};
}
export async function lastDeleted(root){
  let entries;try{entries=await readdir(join(root,'trash'),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return null;throw error;}
  let last=null;
  for(const entry of entries){
    if(!entry.isDirectory()||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(entry.name))continue;
    try{const folder=join(root,'trash',entry.name),value=JSON.parse(await readFile(join(folder,'entry.json'),'utf8'));libraryName(value.kind,value.name);
      if(!(await lstat(join(folder,'original'))).isFile()||!Number.isFinite(Date.parse(value.deletedAt)))continue;
      if(!last||value.deletedAt>last.deletedAt)last={...value,id:entry.name};
    }catch{/* Ignore incomplete entries; the original remains available for manual recovery. */}
  }
  return last;
}
