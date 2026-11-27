import {parseTelegramJSON,safeAssetPath} from '../dist/assets/core.js';
export const ARCHIVE_MAX_BYTES=1500000;
export const FILE_MAX_BYTES=8*1024*1024;
export const STORAGE_MAX_BYTES=512*1024*1024;
export const DAILY_FILE_READS=10000;
export const DAILY_WRITES=200;
const encoder=new TextEncoder();
const json=(data,status=200)=>Response.json(data,{status});
export async function boundedBody(request,limit){
 const declared=Number(request.headers.get('Content-Length')||0);
 if(declared>limit)throw Object.assign(new Error('too_large'),{status:413});
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Object.assign(new Error('too_large'),{status:413});}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export function fileFormat(bytes){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return {mime:'image/png',extension:'png'};
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',extension:'jpg'};
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return {mime:'image/webp',extension:'webp'};
 if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')return {mime:'application/pdf',extension:'pdf'};
 return null;
}
function validArchive(value){
 if(!value||value.schemaVersion!==1||!Array.isArray(value.records)||!value.records.length||value.records.length>10000)throw Error('invalid_archive');
 const serialized=JSON.stringify(value);
 if(/data:(?:image|application)\/|"imageData"\s*:\s*"/.test(serialized))throw Error('upload_files_first');
 const parsed=parseTelegramJSON(value);
 if(new Set(parsed.records.map(record=>record.id)).size!==parsed.records.length)throw Error('duplicate_record');
 for(const record of parsed.records)for(const item of record.attachments)if(item.url&&!safeAssetPath(item.url))throw Error('invalid_file');
 return {...value,channel:parsed.channel,records:parsed.records};
}
// This object serializes writes and keeps quota counters. Medical records and
// original files are authoritative R2 objects, never a browser database.
export class ArchiveData {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.pending=Promise.resolve();this.loaded=false;}
 serial(callback){const job=this.pending.then(callback);this.pending=job.then(()=>{},()=>{});return job;}
 async quota(kind,bytes=0){
  const day=new Date().toISOString().slice(0,10);
  const saved=await this.ctx.storage.get('quota')||{};
  const quota={...saved,totalBytes:saved.totalBytes||Number(this.env.R2_SEED_BYTES)||0};
  if(quota.day!==day){quota.day=day;quota.reads=0;quota.writes=0;}
  if(kind==='read'){if(quota.reads>=DAILY_FILE_READS)return false;quota.reads++;}
  if(kind==='write'){if(quota.writes>=DAILY_WRITES||quota.totalBytes+bytes>STORAGE_MAX_BYTES)return false;quota.writes++;quota.totalBytes+=bytes;}
  // Reserve before an R2 operation. Failures may overcount, never undercount.
  await this.ctx.storage.put('quota',quota);return true;
 }
 async load(){
  if(this.loaded)return;
  if(!await this.quota('read'))throw Object.assign(Error('daily_limit'),{status:429});
  const object=await this.env.ARCHIVE_FILES.get('archive/state.json');
  if(object)this.envelope=await object.json();
  else{
   if(!await this.quota('read'))throw Object.assign(Error('daily_limit'),{status:429});
   const seed=await this.env.ARCHIVE_FILES.get('archive/seed.json');
   if(!seed)throw Error('initial_import_required');
   this.envelope={revision:0,state:await seed.json()};
  }
  if(!Number.isInteger(this.envelope.revision)||this.envelope.revision<0)throw Error('invalid_cloud_archive');
  this.envelope.state=validArchive(this.envelope.state);
  this.etag=object?.etag;this.loaded=true;
 }
 async fetch(request){
  if(!this.env.ARCHIVE_FILES)return json({error:'r2_not_configured'},503);
  return this.serial(async()=>{
   try{
    const path=new URL(request.url).pathname;
    if(path==='/state'&&request.method==='GET'){await this.load();return json(this.envelope);}
    if(path==='/state'&&request.method==='PUT'){
     const bytes=await boundedBody(request,ARCHIVE_MAX_BYTES),input=JSON.parse(new TextDecoder().decode(bytes));
     const state=validArchive(input);await this.load();
     const expected=Number(request.headers.get('If-Match'));
     if(!request.headers.has('If-Match')||!Number.isInteger(expected)||expected!==this.envelope.revision)return json({error:'conflict'},409);
     // Prevent an incomplete import or stale client from deleting source records.
     const ids=new Set(state.records.map(record=>record.id));
     if(this.envelope.state?.records.some(record=>!ids.has(record.id)))return json({error:'records_missing'},409);
     const next={revision:expected+1,state,updatedAt:new Date().toISOString()};
     const body=JSON.stringify(next);
     if(encoder.encode(body).length>ARCHIVE_MAX_BYTES)return json({error:'too_large'},413);
     if(!await this.quota('write'))return json({error:'daily_limit'},429);
     const result=await this.env.ARCHIVE_FILES.put('archive/state.json',body,{httpMetadata:{contentType:'application/json'},onlyIf:this.etag?{etagMatches:this.etag}:{etagDoesNotMatch:'*'}});
     if(!result){this.loaded=false;return json({error:'conflict'},409);}
     this.envelope=next;this.etag=result.etag;return json({revision:next.revision,updatedAt:next.updatedAt});
    }
    if(path==='/files'&&request.method==='POST'){
     const bytes=await boundedBody(request,FILE_MAX_BYTES),format=fileFormat(bytes);
     if(!format)return json({error:'unsupported_file'},415);
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
     const key='media/'+hash+'.'+format.extension;
     const known=await this.ctx.storage.get('file:'+hash);
     if(!known){
      if(!await this.quota('write',bytes.byteLength))return json({error:'storage_limit'},429);
      await this.env.ARCHIVE_FILES.put(key,bytes,{httpMetadata:{contentType:format.mime,cacheControl:'private, no-store'},onlyIf:{etagDoesNotMatch:'*'}});
      await this.ctx.storage.put('file:'+hash,{bytes:bytes.byteLength});
     }
     let name;try{name=decodeURIComponent(request.headers.get('X-File-Name')||'');}catch{}
     name=String(name||'document.'+format.extension).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200);
     return json({name,type:format.mime.startsWith('image/')?'photo':'file',url:key,status:'cloud_file',label:name});
    }
    if(path.startsWith('/media/')&&['GET','HEAD'].includes(request.method)){
     const key=path.slice(1);
     if(!/^media\/(?:[a-f0-9]{24}|[a-f0-9]{64})\.(?:jpg|jpeg|png|webp|pdf|zip)$/.test(key))return json({error:'not_found'},404);
     if(!await this.quota('read'))return json({error:'daily_limit'},429);
     const object=request.method==='HEAD'?await this.env.ARCHIVE_FILES.head(key):await this.env.ARCHIVE_FILES.get(key,{range:request.headers});
     if(!object)return json({error:'not_found'},404);
     const headers=new Headers();object.writeHttpMetadata(headers);
     headers.set('ETag',object.httpEtag);headers.set('Accept-Ranges','bytes');
     if(/\.(?:pdf|zip)$/.test(key))headers.set('Content-Disposition','attachment');
     let status=200;
     if(object.range){status=206;headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));}
     else headers.set('Content-Length',String(object.size));
     return new Response(request.method==='HEAD'?null:object.body,{status,headers});
    }
    return json({error:'not_found'},404);
   }catch(error){this.loaded=false;return json({error:error.status===413?'too_large':error.status===429?'daily_limit':['upload_files_first','initial_import_required'].includes(error.message)?error.message:error instanceof SyntaxError||['invalid_archive','duplicate_record','invalid_file'].includes(error.message)?'invalid_archive':'storage_unavailable'},error.status||(['invalid_archive','duplicate_record','invalid_file','upload_files_first'].includes(error.message)||error instanceof SyntaxError?400:503));}
  });
 }
}
