import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com';
const env={PREVIEW_OWNER_EMAIL:'owner@example.com',PREVIEW_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const key=await crypto.subtle.importKey('raw',Buffer.from(env.PREVIEW_ENCRYPTION_KEY,'base64'),'AES-GCM',false,['encrypt']);
const iv=crypto.getRandomValues(new Uint8Array(12));
const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('<h1>Private catalogue test</h1>'));
const assets={testing:{iv:Buffer.from(iv).toString('base64'),data:Buffer.from(cipher).toString('base64')},home:'Public homepage'};
const handler=createHandler(assets);
test('anonymous and other signed-in visitors cannot read private preview',async()=>{
 let r=await handler(new Request(origin+'/Testing'),env);assert.equal(r.status,401);assert.match(await r.text(),/signin-with-chatgpt/);assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 r=await handler(new Request(origin+'/Testing',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'}}),env);assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/Private catalogue test/);
 r=await handler(new Request(origin+'/Testing',{headers:{'oai-authenticated-user-email':'owner@example.com'}}),env);assert.equal(r.status,401);
});
test('configured site owner can decrypt the preview; GET and HEAD have private cache controls',async()=>{
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'Owner@example.com'};
 const r=await handler(new Request(origin+'/Testing',{headers}),env);assert.equal(r.status,200);assert.equal(await r.text(),'<h1>Private catalogue test</h1>');assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 const head=await handler(new Request(origin+'/Testing/',{method:'HEAD',headers}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('missing settings and incorrect keys fail closed; public homepage remains public',async()=>{
 assert.equal((await handler(new Request(origin+'/Testing'),{})).status,503);
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
 assert.equal((await handler(new Request(origin+'/Testing',{headers}),{...env,PREVIEW_ENCRYPTION_KEY:randomBytes(32).toString('base64')})).status,503);
 assert.equal(await (await handler(new Request(origin+'/'),env)).text(),'Public homepage');
 assert.equal((await handler(new Request(origin+'/Testing',{method:'POST'}),env)).status,405);
});
