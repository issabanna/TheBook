import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
import {BOOK_PRODUCTS,SITE_URL} from '../src/payment.mjs';

test('published book images stay frozen when a Testing image changes',async()=>{
 const encode=s=>Buffer.from(s).toString('base64');
 const h=createHandler({publishedDraft:true,testing:{liveStorefront:true,publicPreview:true,keyEnv:'PREVIEW_V5_KEY'},publishedMedia:{'editorial-page.webp':encode('approved image')},draftMedia:{'editorial-page.webp':encode('next draft image')}});
 const env={PREVIEW_V5_KEY:'configured'};
 assert.equal(await (await h(new Request(SITE_URL+'/media/editorial-page.webp'),env)).text(),'approved image');
 assert.equal(await (await h(new Request(SITE_URL+'/Testing/media/editorial-page.webp'),env)).text(),'next draft image');
 assert.equal(await (await h(new Request(SITE_URL+'/media/editorial-page.webp',{method:'HEAD'}),env)).text(),'');
});

test('approved editions stay separate from later drafts and verified purchases deliver the approved book',async()=>{
 const secret=randomBytes(32).toString('base64');
 const key=await crypto.subtle.importKey('raw',Buffer.from(secret,'base64'),'AES-GCM',false,['encrypt']);
 const seal=async text=>{const iv=crypto.getRandomValues(new Uint8Array(12));return {keyEnv:'PREMIUM_EIGHTY_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text))).toString('base64')};};
 const env={PREVIEW_V5_KEY:'configured',PREMIUM_EIGHTY_KEY:secret,PAYPAL_PDT_TOKEN:'mock-verifier',PAYPAL_RECEIVER_EMAIL:'seller@example.com',BOOK_ENCRYPTION_KEY:secret,DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64')};
 const approved={},draft={},products=Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service);
 for(const [id,b] of products){approved[b.file]=await seal('approved:'+id);draft[b.file]=await seal('next draft:'+id);approved[b.file.replace('.pdf','-sample.pdf')]=await seal('approved sample:'+id);draft[b.file.replace('.pdf','-sample.pdf')]=await seal('next sample:'+id);}
 const assets={publishedDraft:true,testing:{liveStorefront:true,publicPreview:true,temporaryDownloads:false,keyEnv:'PREVIEW_V5_KEY'},completedBooks:approved,testingEditionBooks:draft};
 for(const [id,b] of products){
  const tx='APPROVED12345678';
  const p=new URLSearchParams({payment_status:'Completed',mc_currency:'USD',mc_gross:b.price,receiver_email:env.PAYPAL_RECEIVER_EMAIL,txn_id:tx,item_name:b.title,item_number:b.sku});
  const h=createHandler(assets,async()=>new Response('SUCCESS\n'+p.toString().split('&').join('\n')));
  const sample=b.file.replace('.pdf','-sample.pdf');
  assert.equal(await (await h(new Request(SITE_URL+'/books/'+sample),env)).text(),'approved sample:'+id);
  assert.equal(await (await h(new Request(SITE_URL+'/Testing/books/'+sample),env)).text(),'next sample:'+id);
  assert.equal((await h(new Request(SITE_URL+'/books/'+b.file),env)).status,401);
  const verify=await h(new Request(SITE_URL+'/api/paypal/verify',{method:'POST',headers:{origin:SITE_URL,'Content-Type':'application/json'},body:JSON.stringify({transaction:tx})}),env);
  assert.equal(verify.status,200);const {download}=await verify.json();
  assert.equal(await (await h(new Request(SITE_URL+download),env)).text(),'approved:'+id);
  const unverified=createHandler(assets,async()=>new Response('FAIL'));
  assert.equal((await unverified(new Request(SITE_URL+download),env)).status,403);
 }
});
