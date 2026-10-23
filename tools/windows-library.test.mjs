import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startLibrary} from '../windows/server.mjs';
import {readSettings} from '../windows/settings.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const jpeg=Buffer.from([255,216,255,217]),data=jpeg.toString('base64');
async function fixture(run){
  const root=await mkdtemp(join(tmpdir(),'codex-library-'));let active;
  const restart=async()=>{
    if(active)await new Promise(resolve=>active.server.close(resolve));active=await startLibrary({root,open:false});
    const url=new URL(active.url),headers={Authorization:`Bearer ${url.searchParams.get('token')}`,'Content-Type':'application/json'};
    return {post:(path,payload)=>fetch(url.origin+path,{method:'POST',headers,body:JSON.stringify(payload)}),list:async()=>(await fetch(url.origin+'/api/images',{headers})).json()};
  };
  try{await run(root,await restart(),restart);}finally{if(active)await new Promise(resolve=>active.server.close(resolve));await rm(root,{recursive:true,force:true});}
}

test('duplicate detection compares bytes across names and serializes simultaneous uploads',async()=>fixture(async(root,{post,list},restart)=>{
  const responses=await Promise.all(Array.from({length:6},(_,index)=>post('/api/import',{name:`renamed-${index}.jpg`,data})));
  assert.equal(responses.filter(response=>response.status===201).length,1);
  for(const response of responses.filter(response=>response.status!==201)){
    assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'DUPLICATE_MEDIA');assert.equal(body.duplicates.length,1);
  }
  const original=(await list()).images[0];
  assert.equal((await post('/api/import',{name:original.name,data,keepDuplicate:true})).status,201);
  assert.equal((await list()).images.length,2,'explicit keep adds a uniquely named copy');
  assert.equal((await post('/api/import',{name:'different.jpg',data:Buffer.from([255,216,255,218]).toString('base64')})).status,201,'same size does not imply identical content');
  const fresh=await restart();assert.equal((await fresh.post('/api/import',{name:'again.jpg',data})).status,409,'duplicates are detected after service restart');
  assert.equal((await readdir(join(root,'images'))).length,3,'skip does not write a file');
}));

test('broken files remain listed and can be deleted, undone and recovered after restart',async()=>fixture(async(root,{post,list},restart)=>{
  for(let index=0;index<12;index++)await writeFile(join(root,'images',`broken-${index}.png`),'broken');
  assert.equal((await list()).warnings.length,12,'no hidden errors after the tenth file');
  const response=await post('/api/delete',{kind:'image',name:'broken-0.png'});assert.equal(response.status,200);const {deleted}=await response.json();assert.equal(deleted.active,false);
  assert.equal((await list()).warnings.length,11);assert.equal(await readFile(join(root,'trash',deleted.id,'original'),'utf8'),'broken');
  const fresh=await restart();assert.equal((await fresh.list()).lastDeleted.id,deleted.id,'undo remains available in the UI after restart');await writeFile(join(root,'images','broken-0.png'),'new content');
  const undone=await fresh.post('/api/undo-delete',{id:deleted.id});assert.equal(undone.status,200);assert.equal((await undone.json()).name,'broken-0-1.png');
  assert.equal(await readFile(join(root,'images','broken-0.png'),'utf8'),'new content');assert.equal(await readFile(join(root,'images','broken-0-1.png'),'utf8'),'broken');
  assert.equal((await fresh.list()).lastDeleted,null);
  assert.equal((await fresh.post('/api/undo-delete',{id:deleted.id})).status,400,'cannot restore twice');
}));

test('files with names longer than the import limit can still be removed from the errors list',async()=>fixture(async(root,{post,list})=>{
  const name='a'.repeat(160)+'.jpg';await writeFile(join(root,'images',name),'broken');assert.equal((await list()).warnings[0].name,name);
  const removed=await post('/api/delete',{kind:'image',name});assert.equal(removed.status,200);assert.equal((await list()).warnings.length,0);
  assert.equal((await post('/api/undo-delete',{id:(await removed.json()).deleted.id})).status,200);
}));

test('keeping a duplicate with the maximum filename length still produces a readable library entry',async()=>fixture(async(root,{post,list})=>{
  const name='a'.repeat(146)+'.jpg';assert.equal(name.length,150);
  assert.equal((await post('/api/import',{name,data})).status,201);
  const kept=await post('/api/import',{name,data,keepDuplicate:true});assert.equal(kept.status,201);assert.ok((await kept.json()).name.length<=150);
  assert.equal((await list()).images.length,2);assert.equal((await list()).warnings.length,0);
}));

test('Windows file locks are retried and a failed delete restores the active wallpaper',{skip:process.platform!=='win32'},async()=>fixture(async(root,{post,list})=>{
  await post('/api/import',{name:'locked.jpg',data});await post('/api/apply',{kind:'image',name:'locked.jpg',optimized:data,strength:23});
  const before=await readSettings(root),path=join(root,'images','locked.jpg').replaceAll("'","''");let child;
  try{
    child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$s=[IO.File]::Open('${path}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);try{[Console]::WriteLine('locked');[Console]::Out.Flush();Start-Sleep -Seconds 30}finally{$s.Dispose()}`],{windowsHide:true});
    const [output]=await once(child.stdout,'data');assert.match(output.toString(),/locked/);
    const failed=await post('/api/delete',{kind:'image',name:'locked.jpg'});assert.equal(failed.status,400);assert.deepEqual(await readSettings(root),before);assert.deepEqual(await readFile(join(root,'images','locked.jpg')),jpeg);assert.equal((await list()).lastDeleted,null);
  }finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
  const removed=await post('/api/delete',{kind:'image',name:'locked.jpg'});assert.equal(removed.status,200);assert.equal((await readSettings(root)).enabled,false);
}));

test('delete deactivates only the current wallpaper and rejects paths, internal files and unknown kinds',async()=>fixture(async(root,{post,list})=>{
  await post('/api/import',{name:'active.jpg',data});await post('/api/import',{name:'other.jpg',data,keepDuplicate:true});
  await post('/api/apply',{kind:'image',name:'active.jpg',optimized:data,strength:23,crop:{zoom:2,x:.2}});
  const before=await readSettings(root);
  assert.equal((await post('/api/delete',{kind:'image',name:'other.jpg'})).status,200);assert.deepEqual(await readSettings(root),before,'deleting an unused file preserves the wallpaper');
  for(const payload of [{kind:'other',name:'active.jpg'},{kind:'image',name:'../active.jpg'},{kind:'image',name:'..\\active.jpg'},{kind:'image',name:before.renderedName},{kind:'image',name:'active.jpg '}])assert.equal((await post('/api/delete',payload)).status,400);
  assert.equal((await list()).images.length,1);
  const response=await post('/api/delete',{kind:'image',name:'active.jpg'});assert.equal(response.status,200);const {deleted}=await response.json();assert.equal(deleted.active,true);
  const settings=await readSettings(root);assert.equal(settings.enabled,false);assert.equal(settings.strength,23);assert.deepEqual(settings.crop,before.crop);
  assert.equal((await post('/api/undo-delete',{id:'../images'})).status,400);
  assert.equal((await post('/api/undo-delete',{id:deleted.id})).status,200);assert.equal((await readSettings(root)).enabled,false,'undo restores the file without unexpectedly enabling the wallpaper');
  assert.deepEqual(await readFile(join(root,'images','active.jpg')),jpeg);
}));
