import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
import {createDownloadDB} from './helpers/download-db.mjs';
const origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
async function fixture(){
 const key=randomBytes(32).toString('base64'),k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);
 async function seal(text){const iv=crypto.getRandomValues(new Uint8Array(12));return {keyEnv:'PREVIEW_CONTENT_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text))).toString('base64')}}
 const pdf=await seal('%PDF-1.4\nprivate sample\n%%EOF');const assets={testing:await seal('<h1>Testing</h1>'),completedBooks:{'sneakpeak-ideas.pdf':pdf,'art-of-attention.pdf':pdf,'art-of-attention-sample.pdf':pdf}};
 const env={PREVIEW_OWNER_EMAIL:'owner@example.com',PREVIEW_CONTENT_KEY:key,DB:createDownloadDB()};return {env,handler:createHandler(assets)};
}
test('per-book sample and full counters record only authenticated successful download requests',async()=>{
 const {env,handler:h}=await fixture();const full=origin+'/Testing/books/art-of-attention.pdf',sample=origin+'/Testing/books/art-of-attention-sample.pdf';
 const get=(url,extra={})=>h(new Request(url,{headers:auth,...extra}),env);
 assert.equal((await h(new Request(sample+'?download=1'),env)).status,401);
 assert.equal((await h(new Request(sample+'?download=1',{headers:{...auth,'oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
 assert.equal((await get(sample)).status,200);assert.equal((await get(sample+'?download=1',{method:'HEAD'})).status,200);
 assert.equal((await get(sample+'?download=1',{headers:{...auth,'sec-purpose':'prefetch'}})).status,200);assert.equal(env.DB.rows().length,0);
 for(let i=0;i<2;i++)assert.equal((await get(full+'?download=1')).status,200);
 assert.equal((await get(sample+'?download=1')).status,200);
 assert.equal((await get(origin+'/Testing/books/unknown.pdf?download=1')).status,404);
 const report=await get(origin+'/Testing/downloads.json');assert.equal(report.status,200);assert.equal(report.headers.get('Cache-Control'),'private, no-store');const json=await report.json();assert.equal(json.scope,'private-testing');assert.deepEqual(json.books.find(b=>b.id==='art-of-attention').sample,1);assert.equal(json.books.find(b=>b.id==='art-of-attention').full,2);assert.equal(json.books.find(b=>b.id==='life-secrets').full,0);
 assert.equal(env.DB.rows().length,2);assert.ok(env.DB.rows().every(row=>!('email' in row)&&!('ip' in row)));
 assert.equal((await h(new Request(origin+'/Testing/downloads'),env)).status,401);
 assert.equal((await h(new Request(origin+'/Testing/downloads.json',{headers:{...auth,'oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
});
test('decryption or recording errors cannot create a successful unrecorded attachment',async()=>{
 const {env,handler:h}=await fixture(),url=origin+'/Testing/books/art-of-attention-sample.pdf?download=1';
 const badKey=await h(new Request(url,{headers:auth}),{...env,PREVIEW_CONTENT_KEY:randomBytes(32).toString('base64')});assert.equal(badKey.status,503);assert.equal(env.DB.rows().length,0);
 const noDB={...env,DB:undefined};assert.equal((await h(new Request(url,{headers:auth}),noDB)).status,503);
 assert.equal((await h(new Request(url.split('?')[0],{headers:auth}),noDB)).status,200);
 assert.equal((await h(new Request(origin+'/Testing/downloads.json',{headers:auth}),noDB)).status,503);
});

test('free anthology has its own per-book download count',async()=>{const {env,handler}=await fixture();const r=await handler(new Request(origin+'/Testing/books/sneakpeak-ideas.pdf?download=1',{headers:auth}),env);assert.equal(r.status,200);const report=await handler(new Request(origin+'/Testing/downloads.json',{headers:auth}),env);const book=(await report.json()).books.find(b=>b.id==='sneakpeak-ideas');assert.equal(book.full,1);assert.equal(book.sample,0);});
