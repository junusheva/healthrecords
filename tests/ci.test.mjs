import test from 'node:test';
import assert from 'node:assert/strict';
import {deploy,validatePrivateSeed,verifyAnonymousSite} from '../scripts/deploy-ci.mjs';
const seed={schemaVersion:1,records:[{id:'example:1',text:'Synthetic test note',date:'2026-01-01',attachments:[]}]};
const config={name:'healthrecords',r2_buckets:[{binding:'ARCHIVE_FILES',bucket_name:'aijan-records'}]};
function fixture({stored=seed,download=0}={}){
 const calls=[];let removed=false;
 return {calls,get removed(){return removed;},options:{
  run:async args=>{calls.push(args);return args[0]==='r2'?download:0;},
  read:async path=>JSON.stringify(String(path).endsWith('wrangler.jsonc')?config:stored),
  makeTemp:async()=>'/tmp/synthetic-build',remove:async()=>{removed=true;},verify:async()=>{calls.push(['verify']);}
 }};
}
test('automatic deployment stops before changing a site when private R2 import is missing',async()=>{
 const f=fixture({download:1});await assert.rejects(deploy(f.options),/Initial import/);
 assert.equal(f.removed,true);assert.ok(!f.calls.some(args=>args[0]==='deploy'));
});
test('invalid or incomplete private data cannot pass the publication guard',async()=>{
 for(const bad of [null,{schemaVersion:1,records:[]},{...seed,records:[...seed.records,...seed.records]}])assert.throws(()=>validatePrivateSeed(bad));
 const f=fixture({stored:{schemaVersion:1,records:[]}});await assert.rejects(deploy(f.options));assert.ok(!f.calls.some(args=>args[0]==='deploy'));assert.equal(f.removed,true);
});
test('automatic deployment reads the private seed without replacing records or password secrets',async()=>{
 const f=fixture();await deploy(f.options);
 assert.deepEqual(f.calls.map(args=>args[0]),['whoami','r2','deploy','verify']);
 assert.equal(f.calls[1][2],'get');assert.equal(f.removed,true);
 assert.ok(!f.calls.some(args=>args.includes('put')||args.includes('delete')));
});
test('deployment verification sends no password and requires the session gate on every private route',async()=>{
 const urls=[];await verifyAnonymousSite({fetcher:async(url,options)=>{
  urls.push(url);assert.equal(options.body,undefined);assert.equal(options.headers,undefined);
  return url.endsWith('/auth/config')?Response.json({mode:'pbkdf2'}):new Response(null,{status:401,headers:{'X-Archive-Auth':'session'}});
 }});assert.equal(urls.length,4);
 await assert.rejects(verifyAnonymousSite({fetcher:async()=>new Response(null,{status:200})}),/gate/);
});
