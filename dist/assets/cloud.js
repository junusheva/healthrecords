import {parseTelegramJSON,safeLocalImageData} from './core.js';
import {mergeUserTracking} from './tracking.js';
export function mergeLegacyArchive(current,legacy,today,seed=current){
 const parsed=parseTelegramJSON(legacy),records=new Map(current.records.map(record=>[record.id,record]));
 const originals=new Map(seed.records.map(record=>[record.id,record]));
 for(const record of parsed.records){
  const existing=records.get(record.id);
  if(!existing){records.set(record.id,record);continue;}
  const notes=record.notes&&!existing.notes.includes(record.notes)?[existing.notes,record.notes].filter(Boolean).join('\n\n'):existing.notes;
  const original=originals.get(record.id),oldIncorrectTitle=seed.sourceCorrections?.[record.messageId]?.ignoreLegacyTitles?.includes(record.title);
  records.set(record.id,{...existing,title:original&&existing.title===original.title&&!oldIncorrectTitle?record.title:existing.title,topic:original&&existing.topic===original.topic?record.topic:existing.topic,saved:existing.saved||record.saved,notes});
 }
 return {...current,...mergeUserTracking(current,legacy,today),records:[...records.values()]};
}
export function enrichArchive(seed,stored){
 if(!stored)return seed;
 const previous=new Map(parseTelegramJSON(stored).records.map(record=>[record.id,record]));
 const records=seed.records.map(record=>{
  const old=previous.get(record.id);previous.delete(record.id);
  return old?{...record,...old,clinical:record.clinical,attachments:record.attachments,annotation:record.annotation,eventDate:record.eventDate,dateNote:record.dateNote}:record;
 });
 records.push(...previous.values());
 return {...stored,...seed,records,manualMeasurements:stored.manualMeasurements||[],manualCheckups:stored.manualCheckups||[],cadenceOverrides:stored.cadenceOverrides||{}};
}
export function createCloudArchive({fetchImpl=globalThis.fetch,origin=globalThis.location?.origin,onStatus=()=>{}}={}){
 let revision=null;
 const available=origin==='https://healthrecords.ayaijan.com';
 const errors={initial_import_required:"Initial transfer to private R2 has not finished. Existing records have not been changed.",sign_in_required:'Войди на сайт заново: сеанс завершён.',conflict:'Записи изменились на другом устройстве. Перезагрузи страницу перед сохранением. Текст в форме пока сохранён.',records_missing:'Сохранение остановлено: в новой версии отсутствуют существующие записи.',daily_limit:'Достигнут дневной лимит операций. Существующие данные сохранены.',storage_limit:'Достигнут лимит загрузок или объёма хранилища. Существующие файлы сохранены.',too_large:'Запись или файл слишком большие.',storage_unavailable:'Cloudflare временно недоступен. Изменения пока не сохранены.',r2_not_configured:'Хранилище R2 ещё не подключено к сайту.',unsupported_file:'Подойдут PNG, JPEG, WebP и PDF.',upload_files_first:'Сначала нужно перенести вложения в R2.'};
 async function request(path,options={}){
  if(!available)throw Error('Для сохранения открой https://healthrecords.ayaijan.com. Локальный просмотр не записывает данные.');
  const response=await fetchImpl(path,{...options,credentials:'same-origin',cache:'no-store'});
  let value;try{value=await response.json();}catch{}
  if(!response.ok)throw Object.assign(Error(errors[value?.error]||(response.status===401?errors.sign_in_required:errors.storage_unavailable)),{status:response.status});
  return value;
 }
 async function load(){onStatus('loading');const value=await request('/api/archive');revision=value.revision;onStatus('ready');return value.state;}
 async function save(state){
  if(revision===null)throw Error('Сначала дождись загрузки записей из Cloudflare.');
  onStatus('saving');
  try{const value=await request('/api/archive',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify(state)});revision=value.revision;onStatus('saved');}
  catch(error){onStatus('error');throw error;}
 }
 async function upload(file,name){return request('/api/files',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(name||file.name||'document')},body:file});}
 async function migrateImages(state){
  const records=[];
  for(const record of state.records){
   const attachments=[];
   for(const attachment of record.attachments||[]){
    const data=safeLocalImageData(attachment.imageData);
    if(data){const parts=data.split(','),mime=parts[0].slice(5).split(';')[0],bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));const moved=await upload(new Blob([bytes],{type:mime}),attachment.name);attachments.push({...attachment,...moved,imageData:null});}
    else attachments.push({...attachment,imageData:null});
   }
   records.push({...record,attachments});
  }
  return {...state,records};
 }
 return {available,load,save,upload,migrateImages,get ready(){return revision!==null;}};
}
