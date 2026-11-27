import {ArchiveAuth,authHash} from '../../worker/auth.js';
import {handleRequest} from '../../worker/index.js';
import {ArchiveData} from '../../worker/archive.js';
import {fakeR2,objectContext} from './r2.mjs';
export const TEST_PASSWORD='a'.repeat(43);
export async function authFixture({storage=new Map(),bootstrap=TEST_PASSWORD,hash,seed={schemaVersion:1,channel:{name:'Archive'},records:[{id:'health:1',messageId:'1',origin:'telegram',title:'Original record',text:'Original text',notes:'',saved:false,attachments:[],date:'2026-01-01'}]}}={}){
 const env={ARCHIVE_PASSWORD_SHA256:hash===undefined?await authHash(bootstrap):hash};
 const context={storage:{get:async key=>structuredClone(storage.get(key)),put:async(key,value)=>storage.set(key,structuredClone(value))},blockConcurrencyWhile:callback=>callback()};
 const auth=new ArchiveAuth(context,env);
 const assets=[];
 const bucket=fakeR2();bucket.objects.set('media/'+('a'.repeat(24))+'.pdf',{bytes:new TextEncoder().encode('private archive'),type:'application/pdf'});
 if(seed)bucket.objects.set('archive/seed.json',{bytes:new TextEncoder().encode(JSON.stringify(seed)),type:'application/json'});
 env.ARCHIVE_FILES=bucket;
 const dataStorage=new Map(),archive=new ArchiveData(objectContext(dataStorage),env);
 env.ARCHIVE_DATA={idFromName:()=> 'owner',get:()=>({fetch:request=>archive.fetch(request)})};
 env.ARCHIVE_AUTH={idFromName:()=> 'owner',get:()=>({fetch:(url,options)=>auth.fetch(url instanceof Request?url:new Request(url,options))})};
 env.ASSETS={fetch:async request=>{assets.push(request.url);return new Response('private archive',{headers:{'Content-Type':'text/plain','Cache-Control':'public, max-age=999'}});}};
 const makeRequest=(path,options={})=>new Request('https://healthrecords.ayaijan.com'+path,options);
 const publicFetch=(url,options={})=>handleRequest(new Request(url,options),env);
 const post=(path,data,cookie='')=>handleRequest(makeRequest(path,{method:'POST',headers:{Origin:'https://healthrecords.ayaijan.com','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)}),env);
 const login=async proof=>{
  if(proof===undefined)proof=await authHash(bootstrap);
  const response=await post('/auth/login',{proof});
  return {response,cookie:(response.headers.get('Set-Cookie')||'').split(';')[0]};
 };
 return {env,auth,storage,assets,makeRequest,publicFetch,post,login,bucket,archive,dataStorage};
}

