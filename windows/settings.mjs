import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const transient=new Set(['EBUSY','EACCES','EPERM']);
async function retry(action){
  for(let attempt=0;;attempt++){
    try{return await action();}
    catch(error){if(attempt>=5||!transient.has(error.code))throw error;await delay(25*(attempt+1));}
  }
}
export async function readSettings(root){
  try{
    const value=JSON.parse(await retry(()=>readFile(join(root,'settings.json'),'utf8')));
    if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('Cấu hình hình nền không hợp lệ.'),{code:'INVALID_SETTINGS'});
    return value;
  }catch(error){if(error.code==='ENOENT')return {enabled:false,strength:35};throw error;}
}
export async function writeSettings(root,settings){
  const temporary=join(root,`.settings-${randomUUID()}.tmp`);
  try{
    await writeFile(temporary,JSON.stringify(settings,null,2),{flag:'wx'});
    await retry(()=>rename(temporary,join(root,'settings.json')));
  }finally{await unlink(temporary).catch(()=>{});}
}
