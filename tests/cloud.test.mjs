import test from 'node:test';
import assert from 'node:assert/strict';
import {ArchiveData,DAILY_FILE_READS,DAILY_WRITES,STORAGE_MAX_BYTES,FILE_MAX_BYTES} from '../worker/archive.js';
import {handleRequest} from '../worker/index.js';
import {createCloudArchive,enrichArchive,mergeLegacyArchive} from '../dist/assets/cloud.js';
import {authFixture} from './helpers/auth.mjs';
import {objectContext} from './helpers/r2.mjs';
const origin='https://healthrecords.ayaijan.com';
const sample=()=>({schemaVersion:1,channel:{name:'Archive'},records:[{id:'health:1',messageId:'1',origin:'telegram',title:'Original record',text:'Original text',notes:'',saved:false,attachments:[],date:'2026-01-01'}]});
async function connected(f){
 const {cookie}=await f.login();
 const fetchImpl=(path,options={})=>handleRequest(new Request(origin+path,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),Cookie:cookie,Origin:origin}}),f.env);
 return {client:createCloudArchive({origin,fetchImpl}),fetchImpl,cookie};
}
test('records and edits persist in R2 across object restarts and devices',async()=>{
 const f=await authFixture(),a=await connected(f);
 assert.equal((await a.client.load()).records[0].text,'Original text');await a.client.save(sample());
 const stored=JSON.parse(new TextDecoder().decode(f.bucket.objects.get('archive/state.json').bytes));assert.equal(stored.state.records[0].text,'Original text');
 const restarted=new ArchiveData(objectContext(f.dataStorage),f.env);f.env.ARCHIVE_DATA.get=()=>({fetch:request=>restarted.fetch(request)});
 const b=await connected(f),state=await b.client.load();state.records[0].notes='Edited from a phone';await b.client.save(state);
 assert.equal((await a.client.load()).records[0].notes,'Edited from a phone');
 assert.ok(![...f.dataStorage.values()].some(value=>JSON.stringify(value).includes('Original text')));
});
test('a stale device and an incomplete import cannot overwrite cloud records',async()=>{
 const f=await authFixture(),a=await connected(f),b=await connected(f);
 await a.client.load();await a.client.save(sample());const one=await a.client.load(),two=await b.client.load();
 one.records.push({...one.records[0],id:'manual:2',messageId:'2',origin:'manual',text:'New record'});await a.client.save(one);
 await assert.rejects(b.client.save(two),error=>error.status===409);
 assert.equal((await b.client.load()).records.length,2);
 await assert.rejects(b.client.save(two),error=>error.status===409);
 assert.equal((await a.client.load()).records.length,2);
});
test('R2 uploads keep the exact image bytes and save references instead of base64',async()=>{
 const f=await authFixture(),a=await connected(f);await a.client.load();
 const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
 const original=await a.client.upload(new Blob([bytes],{type:'image/png'}),'result.png');
 assert.match(original.url,/^media\/[a-f0-9]{64}\.png$/);assert.deepEqual(f.bucket.objects.get(original.url).bytes,bytes);
 const before=f.bucket.calls.filter(([method])=>method==='put').length;
 assert.equal((await a.client.upload(new Blob([bytes],{type:'image/png'}),'same.png')).url,original.url);
 assert.equal(f.bucket.calls.filter(([method])=>method==='put').length,before);
 const state=sample();state.records[0].attachments=[original];await a.client.save(state);
 const saved=new TextDecoder().decode(f.bucket.objects.get('archive/state.json').bytes);assert.ok(!saved.includes('data:image'));assert.match(saved,/result.png/);
 const file=await a.fetchImpl('/'+original.url);assert.equal(file.status,200);assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes);assert.equal(file.headers.get('Cache-Control'),'private, no-store');
});
test('PDFs remain private and unsupported file types never reach R2',async()=>{
 const f=await authFixture(),a=await connected(f);
 const pdf=await a.client.upload(new Blob(['%PDF-1.7\nexample'],{type:'application/pdf'}),'report.pdf');
 const read=await a.fetchImpl('/'+pdf.url);assert.equal(read.headers.get('Content-Disposition'),'attachment');assert.equal(read.headers.get('X-Archive-Storage'),'r2');
 const previous=f.bucket.calls.length;
 assert.equal((await handleRequest(f.makeRequest('/'+pdf.url),f.env)).status,401);
 assert.equal((await handleRequest(f.makeRequest('/api/archive'),f.env)).status,401);assert.equal(f.bucket.calls.length,previous);
 await assert.rejects(a.client.upload(new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png'),error=>error.status===415);
 assert.equal((await a.fetchImpl('/api/files',{method:'POST',headers:{Origin:'https://evil.example'},body:'x'})).status,403);
});
test('cross-origin writes and oversized streams stop before a storage operation',async()=>{
 const f=await authFixture(),a=await connected(f),before=f.bucket.calls.length;
 const cross=await handleRequest(new Request(origin+'/api/archive',{method:'PUT',headers:{Origin:'https://evil.example',Cookie:a.cookie,'Content-Type':'application/json'},body:'{}'}),f.env);
 assert.equal(cross.status,403);
 const big=await a.fetchImpl('/api/files',{method:'POST',body:new Uint8Array(FILE_MAX_BYTES+1)});assert.equal(big.status,413);assert.equal(f.bucket.calls.length,before);
});
test('quotas stop uploads and reads without deleting stored data',async()=>{
 const f=await authFixture(),a=await connected(f),day=new Date().toISOString().slice(0,10);
 f.dataStorage.set('quota',{day,totalBytes:STORAGE_MAX_BYTES,reads:DAILY_FILE_READS,writes:DAILY_WRITES});
 const count=f.bucket.calls.length;
 assert.equal((await a.fetchImpl('/media/'+('a'.repeat(24))+'.pdf')).status,429);
 await assert.rejects(a.client.upload(new Blob(['%PDF-test']),'new.pdf'),error=>error.status===429);
 assert.equal(f.bucket.calls.length,count);assert.equal(f.bucket.objects.size,2);
});
test('failed storage writes leave the last saved record intact',async()=>{
 const f=await authFixture(),a=await connected(f);await a.client.load();await a.client.save(sample());
 f.bucket.put=async()=>{throw Error('unavailable');};const changed=sample();changed.records[0].notes='Not yet saved';
 await assert.rejects(a.client.save(changed),error=>error.status===503);
 assert.equal((await a.client.load()).records[0].notes,'');
});
test('source enrichment preserves personal edits and migration preserves local-only notes',()=>{
 const seed=sample();seed.records[0].clinical={findings:['Reviewed source fact']};
 const old=sample();old.records[0].notes='Personal note';old.records[0].title='My title';
 const merged=enrichArchive(seed,old);assert.equal(merged.records[0].notes,'Personal note');assert.equal(merged.records[0].title,'My title');assert.deepEqual(merged.records[0].clinical.findings,['Reviewed source fact']);
 const legacy=sample();legacy.records[0].notes='Earlier local note';legacy.records[0].saved=true;
 const migrated=mergeLegacyArchive(merged,legacy,'2026-11-27');assert.match(migrated.records[0].notes,/Personal note/);assert.match(migrated.records[0].notes,/Earlier local note/);assert.equal(migrated.records[0].saved,true);
 const titleEdit=sample();titleEdit.records[0].title='My earlier title';assert.equal(mergeLegacyArchive(seed,titleEdit,'2026-11-27',seed).records[0].title,'My earlier title');
});
test('a local preview cannot silently save records on the computer',async()=>{
 let requests=0;const client=createCloudArchive({origin:'file://',fetchImpl:async()=>{requests++;}});
 await assert.rejects(client.load(),/healthrecords\.ayaijan\.com/);assert.equal(requests,0);
});
test('the cloud loads a private R2 seed without requiring a deployed data.js file',async()=>{
 const seed=sample();seed.checkupPlans={example:{doctorPlan:'Synthetic private plan'}};
 const f=await authFixture({seed}),a=await connected(f),loaded=await a.client.load();
 assert.equal(loaded.checkupPlans.example.doctorPlan,'Synthetic private plan');
 assert.equal(f.assets.length,0);assert.ok(!f.bucket.objects.has('archive/state.json'));
 loaded.records[0].notes='New personal note';await a.client.save(loaded);
 f.bucket.objects.set('archive/seed.json',{bytes:new TextEncoder().encode(JSON.stringify({...seed,records:[{...seed.records[0],notes:'Old seed note'}]}))});
 const restarted=new ArchiveData(objectContext(f.dataStorage),f.env);f.env.ARCHIVE_DATA.get=()=>({fetch:request=>restarted.fetch(request)});
 const b=await connected(f);assert.equal((await b.client.load()).records[0].notes,'New personal note');
});
test('missing private data reports an incomplete import without creating an empty archive',async()=>{
 const f=await authFixture({seed:null}),a=await connected(f);
 await assert.rejects(a.client.load(),error=>error.status===503&&/Initial transfer/.test(error.message));
 assert.equal(f.bucket.objects.has('archive/state.json'),false);
 await assert.rejects(a.client.save(sample()),/Cloudflare/);
});
test('source corrections come from private archive metadata while personal titles are preserved',()=>{
 const seed=sample();seed.sourceCorrections={'1':{ignoreLegacyTitles:['Outdated imported title']}};
 const legacy=sample();legacy.records[0].title='Outdated imported title';
 assert.equal(mergeLegacyArchive(seed,legacy,'2026-11-27',seed).records[0].title,'Original record');
 legacy.records[0].title='My custom title';assert.equal(mergeLegacyArchive(seed,legacy,'2026-11-27',seed).records[0].title,'My custom title');
});
