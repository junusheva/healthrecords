import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivateDeployment} from '../scripts/deployment-checks.mjs';
import {authFixture,TEST_PASSWORD} from './helpers/auth.mjs';
const details={site:'https://healthrecords.ayaijan.com',username:'owner@example.com',password:TEST_PASSWORD};
test('waits through deployment propagation and then verifies protected files and initial sign-in',async()=>{
 const f=await authFixture();const calls=[];let paused=0;
 const result=await verifyPrivateDeployment(details,{delay:async()=>{paused++;},fetcher:async(url,options)=>{
  calls.push({url,body:options.body,cookie:options.headers?.Cookie});
  if(calls.length===1)return new Response(null,{status:503});
  return f.publicFetch(url,options);
 }});
 assert.equal(paused,1);assert.equal(result.ownerVerified,true);
 assert.ok(calls.slice(0,4).every(call=>!call.body&&!call.cookie));
});
test('a persistent 503 identifies configuration failure and never sends a credential',async()=>{
 let sent=false;
 await assert.rejects(verifyPrivateDeployment(details,{attempts:2,delay:async()=>{},fetcher:async(url,options)=>{sent||=Boolean(options.body||options.headers?.Cookie);return new Response(null,{status:503});}}),/ARCHIVE_AUTH/);
 assert.equal(sent,false);
});
test('an open site or an unexpected authentication response never receives credentials',async()=>{
 for(const response of [new Response(null,{status:200}),new Response(null,{status:401})]){
  let sent=false;await assert.rejects(verifyPrivateDeployment(details,{fetcher:async(url,options)=>{sent||=Boolean(options.body);return response;}}),/Пароль не отправлялся/);assert.equal(sent,false);
 }
});
test('redeployment keeps a custom password and does not attempt the initial file password',async()=>{
 const f=await authFixture();await f.auth.ready;f.auth.state.mode='pbkdf2';f.auth.state.salt='a'.repeat(43);await f.auth.ctx.storage.put('owner',f.auth.state);
 const urls=[];const result=await verifyPrivateDeployment(details,{fetcher:async(url,options)=>{urls.push(url);return f.publicFetch(url,options);}});
 assert.equal(result.customPassword,true);assert.equal(result.ownerVerified,false);assert.ok(!urls.some(url=>url.endsWith('/auth/login')));
});

