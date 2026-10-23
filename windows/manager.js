const token=new URLSearchParams(location.search).get('token');
if(!token||!/^[a-f\d]{48}$/.test(token))throw new Error('Liên kết thư viện không hợp lệ.');
const {normalizeCrop,cropRect}=await import('/crop.mjs?token='+token);
const $=selector=>document.querySelector(selector);
const gallery=$('#gallery'),applyButton=$('#apply'),strength=$('#strength'),preview=$('#preview'),previewImage=$('#preview-image');
const previewVideo=$('#preview-video');
let images=[],selected='',filter='all',saved={},paused=false,busy=false,toastTimer,signature='',previewKey='',loadVersion=0,pendingLoads=0;
const posters=new Map();
const cropDrafts=new Map();let crop=normalizeCrop(),cropSelection='';
async function api(path,options={}){
  const response=await fetch(path,{signal:AbortSignal.timeout(30000),...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
  const value=await response.json().catch(()=>({error:'Phản hồi không hợp lệ.'}));
  if(!response.ok)throw new Error(value.error||'Không thể kết nối thư viện.');return value;
}
const post=(path,data={})=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const source=image=>image.url+`?token=${token}&v=${encodeURIComponent(image.revision||'')}`;
const mediaKey=image=>`${image.id}:${image.revision||''}`;
const sizeText=size=>size<1048576?`${Math.round(size/1024)} KB`:`${(size/1048576).toFixed(1)} MB`;
const chosen=()=>images.find(image=>image.id===selected);
function say(text,error=false){clearTimeout(toastTimer);$('#status').textContent=text;$('#status').classList.toggle('error',error);$('#status').hidden=false;toastTimer=setTimeout(()=>{$('#status').hidden=true;},error?9000:5500);}
function isSaved(image){return saved.enabled&&image&&image.name===saved.name&&image.kind===(saved.kind||'image')&&Number(strength.value)===saved.strength&&(image.kind==='image'||paused===saved.paused)&&JSON.stringify(crop)===JSON.stringify(normalizeCrop(saved.crop));}
async function poster(image){
  if(image.kind==='video')return image.poster+`?token=${token}`;
  if(image.kind!=='gif')return source(image);
  const key=mediaKey(image);if(posters.has(key))return posters.get(key);
  const pending=(async()=>{
    const response=await fetch(source(image));if(!response.ok)throw new Error('Không đọc được GIF.');
    const bitmap=await createImageBitmap(await response.blob());
    try {const canvas=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw new Error('Không tạo được ảnh xem trước.');return URL.createObjectURL(blob);}finally{bitmap.close();}
  })();posters.set(key,pending);pending.catch(()=>{if(posters.get(key)===pending)posters.delete(key);});return pending;
}
function update(){
  const image=chosen(),value=Number(strength.value);
  if(cropSelection!==selected){cropSelection=selected;crop=normalizeCrop(cropDrafts.get(selected)||(image?.name===saved.name&&image?.kind===(saved.kind||'image')?saved.crop:null));}
  $('#strength-value').innerHTML=`${value}<span>%</span>`;preview.style.setProperty('--preview-opacity',String(value/100));
  document.querySelectorAll('[data-strength]').forEach(button=>button.classList.toggle('active',Number(button.dataset.strength)===value));
  $('#preview-empty').hidden=!!image;$('#preview-play').hidden=!image||image.kind==='image';
  $('#preview-play').textContent=paused?'Phát ảnh động / video':'Tạm dừng';$('#preview-play').setAttribute('aria-pressed',String(paused));
  $('#preview-value').textContent=image?image.name:'Chưa chọn hình nền';$('#selected-name').textContent=image?image.name:'Chưa chọn hình nền';
  $('#preview-kind').textContent=image?.kind==='video'?'Video · lặp vô hạn · không âm thanh':image?.kind==='gif'?'GIF · 15 FPS trong app':'Ảnh tĩnh';
  $('#motion-note').textContent=image&&image.kind!=='image'?'Tự dừng khi cửa sổ ẩn · khoảng 15 FPS':'Thay đổi được xem trước ngay';
  $('#selection-state').textContent=!image?'Chọn ảnh hoặc GIF để bắt đầu':isSaved(image)?'Đã lưu · tự hiện khi mở Codex':`Chưa áp dụng · ${sizeText(image.size)}${image.kind==='gif'?` · ${image.frames} khung hình`:''}`;
  applyButton.disabled=!image||busy;
  document.querySelectorAll('#restore,#files,#refresh,#preview-play,#strength,[data-strength],[data-filter],.card').forEach(control=>control.disabled=busy);
  $('#crop-open').disabled=busy||!image;
  const nextKey=image?`${mediaKey(image)}:${paused}:${document.hidden}`:'';
  if(nextKey!==previewKey){previewKey=nextKey;previewImage.removeAttribute('src');previewVideo.pause();previewVideo.removeAttribute('src');previewVideo.load();
    if(image){if(image.kind==='video'&&!paused&&!document.hidden){previewVideo.src=source(image);previewVideo.play().catch(error=>{if(previewKey===nextKey&&error.name!=='AbortError'){previewImage.src=image.poster+`?token=${token}`;say('Không xem trước được video trong trình duyệt. Thử MP4 H.264.',true);}});}else if(image.kind!=='image'&&(paused||document.hidden||image.kind==='video')){poster(image).then(url=>{if(previewKey===nextKey)previewImage.src=url;}).catch(error=>say(error.message,true));}else previewImage.src=source(image);}
  }
  gallery.querySelectorAll('.card').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.id===selected)));
  paintCrop();
}
function renderGallery(){
  const visible=images.filter(image=>filter==='all'||image.kind===filter);gallery.replaceChildren();gallery.hidden=visible.length===0;
  $('#all-count').textContent=images.length;$('#image-count').textContent=images.filter(item=>item.kind==='image').length;$('#gif-count').textContent=images.filter(item=>item.kind==='gif').length;
  $('#video-count').textContent=images.filter(item=>item.kind==='video').length;
  $('#count').textContent=`${visible.length} hình nền`;
  $('#empty').hidden=visible.length>0;$('#empty-title').textContent=filter==='video'?'Chưa có video nào':filter==='gif'?'Chưa có GIF nào':'Thư viện đang trống';
  $('#empty-description').textContent=filter==='video'?'Thêm MP4, M4V, WebM hoặc MOV để phát lặp vô hạn.':filter==='gif'?'Thêm file .gif, hoặc chép vào thư mục GIF rồi bấm Làm mới.':'Thêm ảnh, GIF hoặc video của bạn để bắt đầu.';
  $('#empty-folder').textContent=filter==='video'?'Mở thư mục video':filter==='gif'?'Mở thư mục GIF':'Mở thư mục ảnh';
  for(const image of visible){
    const card=$('#card-template').content.firstElementChild.cloneNode(true);card.dataset.id=image.id;card.title=image.name;card.querySelector('.name').textContent=image.name;card.querySelector('.size').textContent=sizeText(image.size);
    card.querySelector('.type-badge').textContent=image.kind==='video'?'VIDEO ↻':image.kind==='gif'?'GIF':image.mime.split('/')[1].toUpperCase();
    card.querySelector('.saved-label').textContent=saved.enabled&&saved.name===image.name&&(saved.kind||'image')===image.kind?'Đang dùng':'';
    const img=card.querySelector('img');img.alt=image.name;
    if(image.kind!=='image')poster(image).then(url=>{if(card.isConnected)img.src=url;}).catch(()=>{img.alt='Không tạo được ảnh xem trước';});else img.src=source(image);
    card.addEventListener('click',()=>{if(selected!==image.id){selected=image.id;paused=false;}update();});gallery.append(card);
  }update();
}
async function load(initial=false,manual=false){
  const version=++loadVersion;pendingLoads++;
  try{
    const [result,settings]=await Promise.all([api('/api/images'),api('/api/settings')]);
    if(version!==loadVersion)return;
    const nextSignature=JSON.stringify([result.images.map(({id,revision})=>[id,revision]),settings,result.warnings]);
    if(!initial&&!manual&&signature===nextSignature)return;
    signature=nextSignature;images=result.images;saved=settings;
    const keep=new Set(images.map(mediaKey));for(const [key,pending]of posters)if(!keep.has(key)){posters.delete(key);pending.then(url=>URL.revokeObjectURL(url)).catch(()=>{});}
    if(!images.some(item=>item.id===selected))selected='';
    if(initial){strength.value=String(settings.strength);paused=settings.paused===true;}
    if(!selected){selected=images.find(item=>settings.enabled&&item.name===settings.name&&item.kind===(settings.kind||'image'))?.id||images[0]?.id||'';}
    renderGallery();if(result.warnings?.length&&(initial||manual))say(`${result.warnings[0].name}: ${result.warnings[0].error}`,true);else if(manual)say('Thư viện đã được làm mới.');
  }catch(error){if(version===loadVersion)say(error.message,true);}finally{pendingLoads--;}
}
function base64(bytes){let result='';for(let index=0;index<bytes.length;index+=32768)result+=String.fromCharCode(...bytes.subarray(index,index+32768));return btoa(result);}
async function optimize(image){
  const response=await fetch(source(image));if(!response.ok)throw new Error('Không đọc được ảnh.');
  const bitmap=await createImageBitmap(await response.blob());
  try{
    if(bitmap.width*bitmap.height>40000000)throw new Error('Ảnh vượt giới hạn 40 megapixel.');
    const scale=Math.min(1,2560/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#15151a';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw new Error('Không tối ưu được ảnh.');return base64(new Uint8Array(await blob.arrayBuffer()));
  }finally{bitmap.close();}
}
async function importFiles(files){
  if(busy||!files.length)return;busy=true;loadVersion++;update();
  try{
    for(let index=0;index<files.length;index++){
      const file=files[index];
      if(/\.(mp4|m4v|webm|mov)$/i.test(file.name)){
        if(file.size>200*1048576)throw new Error(`${file.name}: video vượt giới hạn 200 MB.`);
        say(`Đang thêm video ${index+1}/${files.length}: ${file.name}`);
        const result=await api('/api/import-video',{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name),'Content-Type':'application/octet-stream'},body:file,signal:AbortSignal.timeout(180000)});selected=result.id;filter='video';paused=false;continue;
      }
      if(file.size>30*1048576)throw new Error(`${file.name}: vượt giới hạn 30 MB.`);
      const decoded=await createImageBitmap(file);try{if(decoded.width*decoded.height>40000000)throw new Error('Ảnh vượt giới hạn 40 megapixel.');}finally{decoded.close();}
      say(`Đang thêm ${index+1}/${files.length}: ${file.name}`);
      const result=await post('/api/import',{name:file.name,data:base64(new Uint8Array(await file.arrayBuffer()))});selected=result.id;filter=result.kind;paused=false;
    }
    syncFilters();await load();say('Đã thêm vào thư viện. Chọn Áp dụng để dùng hình nền này.');
  }catch(error){syncFilters();say(error.message,true);await load();}finally{busy=false;update();$('#files').value='';}
}
function syncFilters(){document.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;syncFilters();renderGallery();}));
document.querySelectorAll('[data-strength]').forEach(button=>button.addEventListener('click',()=>{strength.value=button.dataset.strength;update();}));
strength.addEventListener('input',update);
$('#preview-play').addEventListener('click',()=>{paused=!paused;update();});
$('#files').addEventListener('change',event=>importFiles([...event.target.files]));
$('#refresh').addEventListener('click',()=>load(false,true));
async function openFolder(kind){try{await post('/api/open-folder',{kind});}catch(error){say(error.message,true);}}
$('#folder').addEventListener('click',()=>openFolder('image'));$('#gif-folder').addEventListener('click',()=>openFolder('gif'));$('#video-folder').addEventListener('click',()=>openFolder('video'));$('#empty-folder').addEventListener('click',()=>openFolder(filter==='video'?'video':filter==='gif'?'gif':'image'));
applyButton.addEventListener('click',async()=>{
  const image=chosen();if(!image||busy)return;busy=true;loadVersion++;update();applyButton.querySelector('span').textContent='Đang lưu…';
  try{const payload={name:image.name,kind:image.kind,strength:Number(strength.value),paused,crop:{...crop}};if(image.kind==='image')payload.optimized=await optimize(image);const result=await post('/api/apply',payload);saved=result.settings;renderGallery();say('Đã lưu. Bộ nạp sẽ cập nhật hình nền trên Codex.');}
  catch(error){say(error.message,true);}finally{busy=false;applyButton.querySelector('span').textContent='Áp dụng hình nền';update();}
});
$('#restore').addEventListener('click',async()=>{if(busy)return;busy=true;loadVersion++;update();try{await post('/api/restore');saved={enabled:false};renderGallery();say('Đã khôi phục giao diện gốc. Thư viện của bạn vẫn được giữ.');}catch(error){say(error.message,true);}finally{busy=false;update();}});
$('#launch-codex').addEventListener('click',async()=>{try{await post('/api/launch-codex');say('Đã gửi yêu cầu mở Codex gốc.');}catch(error){say(error.message,true);}});
$('#close').addEventListener('click',()=>{window.close();say('Bạn có thể đóng cửa sổ thư viện này.');});
async function refreshRuntime(){try{const state=await api('/api/runtime'),badge=$('#runtime-badge');badge.dataset.state=state.status||'waiting';badge.querySelector('span').textContent=({applied:'Đang hoạt động',waiting:'Chờ cửa sổ Codex',disabled:'Đã tắt hình nền',error:'Cần kiểm tra'})[state.status]||'Đang kết nối';badge.title=state.message||'';$('#runtime-status').textContent=state.message||'';}catch{$('#runtime-badge').dataset.state='error';$('#runtime-badge span').textContent='Mất kết nối';}}
document.addEventListener('dragover',event=>{event.preventDefault();$('#dropzone').classList.add('dragging');});
document.addEventListener('dragleave',event=>{if(!event.relatedTarget)$('#dropzone').classList.remove('dragging');});
document.addEventListener('drop',event=>{event.preventDefault();$('#dropzone').classList.remove('dragging');importFiles([...event.dataTransfer.files]);});
document.addEventListener('visibilitychange',()=>{update();if(!document.hidden){if(!busy)load();refreshRuntime();}});
window.addEventListener('beforeunload',()=>{for(const promise of posters.values())promise.then(url=>URL.revokeObjectURL(url)).catch(()=>{});});
setInterval(()=>{if(!document.hidden)refreshRuntime();},2000);setInterval(()=>{if(!document.hidden&&!busy&&!pendingLoads)load();},5000);
function placeImage(img,frame){
  const rect=cropRect(img.naturalWidth||img.videoWidth,img.naturalHeight||img.videoHeight,frame.clientWidth,frame.clientHeight,crop);
  Object.assign(img.style,{width:rect.width+'px',height:rect.height+'px',left:rect.x+'px',top:rect.y+'px',right:'auto',bottom:'auto'});
}
function paintCrop(){
  placeImage(previewImage,preview);
  placeImage(previewVideo,preview);
  if($('#crop-dialog').open){placeImage($('#crop-image'),$('#crop-stage'));$('#crop-zoom').value=String(crop.zoom*100);$('#crop-zoom-value').value=Math.round(crop.zoom*100)+'%';$('#crop-x').value=String(crop.x*100);$('#crop-y').value=String(crop.y*100);$('#crop-cover').setAttribute('aria-pressed',String(crop.fit==='cover'));$('#crop-contain').setAttribute('aria-pressed',String(crop.fit==='contain'));}
}
function editCrop(next){crop=normalizeCrop({...crop,...next});cropDrafts.set(selected,crop);update();}
previewImage.addEventListener('load',paintCrop);$('#crop-image').addEventListener('load',paintCrop);
previewVideo.addEventListener('loadedmetadata',paintCrop);
new ResizeObserver(paintCrop).observe(preview);new ResizeObserver(paintCrop).observe($('#crop-stage'));
function ratioChanged(){const value=$('#crop-ratio').value,ratio=value==='screen'?screen.width/screen.height:Number(value);$('#crop-stage').style.aspectRatio=String(ratio);$('#crop-stage').style.setProperty('--crop-ratio',String(ratio));paintCrop();}
$('#crop-open').addEventListener('click',async()=>{
  const image=chosen();if(!image||busy)return;
  // An independent still frame keeps GIF editing precise and inexpensive.
  try{const url=await poster(image);if(chosen()?.id!==image.id||busy)return;$('#crop-image').src=url;$('#crop-dialog').showModal();ratioChanged();paintCrop();}catch(error){say(error.message,true);}
});
$('#crop-close').addEventListener('click',()=>$('#crop-dialog').close());
$('#crop-dialog').addEventListener('close',()=>$('#crop-image').removeAttribute('src'));
$('#crop-ratio').addEventListener('change',ratioChanged);
$('#crop-zoom').addEventListener('input',event=>editCrop({zoom:Number(event.target.value)/100}));
$('#crop-x').addEventListener('input',event=>editCrop({x:Number(event.target.value)/100}));
$('#crop-y').addEventListener('input',event=>editCrop({y:Number(event.target.value)/100}));
$('#crop-cover').addEventListener('click',()=>editCrop({fit:'cover',zoom:1}));
$('#crop-contain').addEventListener('click',()=>editCrop({fit:'contain',zoom:1}));
$('#crop-reset').addEventListener('click',()=>editCrop(normalizeCrop()));
let cropDrag=null;
$('#crop-stage').addEventListener('pointerdown',event=>{if(event.button!==0||!$('#crop-image').naturalWidth)return;const stage=$('#crop-stage'),rect=cropRect($('#crop-image').naturalWidth,$('#crop-image').naturalHeight,stage.clientWidth,stage.clientHeight,crop);cropDrag={pointer:event.pointerId,px:event.clientX,py:event.clientY,x:crop.x,y:crop.y,dx:stage.clientWidth-rect.width,dy:stage.clientHeight-rect.height};stage.setPointerCapture(event.pointerId);event.preventDefault();});
$('#crop-stage').addEventListener('pointermove',event=>{if(!cropDrag||event.pointerId!==cropDrag.pointer)return;editCrop({x:Math.abs(cropDrag.dx)>1?cropDrag.x+(event.clientX-cropDrag.px)/cropDrag.dx:crop.x,y:Math.abs(cropDrag.dy)>1?cropDrag.y+(event.clientY-cropDrag.py)/cropDrag.dy:crop.y});});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('#crop-stage').addEventListener(name,()=>{cropDrag=null;});
load(true);refreshRuntime();
