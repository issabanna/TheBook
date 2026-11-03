import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHandler} from '../src/worker.mjs';
const catalogue=JSON.parse(readFileSync('src/testing-catalogue.json','utf8')),origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
test('unpublished catalogue drafts stay on Testing and complete PDFs require owner access',async()=>{
 const raw=crypto.getRandomValues(new Uint8Array(32)),key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']),pdf=new TextEncoder().encode('%PDF-1.7\nTesting fixture\n%%EOF'),records={},media={};
 for(const b of catalogue){for(const suffix of ['.pdf','-sample.pdf']){const iv=crypto.getRandomValues(new Uint8Array(12));records[b.slug+suffix]={keyEnv:'TESTING_CATALOGUE_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,pdf)).toString('base64')};}media[b.cover.split('/').pop()]=Buffer.from('RIFF webp fixture').toString('base64');}
 const env={PREVIEW_V5_KEY:'fixture',TESTING_CATALOGUE_KEY:Buffer.from(raw).toString('base64'),PREVIEW_OWNER_EMAIL:'owner@example.com'},h=createHandler({testing:{keyEnv:'PREVIEW_V5_KEY',publicPreview:true,liveStorefront:true},publishedDraft:true,testingDraft:'<script></script><body>Testing</body>',liveDraft:'<script></script><body>Live</body>',testingEditionBooks:records,draftMedia:media});
 const promoted=createHandler({testing:{keyEnv:'PREVIEW_V5_KEY',publicPreview:true,liveStorefront:true},publishedDraft:true,testingDraft:'<script></script><body>Testing</body>',liveDraft:'<script></script><body>Published</body>',testingEditionBooks:records,completedBooks:records,draftMedia:media,publishedMedia:media});
 for(const b of catalogue){
  assert.equal((await promoted(new Request(origin+'/book/'+b.slug),env)).status,200);
  assert.equal((await promoted(new Request(origin+'/books/'+b.slug+'.pdf'),env)).status,401);
  const paidReview=await promoted(new Request(origin+'/books/'+b.slug+'.pdf',{headers:auth}),env);assert.equal(paidReview.status,200);assert.deepEqual(new Uint8Array(await paidReview.arrayBuffer()),pdf);
  const sample=await promoted(new Request(origin+'/books/'+b.slug+'-sample.pdf'),env);assert.equal(sample.status,200);assert.deepEqual(new Uint8Array(await sample.arrayBuffer()),pdf);
  assert.equal((await promoted(new Request(origin+b.cover.replace('/Testing','')),env)).status,200);
  assert.equal((await promoted(new Request(origin+'/checkout/'+b.slug),env)).status,404);
  assert.equal((await h(new Request(origin+'/Testing/book/'+b.slug),env)).status,200);
  for(const suffix of ['.pdf','-sample.pdf']){
   const path='/Testing/books/'+b.slug+suffix,sample=suffix.includes('sample');assert.equal((await h(new Request(origin+path),env)).status,sample?200:401);
   const r=await h(new Request(origin+path,{headers:auth}),env);assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),pdf);
   assert.equal((await h(new Request(origin+path.replace('/Testing',''),{headers:auth}),env)).status,404);
  }
  assert.equal((await h(new Request(origin+b.cover),env)).status,200);assert.equal((await h(new Request(origin+b.cover.replace('/Testing','')),{...env})).status,404);
  assert.equal((await h(new Request(origin+'/book/'+b.slug,{headers:auth}),env)).status,404);
  assert.equal((await h(new Request(origin+'/Testing/checkout/'+b.slug,{headers:auth}),env)).status,404);
 }
});
test('approved catalogue editions and actual preview media are included in the published snapshot',()=>{
 assert.equal(catalogue.length,10);assert.equal(catalogue.filter(b=>b.category==='original').length,4);assert.equal(catalogue.filter(b=>b.category==='inspired').length,6);
 const testing=JSON.parse(readFileSync('src/encrypted-testing-editions.json','utf8')),published=JSON.parse(readFileSync('src/encrypted-published-editions.json','utf8')),live=readFileSync('public/published-storefront.html','utf8');
 for(const [name,record] of Object.entries(published))assert.deepEqual(testing[name],record,name+' unchanged');
 for(const b of catalogue){assert.equal(b.price,7.99);assert.equal(b.pageCount,22);assert.equal(b.actualPages.length,4);assert.equal(b.checkoutPending,true);assert.equal(b.completed,true);assert.ok(live.includes(b.title));
  for(const p of b.actualPages){const data=readFileSync('public/editorial-media/'+p.src.split('/').pop());assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');}
  for(const suffix of ['.pdf','-sample.pdf'])assert.equal(testing[b.slug+suffix].keyEnv,'TESTING_CATALOGUE_KEY');
 }
});
