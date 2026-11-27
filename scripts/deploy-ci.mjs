import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseTelegramJSON,safeAssetPath} from '../dist/assets/core.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export function validatePrivateSeed(value){
 if(value?.schemaVersion!==1||!Array.isArray(value.records)||!value.records.length)throw Error('Private R2 import is not ready. The current deployment was not changed.');
 const parsed=parseTelegramJSON(value);
 if(parsed.records.length!==value.records.length||new Set(parsed.records.map(item=>item.id)).size!==parsed.records.length)throw Error('Private R2 import is invalid. The current deployment was not changed.');
 for(const record of parsed.records)for(const file of record.attachments){
  if(file.imageData||file.url&&!safeAssetPath(file.url))throw Error('Private files have not been migrated to R2. The current deployment was not changed.');
 }
 return parsed.records.length;
}

export async function verifyAnonymousSite({fetcher=fetch,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=6}={}){
 const site='https://healthrecords.ayaijan.com';
 for(let i=0;i<attempts;i++){
  let ready=true;
  for(const path of ['/api/archive','/assets/app.bundle.js','/media/'+('a'.repeat(24))+'.pdf']){
   const response=await fetcher(site+path,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(response.status!==401||response.headers.get('X-Archive-Auth')!=='session'){
    if(response.status!==503)throw Error('The deployed sign-in gate did not pass verification.');
    ready=false;break;
   }
  }
  if(ready){
   const response=await fetcher(site+'/auth/config',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(response.ok&&['bootstrap','pbkdf2'].includes((await response.json()).mode))return;
  }
  if(i<attempts-1)await delay(2500);
 }
 throw Error('The private sign-in service is not ready. Check the Worker bindings and existing password secret.');
}

export async function deploy({run,read=readFile,makeTemp=mkdtemp,remove=rm,verify=verifyAnonymousSite}={}){
 const config=JSON.parse(await read(join(root,'wrangler.jsonc'),'utf8'));
 const bucket=config.r2_buckets.find(item=>item.binding==='ARCHIVE_FILES')?.bucket_name;
 if(config.name!=='healthrecords'||bucket!=='aijan-records')throw Error('Unexpected deployment destination.');
 if(!run)run=args=>new Promise((resolve,reject)=>{
  const executable=process.platform==='win32'?'wrangler.cmd':'wrangler';
  const child=spawn(executable,args,{cwd:root,shell:false,env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_ACCOUNT_ID:config.account_id},stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>resolve(code??1));
 });
 if(await run(['whoami','--json'])!==0)throw Error('Cloudflare build authentication failed.');
 const temporary=await makeTemp(join(tmpdir(),'healthrecords-build-'));
 try{
  const target=join(temporary,'seed.json');
  if(await run(['r2','object','get',bucket+'/archive/seed.json','--remote','--file',target])!==0)throw Error('Initial import into private R2 has not finished. The current website was not changed. Run the one-time private import, then retry this build.');
  validatePrivateSeed(JSON.parse(await read(target,'utf8')));
 }finally{await remove(temporary,{recursive:true,force:true});}
 // Existing password secrets, Durable Object state, and R2 data are retained.
 // This command never uploads source medical records or resets a password.
 if(await run(['deploy','--config','wrangler.jsonc'])!==0)throw Error('Cloudflare did not publish the update.');
 await verify();
 console.log('Published and verified the private sign-in gate. Records and originals remain in R2.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1])))deploy().catch(error=>{console.error(error.message);process.exitCode=1;});
