const AUTH_ENCODER=new TextEncoder();
export const AUTH_ITERATIONS=600000;
export const AUTH_SESSION_SECONDS=8*60*60;
export const AUTH_COOKIE='__Host-healthrecords';
export const authHex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function authHash(text){return authHex(await crypto.subtle.digest('SHA-256',AUTH_ENCODER.encode(text)));}
const authBase64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function authBytes(text){if(!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('Invalid encoding');return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(text.length/4)*4,'=')),c=>c.charCodeAt(0));}
const authRandom=()=>authBase64(crypto.getRandomValues(new Uint8Array(32)));
function authJSON(value,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
async function authEqual(actualHex,expectedHex){
 const actual=Uint8Array.from(actualHex.match(/../g),n=>parseInt(n,16)),expected=Uint8Array.from(expectedHex.match(/../g),n=>parseInt(n,16));
 if(typeof crypto.subtle.timingSafeEqual==='function')return crypto.subtle.timingSafeEqual(actual,expected);
 const key=await crypto.subtle.importKey('raw',expected,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 return crypto.subtle.verify('HMAC',key,await crypto.subtle.sign('HMAC',key,expected),actual);
}
export function authCookie(token){return AUTH_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+AUTH_SESSION_SECONDS;}
export function readAuthCookie(request){
 const pair=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(AUTH_COOKIE+'='));
 return pair?pair.slice(AUTH_COOKIE.length+1):'';
}
export class ArchiveAuth {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.failures=new Map();this.mutations=Promise.resolve();
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   this.state=await ctx.storage.get('owner');
   const bootstrap=typeof env.ARCHIVE_PASSWORD_SHA256==='string'?env.ARCHIVE_PASSWORD_SHA256.trim():'';
   if(!this.state&&/^[a-f0-9]{64}$/.test(bootstrap)&&!/^0+$/.test(bootstrap)){
    this.state={mode:'bootstrap',salt:'',iterations:AUTH_ITERATIONS,verifier:await authHash(bootstrap),version:1,signingKey:authRandom()};
    await ctx.storage.put('owner',this.state);
   }
  });
 }
 async signingKey(){
  if(!this.key)this.key=await crypto.subtle.importKey('raw',authBytes(this.state.signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return this.key;
 }
 async issueSession(){
  const body=authBase64(AUTH_ENCODER.encode(JSON.stringify({v:this.state.version,exp:Math.floor(Date.now()/1000)+AUTH_SESSION_SECONDS,nonce:authRandom()})));
  const signature=await crypto.subtle.sign('HMAC',await this.signingKey(),AUTH_ENCODER.encode(body));
  return body+'.'+authBase64(signature);
 }
 async validSession(token){
  try{
   if(typeof token!=='string'||token.length>2000)return false;
   const parts=token.split('.');if(parts.length!==2)return false;
   if(!await crypto.subtle.verify('HMAC',await this.signingKey(),authBytes(parts[1]),AUTH_ENCODER.encode(parts[0])))return false;
   const payload=JSON.parse(new TextDecoder().decode(authBytes(parts[0])));
   return payload.v===this.state.version&&typeof payload.exp==='number'&&payload.exp>Math.floor(Date.now()/1000)&&payload.exp<=Math.floor(Date.now()/1000)+AUTH_SESSION_SECONDS+10;
  }catch{return false;}
 }
 async validProof(proof){return typeof proof==='string'&&/^[a-f0-9]{64}$/.test(proof)&&await authEqual(await authHash(proof),this.state.verifier);}
 async serialMutation(callback){
  const pending=this.mutations.then(callback);this.mutations=pending.then(()=>{},()=>{});return pending;
 }
 async fetch(request){
  await this.ready;
  if(!this.state)return authJSON({error:'not_configured'},503);
  const path=new URL(request.url).pathname;
  let data={};try{if(request.method==='POST')data=await request.json();}catch{return authJSON({error:'invalid_request'},400);}
  if(path==='/config')return authJSON({mode:this.state.mode,salt:this.state.salt,iterations:AUTH_ITERATIONS});
  if(path==='/check')return authJSON({authorized:await this.validSession(data.token)});
  if(path==='/login')return this.serialMutation(async()=>{
   const peer=String(data.peer||'unknown').slice(0,128),now=Date.now(),failure=this.failures.get(peer);
   if(failure&&failure.until>now&&failure.count>=8)return authJSON({error:'too_many_attempts'},429);
   if(!await this.validProof(data.proof)){
    const next=failure&&failure.until>now?{...failure,count:failure.count+1}:{count:1,until:now+600000};
    if(this.failures.size>=1000)this.failures.delete(this.failures.keys().next().value);
    this.failures.set(peer,next);return authJSON({error:'invalid_password'},401);
   }
   this.failures.delete(peer);return authJSON({token:await this.issueSession()});
  });
  return this.serialMutation(async()=>{
  if(!await this.validSession(data.token))return authJSON({error:'sign_in_required'},401);
  if(path==='/change'){
   const peer='change:'+String(data.peer||'unknown').slice(0,128),now=Date.now(),failure=this.failures.get(peer);
   if(failure&&failure.until>now&&failure.count>=8)return authJSON({error:'too_many_attempts'},429);
   if(!await this.validProof(data.currentProof)){
    this.failures.set(peer,{count:failure&&failure.until>now?failure.count+1:1,until:failure&&failure.until>now?failure.until:now+600000});
    return authJSON({error:'invalid_password'},401);
   }
   if(typeof data.newProof!=='string'||!/^[a-f0-9]{64}$/.test(data.newProof)||typeof data.newSalt!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.newSalt))return authJSON({error:'invalid_request'},400);
   const next={...this.state,mode:'pbkdf2',salt:data.newSalt,verifier:await authHash(data.newProof),version:this.state.version+1};
   // Persist the complete new credential and session version in one write.
   await this.ctx.storage.put('owner',next);this.state=next;this.failures.clear();
   return authJSON({token:await this.issueSession()});
  }
  if(path==='/logout'){
   const next={...this.state,version:this.state.version+1};
   await this.ctx.storage.put('owner',next);this.state=next;return authJSON({signedOut:true});
  }
  return authJSON({error:'not_found'},404);
  });
 }
}

