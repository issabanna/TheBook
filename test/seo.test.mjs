import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {buildSeoPages} from '../scripts/build-seo-pages.mjs';
import {createHandler} from '../src/worker.mjs';
import {applyPageSeo} from '../src/seo.mjs';
const raw=readFileSync('public/published-storefront.html','utf8'),seo=buildSeoPages(raw,{live:true}),draft=buildSeoPages(readFileSync('public/testing-next.html','utf8'));
const origin='https://oportals.com',env={PREVIEW_V5_KEY:'configured'},handler=createHandler({testing:{liveStorefront:true,publicPreview:true,keyEnv:'PREVIEW_V5_KEY'},publishedDraft:true,liveDraft:raw,testingDraft:readFileSync('public/testing-next.html','utf8'),seo:{live:seo,testing:draft},completedBooks:Object.fromEntries(Object.keys(seo.pages).filter(p=>p.startsWith('/book/')).map(p=>[p.split('/').pop()+'.pdf',{}])),seoNavigation:readFileSync('public/seo-navigation.js','utf8'),socialMirrorPublished:readFileSync('public/social-mirror-published.html','utf8'),socialMirror:readFileSync('public/social-mirror-shell.html','utf8')});
const request=path=>handler(new Request(origin+path),env);
test('all 29 public pages have unique server-delivered metadata, canonical URLs and valid structured data',async()=>{
 const titles=new Set();
 for(const [path,meta] of Object.entries(seo.pages)){
  const r=await request(path);assert.equal(r.status,200,path);const {document}=parseHTML(await r.text());
  assert.equal(document.title,meta.title);assert.ok(!titles.has(meta.title),path);titles.add(meta.title);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1);assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'),origin+path);
  assert.ok(document.querySelector('meta[name="description"]').content.length>=50);assert.match(document.querySelector('meta[name="robots"]').content,/^index,follow/);
  const data=JSON.parse(document.getElementById('seo-structured-data').textContent);assert.equal(data['@context'],'https://schema.org');assert.ok(data['@graph'].length>=2);
  assert.equal(document.querySelector('meta[property="og:url"]').content,origin+path);assert.equal(document.querySelector('meta[name="twitter:card"]').content,'summary_large_image');
  assert.ok(existsSync('public/published-editorial-media/'+meta.image.split('/').pop()),path);
  if(meta.view==='book'){
   assert.equal(document.querySelector('#book-detail h1').textContent,data['@graph'][1].name);assert.ok(document.querySelector('section#book-review:not([hidden])'));assert.ok(document.querySelector('#home-content[hidden]'));assert.ok(document.querySelector('#book-detail a[data-purchase]'));
   const offer=data['@graph'][1].offers;assert.equal(offer.priceCurrency,'USD');assert.equal(offer.availability,'https://schema.org/InStock');assert.ok(['7.99','8.99','9.99'].includes(offer.price));assert.equal(document.querySelectorAll('#book-detail .actual-page-grid img').length,3);
  }
  if(meta.view==='ideas'){assert.ok(document.querySelector('#ideas-view:not([hidden])'));assert.ok(document.querySelector('#weekly-content article'));}
 }
 assert.equal(titles.size,29);const {document}=parseHTML(await(await request('/')).text());assert.equal(document.querySelectorAll('#bookshelf .product').length,17);
});
test('sitemap contains only public canonical URLs; Testing and personal Mirror links stay noindex',async()=>{
 const xml=await(await request('/sitemap.xml')).text(),urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);assert.equal(urls.length,29);assert.equal(new Set(urls).size,29);
 assert.ok(urls.every(url=>url.startsWith(origin+'/')));assert.ok(urls.every(url=>!/(Testing|checkout|Sessions|Visits|\.pdf|ref=|manage=)/.test(url)));
 const robots=await(await request('/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/oportals.com\/sitemap.xml/);assert.match(robots,/Disallow: \/Testing/);assert.match(robots,/Disallow: \/checkout/);
 for(const path of ['/Testing','/Testing/book/life-secrets','/Testing/ideas/choices','/Testing/SocialMirror','/SocialMirror?ref=private-id','/SocialMirror?manage=private-id','/SocialMirror?payment=1']){
  const r=await request(path);assert.match(r.headers.get('X-Robots-Tag'),/noindex/,path);const {document}=parseHTML(await r.text());assert.match(document.querySelector('meta[name="robots"]').content,/noindex/);
 }
 const head=await handler(new Request(origin+'/book/life-secrets',{method:'HEAD'}),env);assert.equal(head.status,200);assert.ok(!head.headers.get('X-Robots-Tag')?.includes('noindex'));assert.equal(await head.text(),'');
 const redirect=await request('/book/life-secrets/');assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),origin+'/book/life-secrets');assert.equal((await request('/ideas/unknown')).status,404);
});
test('prerendered book landing pages stay inline and journal navigation updates metadata',async()=>{
 const html=await(await request('/book/art-of-attention')).text(),{window,document}=parseHTML(html);let current=new URL(origin+'/book/art-of-attention'),modalCalls=0;
 Object.defineProperty(window.HTMLElement.prototype,'open',{get(){return this.hasAttribute('open')},set(v){v?this.setAttribute('open',''):this.removeAttribute('open')},configurable:true});
 window.HTMLElement.prototype.showModal=function(){assert.ok(!this.open,'An already-open non-modal dialog cannot use showModal');modalCalls++;this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false};
 window.HTMLElement.prototype.getBoundingClientRect=()=>({height:200,width:200});window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.focus=()=>{};window.scrollTo=()=>{};
 const location={get pathname(){return current.pathname},get hash(){return current.hash},get search(){return current.search},get href(){return current.href},get origin(){return current.origin},assign(value){current=new URL(value,current)}};
 const history={pushState(_a,_b,value){current=new URL(value,current)},replaceState(_a,_b,value){current=new URL(value,current)}};window.location=location;
 const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}},ctx=vm.createContext({window,document,location,history,URL,URLSearchParams,console,localStorage:storage,sessionStorage:storage,fetch:async()=>({ok:false}),setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}});
 for(const script of document.querySelectorAll('script'))if(!script.src&&!['application/json','application/ld+json'].includes(script.type))vm.runInContext(script.textContent,ctx,{timeout:5000});
 vm.runInContext(readFileSync('public/seo-navigation.js','utf8'),ctx);
 assert.equal(modalCalls,0);assert.equal(document.querySelector('#book-review').hidden,false);assert.equal(document.title,seo.pages['/book/art-of-attention'].title);
 for(const topic of ['choices','leadership','meaning','attention']){
  history.pushState({},'','/ideas/'+topic);vm.runInContext('routeView()',ctx);assert.equal(document.title,seo.pages['/ideas/'+topic].title);assert.equal(document.querySelector('#weekly-content h3').textContent,seo.pages['/ideas/'+topic].heading);assert.ok(document.querySelector('#book-review').hidden);
 }
 history.pushState({},'','/');vm.runInContext('routeView()',ctx);assert.equal(document.title,seo.pages['/'].title);assert.equal(document.querySelector('meta[property="og:url"]').content,origin+'/');
});
test('SEO values escape markup and structured data cannot close a script element',()=>{
 const meta={...seo.pages['/'],title:'A < B & "C"',graph:{text:'</script><img src=x onerror=alert(1)>'}};const html=applyPageSeo('<html><head></head><body></body></html>',meta),{document}=parseHTML(html);assert.equal(document.title,meta.title);assert.ok(!document.querySelector('img'));assert.deepEqual(JSON.parse(document.querySelector('#seo-structured-data').textContent),meta.graph);
});
