import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {handleRequest} from '../worker/index.js';
import {authHash} from '../worker/auth.js';
import {authFixture,TEST_PASSWORD} from './helpers/auth.mjs';

test('anonymous visitors get a login page while every medical data file stays locked',async()=>{
 const f=await authFixture();
 const root=await handleRequest(f.makeRequest('/'),f.env);
 assert.equal(root.status,200);assert.match(await root.text(),/auth-root/);
 for(const path of ['/data.js','/data.json','/media/private.pdf','/media/photo.jpg','/assets/app.bundle.js']){
  const response=await handleRequest(f.makeRequest(path,{headers:{'Cf-Access-Authenticated-User-Email':'owner@example.com'}}),f.env);
  assert.equal(response.status,401);assert.equal(response.headers.get('X-Archive-Auth'),'session');
 }
 assert.equal(f.assets.length,0);
});
test('only the public authentication script is exposed before login',async()=>{
 const f=await authFixture();
 assert.equal((await handleRequest(f.makeRequest('/auth/client.js'),f.env)).status,200);
 assert.equal(f.assets[0],'https://healthrecords.ayaijan.com/assets/auth-client.js');
 assert.equal((await handleRequest(f.makeRequest('/assets/core.js'),f.env)).status,401);
});
test('successful login creates a secure HttpOnly session that permits reading original documents',async()=>{
 const f=await authFixture();const {response,cookie}=await f.login();
 assert.equal(response.status,200);
 assert.match(response.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await response.json()).token,undefined);
 for(const path of ['/data.json','/media/'+('a'.repeat(24))+'.pdf']){
  const asset=await handleRequest(f.makeRequest(path,{headers:{Cookie:cookie}}),f.env);
  assert.equal(asset.status,200);assert.equal(await asset.text(),'private archive');
  assert.equal(asset.headers.get('Cache-Control'),'private, no-store');assert.equal(asset.headers.get('Vary'),'Cookie');
 }
});
test('password changes persist, reject the original password and invalidate all old sessions',async()=>{
 const f=await authFixture();const a=await f.login(),b=await f.login();
 const salt=randomBytes(32).toString('base64url');
 const newProof=pbkdf2Sync('a long new password chosen for this test',Buffer.from(salt,'base64url'),600000,32,'sha256').toString('hex');
 const response=await f.post('/auth/change-password',{currentProof:await authHash(TEST_PASSWORD),newProof,newSalt:salt},a.cookie);
 assert.equal(response.status,200);
 const replacementCookie=response.headers.get('Set-Cookie').split(';')[0];
 for(const cookie of [a.cookie,b.cookie])assert.equal((await handleRequest(f.makeRequest('/data.json',{headers:{Cookie:cookie}}),f.env)).status,401);
 assert.equal((await handleRequest(f.makeRequest('/data.json',{headers:{Cookie:replacementCookie}}),f.env)).status,200);
 assert.equal((await f.login()).response.status,401);
 const restarted=await authFixture({storage:f.storage});
 assert.equal((await restarted.login(newProof)).response.status,200);
 assert.equal((await restarted.login()).response.status,401);
 const config=await handleRequest(restarted.makeRequest('/auth/config'),restarted.env);const publicConfig=await config.json();
 assert.equal(publicConfig.mode,'pbkdf2');assert.equal(publicConfig.salt,salt);assert.equal(publicConfig.verifier,undefined);assert.equal(publicConfig.signingKey,undefined);
});
test('changing a password requires both a valid session and the current password',async()=>{
 const f=await authFixture();const payload={currentProof:'0'.repeat(64),newProof:'1'.repeat(64),newSalt:randomBytes(32).toString('base64url')};
 assert.equal((await f.post('/auth/change-password',payload)).status,401);
 const {cookie}=await f.login();
 assert.equal((await f.post('/auth/change-password',payload,cookie)).status,401);
 assert.equal((await f.login()).response.status,200);
});
test('cross-origin changes, oversized bodies, arbitrary posts and forged sessions are denied',async()=>{
 const f=await authFixture();
 const cross=new Request('https://healthrecords.ayaijan.com/auth/change-password',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
 assert.equal((await handleRequest(cross,f.env)).status,403);
 const large=new Request('https://healthrecords.ayaijan.com/auth/login',{method:'POST',headers:{Origin:'https://healthrecords.ayaijan.com','Content-Type':'application/json'},body:'x'.repeat(9000)});
 assert.equal((await handleRequest(large,f.env)).status,413);
 assert.equal((await handleRequest(f.makeRequest('/data.js',{method:'POST'}),f.env)).status,405);
 assert.equal((await handleRequest(f.makeRequest('/data.js',{headers:{Cookie:'__Host-healthrecords=forged.token'}}),f.env)).status,401);
});
test('signing out revokes existing sessions without changing the password',async()=>{
 const f=await authFixture();const a=await f.login(),b=await f.login();
 assert.equal((await f.post('/auth/logout',{},a.cookie)).status,200);
 for(const cookie of [a.cookie,b.cookie])assert.equal((await handleRequest(f.makeRequest('/data.js',{headers:{Cookie:cookie}}),f.env)).status,401);
 assert.equal((await f.login()).response.status,200);
});
test('failed sign-ins are throttled and an unavailable credential store fails closed',async()=>{
 const f=await authFixture();
 for(let i=0;i<8;i++)assert.equal((await f.login('f'.repeat(64))).response.status,401);
 assert.equal((await f.login('f'.repeat(64))).response.status,429);
 assert.equal((await handleRequest(f.makeRequest('/data.js'),{ASSETS:f.env.ASSETS})).status,503);
 const missing=await authFixture({hash:''});
 assert.equal((await handleRequest(missing.makeRequest('/data.js'),missing.env)).status,503);
 const broken={...f.env,ARCHIVE_AUTH:{idFromName:()=>1,get:()=>({fetch:async()=>{throw Error('offline');}})}};
 assert.equal((await handleRequest(f.makeRequest('/data.js'),broken)).status,503);
});
test('alternate hosts and insecure traffic never reach private assets',async()=>{
 const f=await authFixture();
 assert.equal((await handleRequest(new Request('https://preview.example/data.js'),f.env)).status,404);
 assert.equal((await handleRequest(new Request('http://healthrecords.ayaijan.com/data.js'),f.env)).status,400);
 assert.equal(f.assets.length,0);
});
test('static files fit Free limits and the private R2 bucket uses SQLite coordination',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.assets.run_worker_first,true);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
 assert.equal(config.routes[0].pattern,'healthrecords.ayaijan.com');
 assert.deepEqual(config.migrations[0].new_sqlite_classes,['ArchiveAuth']);
 const list=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?list(join(directory,entry.name)):[join(directory,entry.name)]);
 const files=list(new URL('../dist/',import.meta.url).pathname);assert.ok(files.length<=20000);
 for(const file of files)assert.ok(statSync(file).size<=25*1024*1024,file);
 assert.deepEqual(config.r2_buckets,[{binding:'ARCHIVE_FILES',bucket_name:'aijan-records'}]);
 assert.deepEqual(config.migrations[1].new_sqlite_classes,['ArchiveData']);
 assert.match(readFileSync(new URL('../dist/.assetsignore',import.meta.url),'utf8'),/media\/\*\*/);
});
test('an old-password login racing a password change cannot create a surviving session',async()=>{
 const f=await authFixture();const signedIn=await f.login();
 const payload={currentProof:await authHash(TEST_PASSWORD),newProof:'d'.repeat(64),newSalt:randomBytes(32).toString('base64url')};
 const [changed,oldLogin]=await Promise.all([f.post('/auth/change-password',payload,signedIn.cookie),f.login()]);
 assert.equal(changed.status,200);
 if(oldLogin.response.status===200)assert.equal((await handleRequest(f.makeRequest('/data.js',{headers:{Cookie:oldLogin.cookie}}),f.env)).status,401);
 else assert.equal(oldLogin.response.status,401);
});
test('expired sessions cannot read files, and failed password writes leave the existing login intact',async(t)=>{
 const f=await authFixture();const {cookie}=await f.login();
 f.auth.ctx.storage.put=async()=>{throw Error('storage unavailable');};
 const changed=await f.post('/auth/change-password',{currentProof:await authHash(TEST_PASSWORD),newProof:'c'.repeat(64),newSalt:randomBytes(32).toString('base64url')},cookie);
 assert.equal(changed.status,503);
 assert.equal((await handleRequest(f.makeRequest('/data.js',{headers:{Cookie:cookie}}),f.env)).status,200);
 const time=Date.now();t.mock.method(Date,'now',()=>time+9*60*60*1000);
 assert.equal((await handleRequest(f.makeRequest('/data.js',{headers:{Cookie:cookie}}),f.env)).status,401);
});
