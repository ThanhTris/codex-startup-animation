import {execFile as rawExec} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,stat,appendFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {readLibraryImage,readWallpaperConfig,wallpaperInjection} from './wallpaper.mjs';

const exec=promisify(rawExec),args=process.argv;
function option(name){const i=args.indexOf(name);return i<0?undefined:args[i+1];}
const port=Number(option('--port')),pid=Number(option('--pid')),packageRoot=resolve(option('--package')||''),dataRoot=resolve(option('--root')||'');
if(!Number.isInteger(port)||port<1||!Number.isInteger(pid)||!dataRoot||!packageRoot)throw new Error('Tham số chạy trợ giúp không hợp lệ.');
const logPath=join(dataRoot,'agent.log');
async function log(text){try{await appendFile(logPath,`${new Date().toISOString()} ${text}\n`);}catch{}}
async function runtimeState(status,message){try{const temporary=join(dataRoot,`state-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify({status,message,updatedAt:new Date().toISOString()}));await rename(temporary,join(dataRoot,'launch-state.json'));}catch{}}
function quote(value){return `'${String(value).replaceAll("'","''")}'`;}
function pageTarget(target){try{const url=new URL(target.url),route=url.searchParams.get('initialRoute')||'/';return target.type==='page'&&url.protocol==='app:'&&url.hostname==='-'&&url.pathname==='/index.html'&&!/avatar|quick.chat|detached|mini|popover|notification/i.test(route);}catch{return false;}}
function localSocket(value){const url=new URL(value);if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||Number(url.port)!==port||!url.pathname.startsWith('/devtools/page/')||url.username||url.password)throw new Error('Từ chối websocket không phải trang Codex cục bộ.');return url.href;}
async function verifyListener(){
  const ps=`$ErrorActionPreference='Stop';$launch=${pid};$root=${quote(packageRoot)};$tcp=Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort ${port} -ErrorAction SilentlyContinue|Select-Object -First 1;if(-not $tcp){@{ok=$false;reason='no-loopback-listener'}|ConvertTo-Json -Compress;exit};$all=@(Get-CimInstance Win32_Process);$byId=@{};foreach($p in $all){$byId[[int]$p.ProcessId]=$p};$proc=$byId[[int]$tcp.OwningProcess];$owned=$false;for($i=0;$i -lt 30 -and $proc;$i++){if([int]$proc.ProcessId -eq $launch){$owned=$true;break};$proc=$byId[[int]$proc.ParentProcessId]};$exe=$byId[[int]$tcp.OwningProcess].ExecutablePath;$valid=$false;if($exe -and $exe.StartsWith($root+'\\',[StringComparison]::OrdinalIgnoreCase) -and $owned){$sig=Get-AuthenticodeSignature -LiteralPath $exe -ErrorAction SilentlyContinue;$valid=$sig.Status -eq 'Valid' -and $sig.SignerCertificate.Subject -match 'OpenAI'};@{ok=$valid;pid=[int]$tcp.OwningProcess}|ConvertTo-Json -Compress`;
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{timeout:8000,windowsHide:true});
  const result=JSON.parse(stdout.trim());if(!result.ok)throw new Error('Cổng debug không thuộc tiến trình Codex đã ký của OpenAI.');
}
class CDP{
  constructor(url){this.socket=new WebSocket(url);this.serial=0;this.pending=new Map();this.listeners=new Map();
    this.socket.addEventListener('message',event=>{let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.id){const item=this.pending.get(message.id);if(!item)return;this.pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return;}
      for(const listener of this.listeners.get(message.method)||[])listener(message.params);
    });
    this.socket.addEventListener('close',()=>{for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(new Error('CDP connection closed'));}this.pending.clear();});
  }
  async ready(){await new Promise((resolveReady,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP connect timeout')),6000);this.socket.addEventListener('open',()=>{clearTimeout(timer);resolveReady();},{once:true});this.socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});});}
  on(name,callback){const list=this.listeners.get(name)||[];list.push(callback);this.listeners.set(name,list);}
  call(method,params={},timeout=10000){return new Promise((resolveCall,reject)=>{const id=++this.serial,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method} timeout`));},timeout);this.pending.set(id,{resolve:resolveCall,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  close(){this.socket.close();}
}
async function processAlive(){try{await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',`if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){exit 0}else{exit 1}`],{timeout:3000,windowsHide:true});return true;}catch{return false;}}
const connections=new Map();let lastConfig='';
let cachedSetting=null;
async function currentInjection(){
  const config=await readWallpaperConfig(dataRoot);
  if(!config.enabled||!config.name){const key=JSON.stringify(config);if(cachedSetting?.key===key)return cachedSetting;return cachedSetting={key,source:wallpaperInjection({enabled:false})};}
  const path=join(dataRoot,'images',config.name),details=await stat(path),key=JSON.stringify([config,details.size,details.mtimeMs]);
  if(cachedSetting?.key===key)return cachedSetting;
  const image=await readLibraryImage(join(dataRoot,'images'),config.name);
  return cachedSetting={key,source:wallpaperInjection({data:image.bytes.toString('base64'),mime:image.mime,strength:config.strength})};
}
async function inject(connection){
  try{const setting=await currentInjection();if(setting.key===connection.lastApplied)return;
    const result=await connection.client.call('Runtime.evaluate',{expression:setting.source,returnByValue:true,awaitPromise:true},20000);
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Không thể đặt hình nền.');
    connection.lastApplied=setting.key;await log('appearance-updated');await runtimeState('applied','Codex đã kết nối. Giao diện đã cập nhật theo cấu hình ảnh đã lưu.');
  }catch(error){await log(`apply-failed: ${error.message}`);await runtimeState('error',`Không áp dụng được hình nền: ${error.message}`);}
}
async function connectTarget(target){
  const old=connections.get(target.id);if(old&&old.url===target.webSocketDebuggerUrl&&old.client.socket.readyState===WebSocket.OPEN)return;
  old?.client.close();connections.delete(target.id);
  let client;
  try{client=new CDP(localSocket(target.webSocketDebuggerUrl));await client.ready();await client.call('Page.enable');await client.call('Runtime.enable');
    const connection={url:target.webSocketDebuggerUrl,client,lastApplied:''};connections.set(target.id,connection);
    client.on('Page.frameNavigated',frame=>{if(!frame.frame.parentId){connection.lastApplied='';void inject(connection);}});
    await inject(connection);
  }catch(error){client?.close();await log(`target-failed: ${error.message}`);}
}
async function updateTargets(){
  const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1500),redirect:'error'});
  if(!response.ok)throw new Error(`CDP target list returned ${response.status}`);
  const targets=await response.json();if(!Array.isArray(targets))throw new Error('Invalid CDP target list');
  const active=new Set(targets.filter(pageTarget).map(target=>target.id));
  for(const [id,connection]of connections)if(!active.has(id)){connection.client.close();connections.delete(id);}
  for(const target of targets)if(pageTarget(target))await connectTarget(target);
}
async function main(){
  let verified=false,nextVerification=0,deadline=Date.now()+45000;await log('agent-started');
  while(await processAlive()){
    try{if(!verified||Date.now()>=nextVerification){await verifyListener();verified=true;nextVerification=Date.now()+10000;}await updateTargets();
      const setting=await currentInjection();if(setting.key!==lastConfig){lastConfig=setting.key;for(const connection of connections.values())await inject(connection);}
    }catch(error){if(!verified&&Date.now()>deadline)throw new Error(`Không kết nối được Codex: ${error.message}`);await log(`watch-failed: ${error.message}`);}
    await new Promise(resolveWait=>setTimeout(resolveWait,1500));
  }
  for(const connection of connections.values())connection.client.close();
  await log('codex-exited');
  await runtimeState('stopped','Codex đã thoát. Bấm Mở Codex với hình nền để mở lại.');
}
process.on('SIGTERM',()=>{for(const connection of connections.values())connection.client.close();process.exit(0);});
main().catch(async error=>{await log(`agent-stopped: ${error.message}`);await runtimeState('error',error.message);process.exitCode=1;});
