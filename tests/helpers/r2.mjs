import {createHash} from 'node:crypto';
export function fakeR2(objects=new Map()){
 const calls=[];
 const make=(key,item,range)=>{
  const data=new Uint8Array(item.bytes),etag=createHash('sha256').update(data).digest('hex');
  return {key,size:data.length,etag,httpEtag:'"'+etag+'"',body:data,range,
   json:async()=>JSON.parse(new TextDecoder().decode(data)),
   writeHttpMetadata:headers=>{headers.set('Content-Type',item.type||'application/octet-stream');}
  };
 };
 return {objects,calls,
  get:async(key,options)=>{calls.push(['get',key]);const item=objects.get(key);if(!item)return null;return make(key,item);},
  head:async key=>{calls.push(['head',key]);const item=objects.get(key);return item?make(key,item):null;},
  put:async(key,value,options={})=>{
   calls.push(['put',key]);const old=objects.get(key),oldEtag=old&&createHash('sha256').update(old.bytes).digest('hex');
   if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==oldEtag)return null;
   const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);
   objects.set(key,{bytes,type:options.httpMetadata?.contentType});return make(key,objects.get(key));
  }
 };
}
export function objectContext(storage=new Map()){
 return {storage:{get:async key=>structuredClone(storage.get(key)),put:async(key,value)=>storage.set(key,structuredClone(value))},blockConcurrencyWhile:callback=>callback()};
}
