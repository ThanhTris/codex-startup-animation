import {createServer} from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile,open,stat,unlink} from 'node:fs/promises';
import {extname,join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {appendFileSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {imageMime,gifInfo,MAX_IMAGE_BYTES,safeImageName} from './wallpaper.mjs';
import {readRuntime} from './runtime.mjs';
import {mediaKind,mediaFolder,readMedia} from './media.mjs';
import {readSettings,writeSettings} from './settings.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const html=await readFile(join(here,'manager.html'));
const script=await readFile(join(here,'manager.js'));
const css=await readFile(join(here,'manager.css'));
const MAX_BODY=Math.ceil(MAX_IMAGE_BYTES*1.42)+1024;
function reply(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(body):body);
}
async function bodyJSON(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error('Dung lượng ảnh vượt giới hạn.'),{status:413});chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function openBrowser(url){
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();
}
export async function startLibrary({root,open:shouldOpen=true}={}){
  if(!root)throw new Error('Thiếu thư mục dữ liệu.');
  root=resolve(root);const library=join(root,'images');await mkdir(library,{recursive:true});await mkdir(join(root,'gifs'),{recursive:true});
  const token=randomBytes(24).toString('hex'),mediaCache=new Map();let server,mutation=Promise.resolve();
  const mutate=action=>{const pending=mutation.then(action);mutation=pending.catch(()=>{});return pending;};
  const cleanRendered=async previous=>{
    if(previous.kind!=='gif'&&typeof previous.renderedName==='string'&&/^\.codex-wallpaper-[\da-f-]+\.jpg$/.test(previous.renderedName))await unlink(join(library,previous.renderedName)).catch(()=>{});
  };
  server=createServer(async(req,res)=>{
    const host=req.headers.host||'';
    if(!/^127\.0\.0\.1:\d+$/.test(host)&&!/^localhost:\d+$/.test(host)){reply(res,403,{error:'Chỉ cho phép kết nối cục bộ.'});return;}
    let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{reply(res,400,{error:'Địa chỉ yêu cầu không hợp lệ.'});return;}
    if(req.method==='GET'&&url.pathname==='/'){
      if(url.searchParams.get('token')!==token){reply(res,403,{error:'Phiên thư viện không hợp lệ.'});return;}
      reply(res,200,html.toString().replaceAll('__TOKEN__',token),'text/html; charset=utf-8');return;
    }
    const supplied=(req.headers.authorization||'').replace(/^Bearer /,'')||url.searchParams.get('token')||'';
    const a=Buffer.from(supplied),b=Buffer.from(token);
    if(a.length!==b.length||!timingSafeEqual(a,b)){reply(res,403,{error:'Không được phép.'});return;}
    const origin=req.headers.origin;
    if(origin&&origin!==`http://${host}`){reply(res,403,{error:'Nguồn yêu cầu không hợp lệ.'});return;}
    try{
      if(req.method==='GET'&&url.pathname==='/api/health'){
        reply(res,200,{app:'CodexWallpaper',pid:process.pid});return;
      }
      if(req.method==='GET'&&url.pathname==='/api/runtime'){
        const state=await readRuntime(root);
        reply(res,200,state);return;
      }
      if(req.method==='POST'&&url.pathname==='/api/launch-codex'){
        const fd=openSync(join(root,'launcher.log'),'a');
        try{
          const child=spawn(join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(here,'start-codex.ps1'),'-Root',root],{windowsHide:true,stdio:['ignore',fd,fd]});
          child.on('spawn',()=>appendFileSync(join(root,'service-events.log'),`${new Date().toISOString()} launch-helper pid=${child.pid}\n`));
          child.on('exit',(code,signal)=>appendFileSync(join(root,'service-events.log'),`${new Date().toISOString()} helper-exit code=${code} signal=${signal}\n`));
          child.on('error',error=>appendFileSync(join(root,'launcher.log'),error.stack+'\n'));child.unref();
        }finally{closeSync(fd);}
        reply(res,202,{ok:true});return;
      }
      if(req.method==='GET'&&url.pathname==='/manager.js'){
        reply(res,200,script,'text/javascript; charset=utf-8');return;
      }
      if(req.method==='GET'&&url.pathname==='/manager.css'){
        reply(res,200,css,'text/css; charset=utf-8');return;
      }
      if(req.method==='GET'&&url.pathname==='/api/images'){
        const entries=[],warnings=[],present=new Set();
        for(const kind of ['image','gif'])for(const entry of await readdir(mediaFolder(root,kind),{withFileTypes:true})){
          if(!entry.isFile()||entry.name.startsWith('.')||!(/\.(png|jpe?g|webp|gif)$/i).test(entry.name))continue;
          try{
            const path=join(mediaFolder(root,kind),entry.name),details=await stat(path),key=`${details.size}:${details.mtimeMs}`;present.add(path);
            if(details.size>MAX_IMAGE_BYTES)throw new Error('Vượt giới hạn 30 MB.');
            const cached=mediaCache.get(path);
            if(cached?.key===key){entries.push(cached.image);continue;}
            const {bytes,path:ignored,...metadata}=await readMedia(root,kind,entry.name),image={...metadata,revision:key};mediaCache.set(path,{key,image});entries.push(image);
          }catch(error){warnings.push({name:entry.name,kind,error:error.message});}
        }
        for(const path of mediaCache.keys())if(!present.has(path))mediaCache.delete(path);
        reply(res,200,{images:entries.sort((x,y)=>x.name.localeCompare(y.name)),warnings:warnings.slice(0,10)});return;
      }
      if(req.method==='GET'&&url.pathname==='/api/settings'){
        const value=await readSettings(root);
        const strength=Number(value.strength);
        reply(res,200,{enabled:value.enabled===true,name:typeof value.name==='string'?value.name:'',kind:mediaKind(value.kind),paused:value.paused===true,strength:Math.max(0,Math.min(75,Number.isFinite(strength)?strength:35))});return;
      }
      if(req.method==='GET'&&(url.pathname.startsWith('/images/')||url.pathname.startsWith('/gifs/'))){
        const kind=url.pathname.startsWith('/gifs/')?'gif':'image',name=safeImageName(decodeURIComponent(url.pathname.slice(kind==='gif'?6:8))),image=await readMedia(root,kind,name);
        res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(image.bytes);return;
      }
      if(req.method==='POST'&&url.pathname==='/api/import'){
        const data=await bodyJSON(req),name=safeImageName(data.name),bytes=Buffer.from(String(data.data||''),'base64');
        if(!bytes.length||bytes.length>MAX_IMAGE_BYTES||bytes.toString('base64').replace(/=+$/,'')!==String(data.data||'').replace(/=+$/,''))throw Object.assign(new Error('Ảnh phải nhỏ hơn 30 MB.'),{status:400});
        const mime=imageMime(name,bytes),kind=mime==='image/gif'?'gif':'image',folder=mediaFolder(root,kind);
        if(!mime)throw Object.assign(new Error('Chỉ nhận PNG, JPEG, WebP hoặc GIF hợp lệ.'),{status:400});
        if(kind==='gif')gifInfo(bytes);
        let target=name,index=1,file;
        while(true){try{file=await open(join(folder,target),'wx');break;}catch(error){if(error.code!=='EEXIST')throw error;target=`${name.replace(/(\.[^.]+)$/,'')}-${index++}${extname(name)}`;}}
        try{try{await file.writeFile(bytes);}finally{await file.close();}}catch(error){await unlink(join(folder,target)).catch(()=>{});throw error;}
        reply(res,201,{name:target,kind,id:`${kind}:${target}`});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/apply'){
        const data=await bodyJSON(req);
        const settings=await mutate(async()=>{
        const kind=mediaKind(data.kind),name=safeImageName(data.name),image=await readMedia(root,kind,name);
        const optimized=kind==='gif'?null:Buffer.from(String(data.optimized||''),'base64');
        if(kind!=='gif'&&(!optimized.length||optimized.length>MAX_IMAGE_BYTES||imageMime('wallpaper.jpg',optimized)!=='image/jpeg'))throw Object.assign(new Error('Không thể tối ưu ảnh đã chọn.'),{status:400});
        const previous=await readSettings(root);
        const renderedName=kind==='gif'?name:`.codex-wallpaper-${randomUUID()}.jpg`;
        const requestedStrength=Number(data.strength),strength=Math.max(0,Math.min(75,Math.round(Number.isFinite(requestedStrength)?requestedStrength:35)));
        const settings={version:2,revision:randomUUID(),enabled:true,kind,name:image.name,renderedName,strength,paused:kind==='gif'&&data.paused===true};
        try{if(optimized)await writeFile(join(library,renderedName),optimized,{flag:'wx'});await writeSettings(root,settings);}catch(error){if(optimized)await unlink(join(library,renderedName)).catch(()=>{});throw error;}
        await cleanRendered(previous);return settings;
        });
        reply(res,200,{ok:true,settings});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/restore'){
        await mutate(async()=>{
          const previous=await readSettings(root).catch(error=>{if(error instanceof SyntaxError||error.code==='INVALID_SETTINGS')return {};throw error;});
          await writeSettings(root,{version:1,enabled:false,strength:35});await cleanRendered(previous);
        });
        reply(res,200,{ok:true});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/open-folder'){
        const data=await bodyJSON(req);const child=spawn('explorer.exe',[mediaFolder(root,data.kind)],{stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();reply(res,200,{ok:true});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/shutdown'){
        reply(res,200,{ok:true});setTimeout(()=>server.close(),50).unref();return;
      }
      reply(res,404,{error:'Không tìm thấy.'});
    }catch(error){reply(res,error.status||400,{error:error.message||'Không thể xử lý yêu cầu.'});}
  });
  await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolveListen);});
  const address=server.address(),url=`http://127.0.0.1:${address.port}/?token=${token}`;
  await writeFile(join(root,'instance.json'),JSON.stringify({pid:process.pid,url}),{mode:0o600});
  if(shouldOpen)openBrowser(url);
  return {server,url,port:address.port,root};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--root'),root=index>=0?process.argv[index+1]:undefined;
  if(!root)throw new Error('Cần truyền --root.');
  try{await startLibrary({root,open:!process.argv.includes('--no-open')});}
  catch(error){appendFileSync(join(root,'launcher.log'),new Date().toISOString()+' '+error.stack+'\n');process.exitCode=1;}
}
