import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startLibrary} from '../windows/server.mjs';
const exec=promisify(execFile);
let runtime;
try{runtime=process.env.CODEX_TEST_FFMPEG?{ffmpeg:process.env.CODEX_TEST_FFMPEG,ffprobe:process.env.CODEX_TEST_FFPROBE}:JSON.parse(await readFile(join(process.env.USERPROFILE||'','CodexWallpaper','video-runtime.json'),'utf8'));}catch{}
test('video uploads retain originals, range streaming, poster, crop and pause survive restart',{skip:!runtime&&'Cần FFmpeg: chạy bộ cài hoặc đặt CODEX_TEST_FFMPEG/CODEX_TEST_FFPROBE'},async()=>{
  const root=await mkdtemp(join(tmpdir(),'codex-video-'));let active;
  try{
    await writeFile(join(root,'video-runtime.json'),JSON.stringify(runtime));
    const fixture=join(root,'source.mp4');
    await exec(runtime.ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=96x64:rate=15','-t','0.6','-c:v','libx264','-pix_fmt','yuv420p',fixture],{windowsHide:true,timeout:15000});
    const bytes=await readFile(fixture);active=await startLibrary({root,open:false});
    let url=new URL(active.url),headers={Authorization:`Bearer ${url.searchParams.get('token')}`};
    const upload=await fetch(url.origin+'/api/import-video',{method:'POST',headers:{...headers,'X-File-Name':'my%20loop.mp4'},body:bytes});assert.equal(upload.status,201,await upload.clone().text());
    const imported=await upload.json();assert.equal(imported.kind,'video');assert.equal(imported.name,'my loop.mp4');
    assert.deepEqual(await readFile(join(root,'videos',imported.name)),bytes);
    const duplicate=await fetch(url.origin+'/api/import-video',{method:'POST',headers:{...headers,'X-File-Name':'renamed.mp4'},body:bytes});assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).code,'DUPLICATE_MEDIA');
    const kept=await fetch(url.origin+'/api/import-video',{method:'POST',headers:{...headers,'X-File-Name':'renamed.mp4','X-Keep-Duplicate':'true'},body:bytes});assert.equal(kept.status,201);
    const listed=await(await fetch(url.origin+'/api/images',{headers})).json(),video=listed.images.find(item=>item.name===imported.name);
    assert.equal(video.kind,'video');assert.equal(video.renderWidth,96);assert.equal(video.renderHeight,64);assert.ok(video.duration>0);
    const poster=await fetch(url.origin+video.poster,{headers});assert.equal(poster.status,200);assert.match(poster.headers.get('content-type'),/image\/jpeg/);
    const part=await fetch(url.origin+video.url,{headers:{...headers,Range:'bytes=10-29'}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes 10-29/${bytes.length}`);assert.deepEqual(Buffer.from(await part.arrayBuffer()),bytes.subarray(10,30));
    const badRange=await fetch(url.origin+video.url,{headers:{...headers,Range:`bytes=${bytes.length+10}-`}});assert.equal(badRange.status,416);
    const crop={fit:'cover',zoom:1.5,x:.2,y:.8};
    const apply=await fetch(url.origin+'/api/apply',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:video.name,kind:'video',strength:20,crop,paused:true})});assert.equal(apply.status,200,await apply.clone().text());
    const saved=JSON.parse(await readFile(join(root,'settings.json'),'utf8'));assert.equal(saved.kind,'video');assert.equal(saved.video.width,96);assert.equal(saved.paused,true);assert.deepEqual(saved.crop,crop);
    await new Promise(resolve=>active.server.close(resolve));active=await startLibrary({root,open:false});url=new URL(active.url);headers={Authorization:`Bearer ${url.searchParams.get('token')}`};
    const settings=await(await fetch(url.origin+'/api/settings',{headers})).json();assert.equal(settings.kind,'video');assert.equal(settings.paused,true);assert.deepEqual(settings.crop,crop);
    const bad=await fetch(url.origin+'/api/import-video',{method:'POST',headers:{...headers,'X-File-Name':'broken.mp4'},body:Buffer.alloc(24)});assert.equal(bad.status,400);
    assert.ok(!(await readdir(join(root,'videos'))).some(name=>name.startsWith('.upload-')));
    const deleted=await fetch(url.origin+'/api/delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({kind:'video',name:video.name})});assert.equal(deleted.status,200);const deletion=(await deleted.json()).deleted;assert.equal(deletion.active,true);
    assert.equal(JSON.parse(await readFile(join(root,'settings.json'),'utf8')).enabled,false);
    assert.equal((await fetch(url.origin+'/api/undo-delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:deletion.id})})).status,200);
    await fetch(url.origin+'/api/restore',{method:'POST',headers});assert.deepEqual(await readFile(join(root,'videos',video.name)),bytes);
  }finally{if(active)await new Promise(resolve=>active.server.close(resolve));await rm(root,{recursive:true,force:true});}
});
