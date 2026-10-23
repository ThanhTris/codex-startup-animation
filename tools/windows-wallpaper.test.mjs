import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readdir,rm,readFile,writeFile,rename,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {imageMime,gifInfo,safeImageName,wallpaperInjection,readWallpaperConfig} from '../windows/wallpaper.mjs';
import {startLibrary} from '../windows/server.mjs';
import {readRuntime} from '../windows/runtime.mjs';
import {readSettings,writeSettings} from '../windows/settings.mjs';
const gif=Buffer.from('R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAGQAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBGQABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7','base64');

test('concurrent imports and appearance changes preserve the final image without orphan files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-concurrent-')),active=await startLibrary({root,open:false});
  try{
    const url=new URL(active.url),headers={Authorization:`Bearer ${url.searchParams.get('token')}`,'Content-Type':'application/json'},jpeg=Buffer.from([255,216,255,217]).toString('base64');
    const post=(path,data)=>fetch(url.origin+path,{method:'POST',headers,body:JSON.stringify(data)});
    const imports=await Promise.all(Array.from({length:8},()=>post('/api/import',{name:'same.jpg',data:jpeg})));
    for(const response of imports)assert.equal(response.status,201);
    const names=await Promise.all(imports.map(async response=>(await response.json()).name));assert.equal(new Set(names).size,8);
    const mutations=await Promise.all(Array.from({length:16},(_,index)=>index%3===0?post('/api/restore',{}):post('/api/apply',{name:names[index%8],optimized:jpeg,strength:index})));
    for(const response of mutations)assert.equal(response.status,200);
    const settings=await readSettings(root),files=await readdir(join(root,'images')),rendered=files.filter(name=>name.startsWith('.codex-wallpaper-'));
    assert.equal(rendered.length,settings.enabled?1:0);if(settings.enabled)assert.ok(files.includes(settings.renderedName));
    const before=await(await fetch(url.origin+'/api/images',{headers})).json(),file=join(root,'images',names[0]);
    await utimes(file,new Date(),new Date(Date.now()+2000));
    const after=await(await fetch(url.origin+'/api/images',{headers})).json();
    assert.notEqual(before.images.find(image=>image.name===names[0]).revision,after.images.find(image=>image.name===names[0]).revision,'same-size replacements invalidate previews');
    await writeFile(join(root,'settings.json'),'{');
    const failed=await post('/api/apply',{name:names[0],optimized:jpeg,strength:20});assert.equal(failed.status,400);
    assert.equal(await readFile(join(root,'settings.json'),'utf8'),'{','bad existing config is not silently overwritten');
    assert.deepEqual((await readdir(join(root,'images'))).sort(),files.sort());
    assert.equal((await post('/api/restore',{})).status,200,'restore can recover from damaged JSON');assert.equal((await readSettings(root)).enabled,false);
    assert.equal((await post('/api/apply',{name:names[0],optimized:jpeg,strength:20})).status,200,'failed mutation does not block later requests');
  }finally{await new Promise(resolve=>active.server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test('failed atomic settings replacement cleans its temporary file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-settings-'));
  try{
    await mkdir(join(root,'settings.json'));
    await assert.rejects(writeSettings(root,{enabled:true}));
    assert.deepEqual(await readdir(root),['settings.json']);
    await rm(join(root,'settings.json'),{recursive:true});
    await writeSettings(root,{enabled:false});assert.equal((await readSettings(root)).enabled,false);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('atomic settings write retries a brief Windows sharing lock',{skip:process.platform!=='win32'},async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-sharing-'));let child;
  try{
    await writeSettings(root,{enabled:false});
    const path=join(root,'settings.json').replaceAll("'","''");
    child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$s=[IO.File]::Open('${path}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);try{[Console]::WriteLine('locked');[Console]::Out.Flush();Start-Sleep -Milliseconds 180}finally{$s.Dispose()}`],{windowsHide:true});
    const exited=once(child,'exit');
    const [output]=await once(child.stdout,'data');assert.match(output.toString(),/locked/);
    await writeSettings(root,{enabled:true,name:'new.jpg'});
    const [code]=await exited;assert.equal(code,0);assert.equal((await readSettings(root)).name,'new.jpg');
    assert.deepEqual(await readdir(root),['settings.json']);
  }finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit');}await rm(root,{recursive:true,force:true});}
});

test('GIF metadata rejects incomplete files and excessive decode work',()=>{
  assert.equal(imageMime('loop.gif',gif),'image/gif');assert.deepEqual(gifInfo(gif),{width:4,height:4,frames:2,durationMs:500});
  assert.throws(()=>gifInfo(gif.subarray(0,gif.length-2)),/GIF/);
  const huge=Buffer.from(gif);huge.writeUInt16LE(4096,6);huge.writeUInt16LE(4096,8);assert.throws(()=>gifInfo(huge),/megapixel/);
});

test('GIF folder is listed and animated bytes survive apply, restart and restore',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-gif-'));let active=await startLibrary({root,open:false});
  try{
    await writeFile(join(root,'gifs','mine.gif'),gif);
    let url=new URL(active.url),headers={Authorization:`Bearer ${url.searchParams.get('token')}`,'Content-Type':'application/json'};
    const page=await fetch(active.url);assert.match(page.headers.get('content-security-policy'),/img-src 'self' blob:/);
    const items=await (await fetch(url.origin+'/api/images',{headers})).json();assert.equal(items.images[0].id,'gif:mine.gif');assert.equal(items.images[0].frames,2);
    assert.deepEqual(Buffer.from(await (await fetch(url.origin+items.images[0].url,{headers})).arrayBuffer()),gif);
    const applied=await fetch(url.origin+'/api/apply',{method:'POST',headers,body:JSON.stringify({name:'mine.gif',kind:'gif',strength:20,paused:true})});assert.equal(applied.status,200);
    const settings=JSON.parse(await readFile(join(root,'settings.json'),'utf8'));assert.equal(settings.kind,'gif');assert.equal(settings.paused,true);assert.equal(settings.renderedName,'mine.gif');assert.deepEqual(await readFile(join(root,'gifs','mine.gif')),gif);
    await fetch(url.origin+'/api/apply',{method:'POST',headers,body:JSON.stringify({name:'mine.gif',kind:'gif',strength:20,paused:true})});
    assert.notEqual((await readSettings(root)).revision,settings.revision,'applying an overwritten GIF with the same filename forces the native decoder to reload');
    await new Promise(resolve=>active.server.close(resolve));active=await startLibrary({root,open:false});url=new URL(active.url);headers={Authorization:`Bearer ${url.searchParams.get('token')}`,'Content-Type':'application/json'};
    const fresh=await(await fetch(url.origin+'/api/settings',{headers})).json();assert.equal(fresh.kind,'gif');assert.equal(fresh.name,'mine.gif');assert.equal(fresh.paused,true);
    const bad=await fetch(url.origin+'/api/import',{method:'POST',headers,body:JSON.stringify({name:'bad.gif',data:gif.subarray(0,20).toString('base64')})});assert.equal(bad.status,400);
    assert.equal((await fetch(url.origin+'/api/restore',{method:'POST',headers})).status,200);assert.deepEqual(await readFile(join(root,'gifs','mine.gif')),gif);
  }finally{await new Promise(resolve=>active.server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test('overlay runtime distinguishes a live renderer from a stale or stopped one',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-overlay-runtime-'));
  try{
    await writeFile(join(root,'integration.json'),JSON.stringify({mode:'overlay'}));
    const now=Date.now(),state={mode:'overlay',status:'applied',pid:123,updatedAt:new Date(now).toISOString()};
    await writeFile(join(root,'overlay-state.json'),JSON.stringify(state));
    assert.equal((await readRuntime(root,{now,alive:()=>true})).status,'applied');
    await rename(join(root,'overlay-state.json'),join(root,'overlay-state.hold'));
    const replacing=readRuntime(root,{now,alive:()=>true});
    await new Promise(resolve=>setTimeout(resolve,5));
    await rename(join(root,'overlay-state.hold'),join(root,'overlay-state.json'));
    assert.equal((await replacing).status,'applied','a transient file replacement must not report a stopped renderer');
    assert.equal((await readRuntime(root,{now,alive:()=>false})).status,'error');
    assert.equal((await readRuntime(root,{now:now+9000,alive:()=>true})).status,'error');
    await writeFile(join(root,'overlay-state.json'),JSON.stringify({...state,updatedAt:'invalid'}));
    assert.equal((await readRuntime(root,{now,alive:()=>true})).status,'error');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('only accepts PNG, JPEG and WebP bytes that match their filename',()=>{
  assert.equal(imageMime('snow.png',Buffer.from([137,80,78,71,13,10,26,10])), 'image/png');
  assert.equal(imageMime('photo.jpg',Buffer.from([255,216,255,0])), 'image/jpeg');
  assert.equal(imageMime('photo.webp',Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(imageMime('photo.png',Buffer.from('not an image')),null);
  assert.equal(imageMime('photo.svg',Buffer.from('<svg/>')),null);
});

test('library can restart with a fresh session and retains saved user settings',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-wallpaper-restart-'));
  let active=await startLibrary({root,open:false});
  try{
    const previousURL=active.url;
    const instance=JSON.parse(await readFile(join(root,'instance.json'),'utf8'));
    assert.equal(instance.url,active.url);
    const first=new URL(active.url),headers={Authorization:`Bearer ${first.searchParams.get('token')}`,'Content-Type':'application/json'};
    const jpeg=Buffer.from([255,216,255,217]).toString('base64');
    assert.equal((await fetch(first.origin+'/api/import',{method:'POST',headers,body:JSON.stringify({name:'mine.jpg',data:jpeg})})).status,201);
    assert.equal((await fetch(first.origin+'/api/apply',{method:'POST',headers,body:JSON.stringify({name:'mine.jpg',optimized:jpeg,strength:23})})).status,200);
    await new Promise(resolve=>active.server.close(resolve));
    active=await startLibrary({root,open:false});
    assert.notEqual(active.url,previousURL);
    const fresh=new URL(active.url),newHeaders={Authorization:`Bearer ${fresh.searchParams.get('token')}`};
    assert.equal((await fetch(active.url)).status,200);
    assert.equal((await fetch(active.url)).status,200); // Refresh uses the same authenticated URL.
    assert.equal((await fetch(fresh.origin+'/api/health',{headers})).status,403);
    const health=await fetch(fresh.origin+'/api/health',{headers:newHeaders});
    assert.equal((await health.json()).app,'CodexWallpaper');
    const settings=await (await fetch(fresh.origin+'/api/settings',{headers:newHeaders})).json();
    assert.equal(settings.name,'mine.jpg');assert.equal(settings.strength,23);assert.equal(settings.enabled,true);
  }finally{await new Promise(resolve=>active.server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test('image names cannot escape the library folder',()=>{
  assert.equal(safeImageName('..\\..\\private.png'),'.._.._private.png');
  assert.throws(()=>safeImageName(''));assert.throws(()=>safeImageName('.'));assert.throws(()=>safeImageName('x'.repeat(151)+'.png'));
});

test('wallpaper injection is an isolated reversible style and clamps opacity',()=>{
  const source=wallpaperInjection({data:'YWJj',mime:'image/jpeg',strength:99});
  assert.match(source,/createObjectURL/);assert.match(source,/codex-user-wallpaper/);assert.match(source,/--codex-wallpaper-wash:0\.25/);
  assert.doesNotThrow(()=>new Function(source));
  assert.match(wallpaperInjection({data:'YWJj',mime:'image/jpeg',strength:0}),/revokeObjectURL/);
  const restore=wallpaperInjection({enabled:false});assert.match(restore,/revokeObjectURL/);assert.match(restore,/delete document\.documentElement\.dataset\.codexUserWallpaper/);
});

test('local library authenticates requests, imports user images, applies and restores',async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-wallpaper-'));await mkdir(join(root,'images'));
  const {server,url}=await startLibrary({root,open:false});
  try{
    const address=server.address(),token=new URL(url).searchParams.get('token'),base=`http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/api/images`)).status,403);
    const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),new RegExp(token));
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    const png=Buffer.from([137,80,78,71,13,10,26,10]);
    const imported=await fetch(`${base}/api/import`,{method:'POST',headers,body:JSON.stringify({name:'my wallpaper.png',data:png.toString('base64')})});
    assert.equal(imported.status,201);const {name}=await imported.json();
    const jpeg=Buffer.from([255,216,255,217]);
    const applied=await fetch(`${base}/api/apply`,{method:'POST',headers,body:JSON.stringify({name,optimized:jpeg.toString('base64'),strength:42})});
    assert.equal(applied.status,200);const settings=await readWallpaperConfig(root);assert.equal(settings.enabled,true);assert.equal(settings.strength,42);assert.match(settings.name,/^\.codex-wallpaper-.*\.jpg$/);
    assert.ok((await readdir(join(root,'images'))).includes(name));
    const hidden=await readdir(join(root,'images'));const zero=await fetch(`${base}/api/apply`,{method:'POST',headers,body:JSON.stringify({name,optimized:jpeg.toString('base64'),strength:0})});assert.equal(zero.status,200);assert.equal((await readWallpaperConfig(root)).strength,0);assert.equal((await readdir(join(root,'images'))).filter(file=>file.startsWith('.codex-wallpaper-')).length,1);assert.ok(hidden.includes(name));
    const restored=await fetch(`${base}/api/restore`,{method:'POST',headers});assert.equal(restored.status,200);assert.equal((await readWallpaperConfig(root)).enabled,false);
    assert.deepEqual((await readdir(join(root,'images'))),[name]);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
