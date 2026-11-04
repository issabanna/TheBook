const test=require('node:test');
test('Testing catalogue has 17 complete previews, distinct categories, correct prices and book-specific checkout actions',()=>{
const {parseHTML}=require('linkedom');const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/testing-next.html','utf8'),{window}=parseHTML(html),document=window.document;
window.HTMLElement.prototype.getBoundingClientRect=function(){return {height:600,width:200}};window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.showModal=function(){this.open=true};window.HTMLElement.prototype.close=function(){this.open=false};
let current=new URL('https://oportals.com/Testing');const location={get pathname(){return current.pathname},get hash(){return current.hash},get origin(){return current.origin},set href(v){current=new URL(v,current)},get href(){return current.href},assign(v){current=new URL(v,current)}};
const storage=new Map(),events=[];const history={pushState(a,b,url){current=new URL(url,current)},replaceState(a,b,url){current=new URL(url,current)}};
window.scrollTo=()=>{};window.location=location;
const ctx={window,document,location,history,URL,URLSearchParams,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async(url,options)=>{events.push({url,options});return {ok:true}},requestAnimationFrame:f=>{f();return 1},cancelAnimationFrame:()=>{},setTimeout,clearTimeout};vm.createContext(ctx);
for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],ctx,{timeout:5000});
const run=s=>vm.runInContext(s,ctx),visible=()=>[...document.querySelectorAll('#bookshelf>.product')].filter(x=>!x.hidden);





assert.equal(document.querySelector('#free-book'),null);
assert.equal(document.querySelector('.book-filters [data-filter="free"]'),null);
assert.equal(document.querySelector('.header a[href$="#free-book"]'),null);
assert.equal(document.querySelectorAll('.hero .hero-actions a').length,2);
assert.equal(document.querySelector('#faq').textContent.includes('SneakPeak Ideas'),false);
assert.equal(document.querySelector('#bookshelf a[href$="/book/sneakpeak-ideas"]'),null);
assert.equal(document.querySelectorAll('#editorial-feature').length,1);
assert.equal(document.querySelector('#reader-reviews').hidden,false);
assert.equal(document.querySelectorAll('.reader-feedback-grid article').length,4);
assert.equal(document.querySelectorAll('#editorial-feature img').length,2);
const suppliedReviews=JSON.parse(fs.readFileSync('src/reader-reviews.json','utf8'));
for(const review of suppliedReviews){const card=document.querySelector('#reader-reviews a[href="/Testing/book/'+review.slug+'"]').closest('article');assert.equal(card.querySelector('blockquote').textContent,review.quote);assert.ok(!card.textContent.includes('Verified'));}

for(const [filter,n]of [['original',10],['inspired',7],['all',17]]){run(`filterShelf('${filter}')`);assert.equal(visible().length,n)}
for(const [slug,price]of Object.entries(run('bookPrices'))){
 history.pushState({},'','/Testing/book/'+slug);run('routeView()');
 assert.ok(document.querySelector('#book-detail a[data-purchase="'+slug+'"][href="/checkout?book='+slug+'"]'));
 assert.equal(document.querySelectorAll('#book-detail .actual-page-grid figure').length,3);assert.ok(document.querySelector('.detail-price').textContent.includes('$'+price));
 assert.ok([...document.querySelectorAll('#book-detail .actual-page-grid img')].every(img=>img.getAttribute('src').startsWith('/Testing/media/')));
 assert.ok(document.querySelector('#book-structured-data').textContent.includes(price));
 assert.ok(!document.querySelector('.editorial-owner-review'));
 const review=suppliedReviews.find(r=>r.slug===slug);if(review)assert.equal(document.querySelector('#book-detail .book-reader-review blockquote').textContent,review.quote);else assert.equal(document.querySelector('#book-detail .book-reader-review'),null);
}
window.OPORTALS_OWNER=true;history.pushState({},'','/Testing/book/art-of-attention');run('routeView()');assert.ok(document.querySelector('.editorial-owner-review a[href="/Testing/books/art-of-attention.pdf?download=1"]'));
const close=document.querySelector('#close-book-review');close.dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
const fresh=JSON.parse(fs.readFileSync('src/testing-catalogue.json','utf8'));
for(const b of fresh){
 history.pushState({},'','/Testing/book/'+b.slug);run('routeView()');
 assert.equal(document.querySelectorAll('#book-detail .actual-page-grid figure').length,3,b.slug);
 assert.ok(document.querySelector('.detail-price').textContent.includes('$7.99'),b.slug);
 assert.ok(document.querySelector('.detail-small').textContent.includes('22 pages'),b.slug);
 assert.equal(document.querySelector('#book-detail a[data-purchase]').getAttribute('href'),'/checkout?book='+b.slug,b.slug);assert.equal(document.querySelector('#book-detail .book-reader-review'),null,b.slug);
 assert.equal(document.querySelector('#book-detail button[disabled]'),null,b.slug);
 assert.ok(document.querySelector('#book-detail a[href="'+b.pdf+'?download=1"]'),b.slug);
 assert.ok(document.querySelectorAll('#book-detail .actual-page-grid img').length===3);
 const meta=JSON.parse(document.querySelector('#book-structured-data').textContent);assert.equal(meta.numberOfPages,22);assert.equal(meta.offers.availability,'https://schema.org/InStock');
 if(b.category==='inspired')assert.ok(document.querySelector('.rights-note').textContent.includes(b.author));
}
run("filterShelf('all')");
for(const b of fresh){const card=[...document.querySelectorAll('#bookshelf .product')].find(c=>c.querySelector('a').getAttribute('href').endsWith('/'+b.slug));assert.ok(card);assert.equal(card.querySelector('a[data-purchase]').getAttribute('href'),'/checkout?book='+b.slug);assert.ok(card.textContent.includes('$7.99'));}
console.log('Testing UI verified: 10 Originals, 7 Reimagined, 17 cards; ten $7.99 complete editions with true three-page previews, owner PDF review, correct lengths/source credits, book-specific purchase actions; existing four payment links preserved.');

});
