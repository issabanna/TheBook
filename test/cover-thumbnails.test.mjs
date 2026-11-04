import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
import {buildSeoPages} from '../scripts/build-seo-pages.mjs';
import {parseHTML} from 'linkedom';
const origin='https://oportals.com',variants=JSON.parse(readFileSync('public/cover-thumbnails.json','utf8'));
test('all 18 approved covers and smaller variants exist with content-versioned URLs',()=>{
 assert.equal(Object.keys(variants).length,18);let original=0,small=0;
 for(const [source,v] of Object.entries(variants))for(const folder of ['public/published-editorial-media','public/editorial-media']){
  const name=source.split('/').at(-1),thumb=new URL(v.thumb,origin),file=folder+'/'+thumb.pathname.split('/').at(-1);assert.ok(existsSync(folder+'/'+name));assert.ok(existsSync(file));const bytes=readFileSync(file);assert.equal(thumb.searchParams.get('v'),createHash('sha256').update(bytes).digest('hex').slice(0,20));assert.ok(bytes.length<v.originalBytes);
  if(folder.includes('published')){original+=v.originalBytes;small+=bytes.length;}
 }
 assert.ok(small<original*.5,'Cover default downloads should more than halve their total size');
});
test('published artwork is public, cacheable and conditional without private keys; paid PDFs remain protected',async()=>{
 const data=Buffer.from('public-webp-fixture').toString('base64'),h=createHandler({publishedMedia:{'cover.webp':data,'paid.pdf':data},mediaVersions:{live:{'cover.webp':{version:'contentv1',etag:'"exact-hash"'}}}});
 let r=await h(new Request(origin+'/media/cover.webp?v=contentv1'),{});assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/public, max-age=31536000, immutable/);assert.equal(r.headers.get('Vary'),null);assert.equal(await r.text(),'public-webp-fixture');
 r=await h(new Request(origin+'/media/cover.webp?v=contentv1',{headers:{'If-None-Match':'"exact-hash"'}}),{});assert.equal(r.status,304);assert.equal(await r.text(),'');
 r=await h(new Request(origin+'/media/cover.webp'),{});assert.match(r.headers.get('Cache-Control'),/max-age=3600/);assert.ok(!r.headers.get('Cache-Control').includes('immutable'));
 r=await h(new Request(origin+'/media/cover.webp?artwork-retry=1'),{});assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.equal((await h(new Request(origin+'/media/cover.webp',{method:'HEAD'}),{})).status,200);assert.equal((await h(new Request(origin+'/media/cover.webp',{method:'POST'}),{})).status,405);assert.notEqual((await h(new Request(origin+'/media/paid.pdf'),{})).status,200);assert.notEqual((await h(new Request(origin+'/books/art-of-attention.pdf'),{})).status,200);
});
test('Testing artwork preserves preview authorization and uses private browser caching',async()=>{
 const h=createHandler({testing:{publicPreview:true,keyEnv:'PREVIEW_V5_KEY'},testingDraft:'fixture',draftMedia:{'cover.webp':Buffer.from('public-art').toString('base64')},mediaVersions:{testing:{'cover.webp':{version:'v1',etag:'"hash"'}}}});
 assert.equal((await h(new Request(origin+'/Testing/media/cover.webp'),{})).status,503);
 const r=await h(new Request(origin+'/Testing/media/cover.webp'),{PREVIEW_V5_KEY:'configured'});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, max-age=300');
});
test('book page covers and recommendations use responsive thumbnails, with full-size originals available',()=>{
 const seo=buildSeoPages(readFileSync('public/published-storefront.html','utf8'),{live:true}),html=seo.pages['/book/stand-out-for-something'].fragments['book-detail'],{document}=parseHTML(html);
 const cover=document.querySelector('.detail-cover img');assert.match(cover.getAttribute('src'),/-thumb-320.webp\?v=/);assert.match(cover.getAttribute('srcset'),/ 320w, .*stand-out-for-something-cover.webp\?v=.* 651w/);assert.ok(cover.getAttribute('sizes'));
 for(const image of document.querySelectorAll('.cro-related-grid img')){assert.match(image.getAttribute('src'),/-thumb-320.webp\?v=/);assert.equal(image.getAttribute('sizes'),'60px');}
});
