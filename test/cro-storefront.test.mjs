import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';import {buildSeoPages} from '../scripts/build-seo-pages.mjs';import {createHandler} from '../src/worker.mjs';import {BOOK_PRODUCTS} from '../src/payment.mjs';
const raw=readFileSync('public/published-storefront.html','utf8'),seo=buildSeoPages(raw,{live:true}),origin='https://oportals.com';
const records=Object.fromEntries(Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service).map(([,b])=>[b.file,{keyEnv:'ARTWORK_COLLECTION_KEY'}]));
const h=createHandler({testing:{liveStorefront:true,publicPreview:true,keyEnv:'PREVIEW_V5_KEY'},liveDraft:raw,testingDraft:raw,publishedDraft:true,completedBooks:records,seo:{live:seo,testing:seo},commerceProducts:Object.fromEntries(Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service).map(([id,b])=>[id,{title:b.title,price:b.price}]))});
const env={PREVIEW_V5_KEY:'fixture',ARTWORK_COLLECTION_KEY:'configured'};
test('homepage explains the actual digital format and offers a real featured cover and free preview',async()=>{
 const {document}=parseHTML(await(await h(new Request(origin+'/'),env)).text());assert.match(document.querySelector('.cro-hero .eyebrow').textContent,/English PDFs/);assert.match(document.querySelector('.cro-hero h1').textContent,/Big ideas/);assert.equal(document.querySelector('.cro-hero .secrets-buy').getAttribute('href'),'/#books');assert.equal(document.querySelector('.cro-hero [data-sample]').getAttribute('href'),'/book/art-of-attention#inside-book');assert.match(document.querySelector('.cro-featured-book img').getAttribute('src'),/editorial-art-of-attention-cover/);assert.match(document.querySelector('.cro-featured-book').textContent,/8.99/);assert.equal(document.querySelectorAll('#bookshelf .product').length,17);assert.ok(!document.querySelector('#bookshelf').textContent.includes('In reader validation'));
});
test('all 17 book landing pages show the selected real price, readable previews, delivery and relevant recommendations',async()=>{
 for(const [slug,product] of Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service)){
  const r=await h(new Request(origin+'/book/'+slug),env);assert.equal(r.status,200);const {document}=parseHTML(await r.text()),detail=document.querySelector('#book-detail');assert.ok(document.querySelector('section#book-review:not([hidden])'));assert.ok(!document.querySelector('dialog#book-review'));assert.ok(document.querySelector('#home-content[hidden]'));assert.match(detail.querySelector('.cro-delivery').textContent,/English PDF/);assert.match(detail.querySelector('.cro-book-bar').textContent,new RegExp(product.price.replace('.','\\.')));
  for(const a of detail.querySelectorAll('[data-purchase]')){assert.equal(a.getAttribute('data-purchase'),slug);assert.equal(a.getAttribute('href'),'/checkout?book='+slug);assert.match(a.textContent.toLowerCase(),/get this book/);}
  assert.equal(detail.querySelectorAll('.actual-page-grid figure:not([hidden])').length,2);assert.equal(detail.querySelector('.detail-actions [data-sample]').getAttribute('href'),'#inside-book');assert.equal(detail.querySelectorAll('.cro-related-grid>a').length,3);for(const a of detail.querySelectorAll('.cro-related-grid>a'))assert.notEqual(a.getAttribute('href'),'/book/'+slug);
 }
});
test('checkout stops before redirect when a published file key is missing',async()=>{
 const r=await h(new Request(origin+'/checkout?book=art-of-attention'),{PREVIEW_V5_KEY:'fixture',PAYPAL_PDT_TOKEN:'fixture',PAYPAL_RECEIVER_EMAIL:'seller@example.com',BOOK_ENCRYPTION_KEY:'fixture',DOWNLOAD_SIGNING_KEY:'fixture'});assert.equal(r.status,503);assert.match(await r.text(),/No payment has been taken here/);assert.equal(r.headers.get('Location'),null);
});
test('responsive CSS preserves touch targets and avoids a book-preview overlay',()=>{
 const css=readFileSync('public/cro-storefront.css','utf8');assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/@media\(max-width:370px\)/);assert.match(css,/min-height:48px/);assert.match(css,/#book-review\.book-landing\{position:static/);assert.match(css,/\.actual-page-grid\{grid-template-columns:1fr/);
});
