import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

async function readJSON(path,fallback){
  for(let attempt=0;attempt<4;attempt++){
    try{return JSON.parse(await readFile(path,'utf8'));}
    catch{if(attempt<3)await delay(20);}
  }
  return fallback;
}

export async function readRuntime(root,{now=Date.now(),alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}}={}){
  const integration=await readJSON(join(root,'integration.json'),{});
  if(integration.mode!=='overlay')return readJSON(join(root,'launch-state.json'),{});
  const state=await readJSON(join(root,'overlay-state.json'),{});
  if(!Number.isInteger(state.pid)||!alive(state.pid)||!Number.isFinite(Date.parse(state.updatedAt))||now-Date.parse(state.updatedAt)>8000){
    return {mode:'overlay',status:'error',message:'Bộ nạp ảnh tự động chưa chạy. Mở lại Codex Wallpaper để khởi động, hoặc chạy lại bộ cài.'};
  }
  return state;
}
