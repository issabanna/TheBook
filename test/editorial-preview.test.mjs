import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com';
const owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
async function fixture(previewKeyEnv='PREMIUM_EIGHTY_KEY'){
 const publishedKey=randomBytes(32).toString('base64'),previewKey=randomBytes(32).toString('base64');
 async function seal(value,key,keyEnv){const iv=crypto.getRandomValues(new Uint8Array(12)),k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);return {keyEnv,iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(value))).toString('base64')}}
 const published=await seal('%PDF Published edition',publishedKey,'PREVIEW_V3_KEY'),revised=await seal('%PDF Revised Testing edition',previewKey,previewKeyEnv);
 const assets={publishedDraft:true,liveDraft:'<h1>Live</h1><script></script>',testingDraft:'<h1>Testing</h1><script></script>',testing:{...published,publicPreview:true,liveStorefront:true,temporaryDownloads:false},completedBooks:{'art-of-attention.pdf':published,'art-of-attention-sample.pdf':published},testingEditionBooks:{'art-of-attention.pdf':revised,'art-of-attention-sample.pdf':revised}};
 return {handler:createHandler(assets),env:{PREVIEW_V3_KEY:publishedKey,[previewKeyEnv]:previewKey,PREVIEW_OWNER_EMAIL:'owner@example.com'}};
}
test('editorial PDF preview is isolated to Testing and keeps the paid-file owner boundary',async()=>{
 const {handler:h,env}=await fixture();
 assert.equal(await (await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Revised Testing edition');
 assert.equal(await (await h(new Request(origin+'/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Published edition');
 assert.equal((await h(new Request(origin+'/Testing/books/art-of-attention.pdf'),env)).status,401);
 assert.equal((await h(new Request(origin+'/books/art-of-attention.pdf'),env)).status,401);
 assert.equal(await (await h(new Request(origin+'/Testing/books/art-of-attention.pdf',{headers:owner}),env)).text(),'%PDF Revised Testing edition');
 assert.equal(await (await h(new Request(origin+'/books/art-of-attention.pdf',{headers:owner}),env)).text(),'%PDF Published edition');
});
test('a missing revised-edition key fails closed instead of returning another book edition',async()=>{
 const {handler:h,env}=await fixture();delete env.PREMIUM_EIGHTY_KEY;
 assert.equal((await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf'),env)).status,503);
 assert.equal(await (await h(new Request(origin+'/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Published edition');
});
test('the complete social-theme collection uses its separate key and leaves the published edition intact',async()=>{
 const {handler:h,env}=await fixture('PREMIUM_COLLECTION_KEY');
 assert.equal(await (await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Revised Testing edition');
 assert.equal(await (await h(new Request(origin+'/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Published edition');
 delete env.PREMIUM_COLLECTION_KEY;
 assert.equal((await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf'),env)).status,503);
 assert.equal(await (await h(new Request(origin+'/books/art-of-attention-sample.pdf'),env)).text(),'%PDF Published edition');
});
