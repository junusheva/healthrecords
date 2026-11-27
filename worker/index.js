import {ArchiveAuth,authCookie,readAuthCookie,AUTH_COOKIE} from './auth.js';
import {LOGIN_HTML} from './login-page.js';
import {ArchiveData,boundedBody,ARCHIVE_MAX_BYTES,FILE_MAX_BYTES} from './archive.js';
const HOSTNAME='healthrecords.ayaijan.com';
const PRIVATE_HEADERS={
  'Cache-Control':'private, no-store',
  'Vary':'Cookie',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Strict-Transport-Security':'max-age=31536000',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/ https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob: https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/ https://cdn.jsdelivr.net/npm/@tesseract.js-data/; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function privateResponse(body,status=200,headers={}) {
 return new Response(body,{status,headers:{...PRIVATE_HEADERS,'Content-Type':'text/plain; charset=utf-8',...headers}});
}
async function callAuth(env,path,data){
 const id=env.ARCHIVE_AUTH.idFromName('owner');
 return env.ARCHIVE_AUTH.get(id).fetch('https://auth.internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});
}
export async function handleRequest(request,env) {
 const url=new URL(request.url);
 if(url.hostname!==HOSTNAME)return privateResponse('Not found',404);
 if(url.protocol!=='https:')return privateResponse('HTTPS required',400);
 const route=url.pathname;
 const read=['GET','HEAD'].includes(request.method);
 const authMutation=request.method==='POST'&&['/auth/login','/auth/change-password','/auth/logout'].includes(route);
 const archiveMutation=(request.method==='PUT'&&route==='/api/archive')||(request.method==='POST'&&route==='/api/files');
 if(!read&&!authMutation&&!archiveMutation)return privateResponse('Method not allowed',405);
 if(!read&&request.headers.get('Origin')!==url.origin)return privateResponse('Same-origin request required',403);
 try {
  if(!env.ARCHIVE_AUTH)return privateResponse('Private archive sign-in is not configured yet.',503);
  if(route==='/auth/client.js'&&read){
   const assetURL=new URL('/assets/auth-client.js',url);
   const asset=await env.ASSETS.fetch(new Request(assetURL,{method:request.method}));
   const response=new Response(asset.body,asset);for(const [key,value]of Object.entries(PRIVATE_HEADERS))response.headers.set(key,value);return response;
  }
  if(route==='/auth/config'&&read){
   const source=await callAuth(env,'/config');
   return privateResponse(request.method==='HEAD'?null:await source.text(),source.status,{'Content-Type':'application/json'});
  }
  if(authMutation){
   if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return privateResponse('JSON required',415);
   let body;try{body=new TextDecoder().decode(await boundedBody(request,8192));}catch{return privateResponse('Request too large',413);}
   let data;try{data=JSON.parse(body);}catch{return privateResponse('Invalid request',400);}
   if(!data||typeof data!=='object'||Array.isArray(data))return privateResponse('Invalid request',400);
   const path=route==='/auth/login'?'/login':route==='/auth/change-password'?'/change':'/logout';
   const result=await callAuth(env,path,{proof:data.proof,currentProof:data.currentProof,newProof:data.newProof,newSalt:data.newSalt,token:readAuthCookie(request),peer:request.headers.get('CF-Connecting-IP')||'unknown'});
   const value=await result.json();const headers={'Content-Type':'application/json'};
   if(value.token){headers['Set-Cookie']=authCookie(value.token);delete value.token;value.ok=true;}
   if(value.signedOut)headers['Set-Cookie']=AUTH_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
   if(result.status===429)headers['Retry-After']='600';
   return privateResponse(JSON.stringify(value),result.status,headers);
  }
  const checked=await callAuth(env,'/check',{token:readAuthCookie(request)});
  if(checked.status!==200)return privateResponse('Private archive sign-in is not configured yet.',503);
  const authorized=(await checked.json()).authorized===true;
  if(!authorized){
   if(route==='/'||route==='/index.html')return privateResponse(request.method==='HEAD'?null:LOGIN_HTML,200,{'Content-Type':'text/html; charset=utf-8'});
   return privateResponse('Sign in to access this private archive.',401,{'X-Archive-Auth':'session'});
  }
  if(route.startsWith('/api/')||route.startsWith('/media/')){
   if(!env.ARCHIVE_DATA)return privateResponse(JSON.stringify({error:'r2_not_configured'}),503,{'Content-Type':'application/json'});
   const path=route==='/api/archive'?'/state':route==='/api/files'?'/files':route;
   const headers=new Headers();for(const key of ['Content-Type','If-Match','Range','X-File-Name'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
   if(archiveMutation&&route==='/api/archive'&&!(headers.get('Content-Type')||'').startsWith('application/json'))return privateResponse('JSON required',415);
   let body;if(archiveMutation){try{body=await boundedBody(request,route==='/api/files'?FILE_MAX_BYTES:ARCHIVE_MAX_BYTES);}catch{return privateResponse(JSON.stringify({error:'too_large'}),413,{'Content-Type':'application/json'});}}
   const id=env.ARCHIVE_DATA.idFromName('owner');
   const result=await env.ARCHIVE_DATA.get(id).fetch(new Request('https://archive.internal'+path,{method:route==='/api/archive'&&request.method==='HEAD'?'GET':request.method,headers,body}));
   const response=new Response(request.method==='HEAD'?null:result.body,result);
   for(const [key,value]of Object.entries(PRIVATE_HEADERS))response.headers.set(key,value);
   response.headers.set('X-Archive-Storage','r2');return response;
  }
  const asset=await env.ASSETS.fetch(request);
  const response=new Response(asset.body,asset);
  for(const [name,value]of Object.entries(PRIVATE_HEADERS))response.headers.set(name,value);
  return response;
 }catch{return privateResponse('Private archive is temporarily unavailable.',503);}
}
export {ArchiveAuth,ArchiveData};
export default {fetch(request,env){return handleRequest(request,env);}};
