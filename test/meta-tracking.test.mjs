import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createHandler} from '../src/worker.mjs';
import {BOOK_PRODUCTS} from '../src/payment.mjs';
import {metaConsent,recordMetaCheckout,recordMetaPurchase,deliverMetaPurchases,metaTrackingStatus} from '../src/meta.mjs';
import {recordVerifiedPurchase} from '../src/conversions.mjs';
const origin='https://oportals.com',sid='2d497839-c584-4712-84e8-0c14fb93d365';
function database(){
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
 return {sql,prepare(query){let args=[];return {bind(...values){args=values;return this;},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};},async all(){return {results:sql.prepare(query).all(...args)};}};}};
}
const paid=(id,changes={})=>new URLSearchParams({txn_id:id,payment_status:'Completed',mc_currency:'USD',mc_gross:'8.99',receiver_email:'seller@example.com',payer_email:'NEVER-SEND@example.com',payment_date:new Date().toISOString(),item_name:'The Art of Attention',...changes});
const jsonRequest=(path,data,cookie='')=>new Request(origin+path,{method:'POST',headers:{origin,'Content-Type':'application/json',cookie},body:JSON.stringify(data)});
async function fixture(){
 const DB=database(),env={DB,DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64'),PAYPAL_PDT_TOKEN:'mock-pdt',PAYPAL_RECEIVER_EMAIL:'seller@example.com',BOOK_ENCRYPTION_KEY:randomBytes(32).toString('base64'),ARTWORK_COLLECTION_KEY:randomBytes(32).toString('base64'),SHARED_BOOK_CHECKOUT_FROM:new Date(Date.now()-60000).toISOString(),META_TRACKING_ENABLED:'true',META_CAPI_ACCESS_TOKEN:'mock-secret-never-public',META_PURCHASES_FROM:new Date(Date.now()-60000).toISOString()},payments=new Map(),metaRequests=[],files={};
 const key=await crypto.subtle.importKey('raw',Buffer.from(env.ARTWORK_COLLECTION_KEY,'base64'),'AES-GCM',false,['encrypt']);
 for(const [book,b] of Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service)){const iv=crypto.getRandomValues(new Uint8Array(12));files[b.file]={keyEnv:'ARTWORK_COLLECTION_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('PDF:'+book))).toString('base64')};}
 const f={DB,env,payments,metaRequests,metaFailure:false};
 f.fetcher=async(url,options)=>{
  if(url==='https://graph.facebook.com/v26.0/4490808921236945/events'){
   metaRequests.push({url,headers:options.headers,body:JSON.parse(options.body)});
   return f.metaFailure?new Response(JSON.stringify({error:{code:190,message:'secret error must not be stored'}}),{status:400}):new Response(JSON.stringify({events_received:1,messages:[],fbtrace_id:'MOCK-ONLY'}));
  }
  if(url.includes('ipnpb.'))return new Response('VERIFIED');
  if(url.startsWith('https://www.paypal.com/cgi-bin/')||url.startsWith('https://www.sandbox.paypal.com/cgi-bin/')){const p=payments.get(new URLSearchParams(options.body).get('tx'));return new Response(p?'SUCCESS\n'+p.toString().split('&').join('\n'):'FAIL');}
  throw new Error('Unexpected outbound request in test');
 };
 f.h=createHandler({testing:{liveStorefront:true},completedBooks:files,socialMirrorPublished:'<body>Social Mirror</body>',commerceProducts:Object.fromEntries(Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service).map(([id,b])=>[id,{title:b.title,price:b.price}]))},f.fetcher);
 return f;
}
async function consent(f,changes={}){
 const response=await metaConsent(jsonRequest('/api/meta/consent',{consent:true,context:crypto.randomUUID(),session:sid,utm:{utm_source:'instagram',utm_medium:'paid_social',utm_campaign:'attention_cro'},fbp:'fb.1.1793819400000.12345',fbc:'fb.1.1793819400000.SAFECLICK',...changes}),f.env);
 assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
const verify=(tx,cookie='',checkout=null,book=null)=>jsonRequest('/api/paypal/verify',{transaction:tx,checkout,book},cookie);
const ipn=p=>new Request(origin+'/api/paypal/ipn',{method:'POST',body:p});
test('Meta consent is bounded, same-origin, separate from analytics and revocable',async()=>{
 const f=await fixture();
 assert.equal((await metaConsent(jsonRequest('/api/meta/consent',{consent:true,email:'forbidden'}),f.env)).status,400);
 assert.equal((await metaConsent(jsonRequest('/api/meta/consent',{consent:true,utm:{utm_campaign:'person@example.com'}}),f.env)).status,400);
 assert.equal((await metaConsent(jsonRequest('/api/meta/consent',{consent:true,fbp:'invalid'}),f.env)).status,400);
 assert.equal((await metaConsent(new Request(origin+'/api/meta/consent',{method:'POST',headers:{origin:'https://other.example','Content-Type':'application/json'},body:'{"consent":true}'}),f.env)).status,403);
 const cookie=await consent(f);assert.match(cookie,/^__Host-oportals-meta=/);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM meta_contexts').get().n,1);
 const off=await metaConsent(jsonRequest('/api/meta/consent',{consent:false},cookie),f.env);assert.equal(off.status,204);assert.match(off.headers.get('set-cookie'),/Max-Age=0/);assert.ok(f.DB.sql.prepare('SELECT revoked_at FROM meta_contexts').get().revoked_at);
 assert.equal((await metaConsent(jsonRequest('/Testing/api/meta/consent',{consent:true,context:crypto.randomUUID()}),f.env)).status,204);
});
test('verified Art of Attention purchase matches GA4 order, SKU, actual 8.99 USD, and PDF fulfillment',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='METAPAID1234567',p=paid(tx);f.payments.set(tx,p);
 assert.equal((await f.h(new Request(origin+'/checkout?book=art-of-attention',{headers:{cookie}}),f.env)).status,303);
 const response=await f.h(verify(tx,cookie),f.env);assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.purchase.value,8.99);assert.equal(data.purchase.currency,'USD');assert.equal(data.purchase.items[0].item_id,'art-of-attention');
 assert.equal(f.metaRequests.length,1);const event=f.metaRequests[0].body.data[0];assert.equal(event.event_name,'Purchase');assert.equal(event.event_id,data.purchase.transaction_id);assert.equal(event.custom_data.order_id,data.purchase.transaction_id);assert.equal(event.custom_data.value,data.purchase.value);assert.equal(event.custom_data.currency,data.purchase.currency);assert.deepEqual(event.custom_data.content_ids,[data.book]);assert.equal(event.custom_data.contents[0].item_price,data.purchase.items[0].price);
 assert.equal(new URL(event.event_source_url).searchParams.get('utm_campaign'),'attention_cro');assert.equal(event.user_data.fbc,'fb.1.1793819400000.SAFECLICK');assert.match(event.user_data.external_id[0],/^[a-f0-9]{64}$/);
 const publicData=JSON.stringify(data),outbound=JSON.stringify(f.metaRequests[0].body);for(const forbidden of [tx,'NEVER-SEND@example.com',f.env.META_CAPI_ACCESS_TOKEN,'receiver_email','payer_email','client_ip_address'])assert.ok(!outbound.includes(forbidden));assert.ok(!publicData.includes(f.env.META_CAPI_ACCESS_TOKEN));assert.equal(f.metaRequests[0].headers.Authorization,'Bearer '+f.env.META_CAPI_ACCESS_TOKEN);
 assert.equal(await(await f.h(new Request(origin+data.download),f.env)).text(),'PDF:art-of-attention');assert.equal(f.metaRequests.length,1,'PDF downloads cannot emit Purchase');
 assert.equal(JSON.parse(f.DB.sql.prepare('SELECT payload_json FROM meta_purchase_outbox').get().payload_json).user_data,undefined,'Matching identifiers are removed after acknowledgement');
});
test('receipt refresh, concurrent verified retries, downloads and repeated IPNs send one accepted event',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='METADUP12345678',p=paid(tx);f.payments.set(tx,p);await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');
 await Promise.all([f.h(verify(tx,cookie),f.env),f.h(verify(tx,cookie),f.env),f.h(verify(tx,cookie),f.env)]);
 assert.equal(f.metaRequests.length,1);await f.h(ipn(p),f.env);await f.h(ipn(p),f.env);await f.h(verify(tx,cookie),f.env);assert.equal(f.metaRequests.length,1);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM meta_purchase_outbox').get().n,1);
});
test('thank-you visits, cancelled checkout, previews, invalid payments and missing consent never create Purchase',async()=>{
 const f=await fixture(),cookie=await consent(f);
 await f.h(new Request(origin+'/paypal/return?cancelled=1',{headers:{cookie}}),f.env);await f.h(new Request(origin+'/checkout?book=art-of-attention',{headers:{cookie}}),f.env);await f.h(new Request(origin+'/Life-Secrets-Sample.pdf'),f.env);
 for(const [i,changes] of [{payment_status:'Pending'},{payment_status:'Refunded'},{mc_gross:'1.00'},{mc_currency:'EUR'},{receiver_email:'wrong@example.com'}].entries()){
  const tx='INVALIDMETA'+i+'12345';f.payments.set(tx,paid(tx,changes));assert.equal((await f.h(verify(tx,cookie),f.env)).status,403);
 }
 const tx='NOCONSENT12345';f.payments.set(tx,paid(tx));assert.equal((await f.h(verify(tx),f.env)).status,200);assert.equal(f.metaRequests.length,0);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM meta_purchase_outbox').get().n,0);
});
test('shared selected-book attribution survives webhook/return ordering and another campaign',async()=>{
 const f=await fixture(),cookie=await consent(f),book='the-space-before-yes',tx='METASHARED12345',p=paid(tx,{item_name:'Life Secrets',mc_gross:'7.99'});f.payments.set(tx,p);
 const start=await f.h(new Request(origin+'/checkout',{method:'POST',headers:{origin,cookie,'Content-Type':'application/x-www-form-urlencoded'},body:'book='+book}),f.env),html=await start.text();assert.equal(start.status,200);const token=JSON.parse(html.match(/sessionStorage\.setItem\("oportals-book-checkout",("[^"]+")\)/)[1]);
 await f.h(ipn(p),f.env);assert.equal(f.metaRequests.length,0,'Unallocated webhook is not guessed into a book');
 const result=await(await f.h(verify(tx,'',token),f.env)).json();assert.equal(result.book,book);assert.equal(f.metaRequests.length,1);const event=f.metaRequests[0].body.data[0];assert.deepEqual(event.custom_data.content_ids,[book]);assert.equal(event.custom_data.value,7.99);assert.equal(event.event_id,result.purchase.transaction_id);
 await f.h(ipn(p),f.env);assert.equal(f.metaRequests.length,1);
});
test('Meta errors do not block paid PDF; retries keep the same ID and redact raw errors',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='METARETRY123456';f.payments.set(tx,paid(tx));await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');f.metaFailure=true;
 const data=await(await f.h(verify(tx,cookie),f.env)).json();assert.ok(data.download);assert.equal(await(await f.h(new Request(origin+data.download),f.env)).text(),'PDF:art-of-attention');const first=f.metaRequests[0].body.data[0],row=f.DB.sql.prepare('SELECT * FROM meta_purchase_outbox').get();assert.equal(row.state,'pending');assert.equal(row.last_error_code,'http-400-meta-190');assert.ok(!JSON.stringify(row).includes('secret error'));
 await deliverMetaPurchases(f.env,{fetcher:f.fetcher});assert.equal(f.metaRequests.length,1,'Backoff prevents immediate duplicate attempts');f.metaFailure=false;f.DB.sql.prepare('UPDATE meta_purchase_outbox SET next_attempt_at=0').run();await Promise.all([deliverMetaPurchases(f.env,{fetcher:f.fetcher}),deliverMetaPurchases(f.env,{fetcher:f.fetcher})]);assert.equal(f.metaRequests.length,2);assert.deepEqual(f.metaRequests[1].body.data[0],first);assert.equal(f.DB.sql.prepare('SELECT state FROM meta_purchase_outbox').get().state,'sent');await deliverMetaPurchases(f.env,{fetcher:f.fetcher});assert.equal(f.metaRequests.length,2);
});
test('withdrawal and excluded sessions cancel queued events; old receipts cannot acquire new attribution',async()=>{
 for(const excluded of [false,true]){
  const f=await fixture(),cookie=await consent(f),tx='WITHDRAW1234567';f.payments.set(tx,paid(tx));await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');delete f.env.META_CAPI_ACCESS_TOKEN;await f.h(verify(tx,cookie),f.env);assert.equal(f.DB.sql.prepare('SELECT state FROM meta_purchase_outbox').get().state,'pending');
  if(excluded)f.DB.sql.prepare('INSERT INTO site_sessions(site,session_id,started_day,started_at,last_seen_at,country,city,timezone,source,first_page,last_page,stats_excluded) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('live',sid,'2026-11-04',new Date().toISOString(),new Date().toISOString(),'ZZ','','','instagram','/','/',1);
  else await metaConsent(jsonRequest('/api/meta/consent',{consent:false},cookie),f.env);
  f.env.META_CAPI_ACCESS_TOKEN='mock-secret';await deliverMetaPurchases(f.env,{fetcher:f.fetcher});assert.equal(f.metaRequests.length,0);assert.equal(f.DB.sql.prepare('SELECT state FROM meta_purchase_outbox').get().state,'dropped');
 }
 const f=await fixture(),cookie=await consent(f),old=paid('OLDMETAPAID1234',{payment_date:new Date(Date.now()-86400000).toISOString()});await recordVerifiedPurchase(old,'art-of-attention',f.env);await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');await recordMetaPurchase(old,'art-of-attention',f.env,new Request(origin+'/paypal/return',{headers:{cookie}}),{fetcher:f.fetcher});assert.equal(f.metaRequests.length,0);
});
test('sandbox Meta events require test mode/code and stay out of real purchases and GA4 payloads',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='SANDBOXMETA1234';f.env.PAYPAL_ENV='sandbox';f.env.META_TEST_MODE='true';f.env.META_TEST_EVENT_CODE='TEST10333';f.payments.set(tx,paid(tx,{test_ipn:'1'}));await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');
 const data=await(await f.h(verify(tx,cookie),f.env)).json();assert.ok(data.download);assert.equal(data.purchase,undefined);assert.equal(f.metaRequests.length,1);assert.equal(f.metaRequests[0].body.test_event_code,'TEST10333');assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM conversion_purchases').get().n,0);assert.equal(f.DB.sql.prepare('SELECT mode FROM meta_purchase_outbox').get().mode,'test');
 f.env.META_TEST_MODE='false';await recordMetaPurchase(paid('SANDBOXMETA9999',{test_ipn:'1'}),'art-of-attention',f.env,new Request(origin+'/paypal/return',{headers:{cookie}}),{fetcher:f.fetcher});assert.equal(f.metaRequests.length,1);
});
test('tracking stays disabled without activation, status/retry are owner-only, CSP is restricted and no secret is public',async()=>{
 const f=await fixture();assert.equal((await f.h(new Request(origin+'/Conversions/meta'),f.env)).status,401);assert.equal((await f.h(jsonRequest('/Conversions/meta/retry',{}),f.env)).status,401);const r=await f.h(new Request(origin+'/paypal/return'),f.env),html=await r.text(),csp=r.headers.get('Content-Security-Policy');assert.equal((html.match(/src="\/meta-pixel.js/g)||[]).length,1);assert.match(html,/meta-marketing-consent/);assert.ok(!html.includes(f.env.META_CAPI_ACCESS_TOKEN));assert.match(csp,/script-src[^;]*https:\/\/connect\.facebook\.net/);assert.match(csp,/connect-src[^;]*https:\/\/www\.facebook\.com\/tr\//);assert.ok(!csp.includes('*.facebook.com'));assert.ok(!csp.includes('graph.facebook.com'));
 assert.equal((await metaTrackingStatus({...f.env,META_TRACKING_ENABLED:'false'})).enabled,false);assert.equal((await metaTrackingStatus({...f.env,META_PIXEL_ID:'other'})).enabled,false);
});

function browser({href=origin+'/book/art-of-attention?utm_source=instagram&utm_medium=paid_social&utm_campaign=attention_cro&fbclid=SAFECLICK',consented=true,metaChoice=consented?'accepted':null,analyticsChoice='accepted',owner=false,enabled=true,testMode=false,delayedConsent=false}={}){
 const {document,Event}=parseHTML('<html><head><title>The Art of Attention</title><script id="cro-products" type="application/json">'+JSON.stringify(Object.fromEntries(Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service).map(([id,b])=>[id,{title:b.title,price:b.price}])) )+'</script><script id="meta-tracking-config" type="application/json">'+JSON.stringify({pixelId:'4490808921236945',enabled,testMode})+'</script></head><body><input id="meta-marketing-consent" type="checkbox"><button id="measurement-accept">Save</button><button id="measurement-reject">Reject</button><a id="preview" data-sample="art-of-attention" href="#inside-book">Preview</a><a id="buy" data-purchase="art-of-attention" href="/checkout?book=art-of-attention">Buy</a></body></html>');
 const settingsButton=document.createElement('button');settingsButton.id='privacy-settings';document.body.appendChild(settingsButton);
 let current=new URL(href);const local=new Map(),tab=new Map(),posts=[],cookies=new Map(),listeners={};
 local.set('oportals-analytics-consent-v1',JSON.stringify({choice:analyticsChoice,at:Date.now()}));if(metaChoice)local.set('oportals-meta-consent-v1',JSON.stringify({choice:metaChoice,at:Date.now()}));
 tab.set('oportals-visit-session-live',JSON.stringify({id:sid,last:Date.now(),source:'instagram'}));
 Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([k,v])=>k+'='+v).join('; '),set:s=>{const [value]=s.split(';'),i=value.indexOf('=');if(s.includes('Max-Age=0'))cookies.delete(value.slice(0,i));else cookies.set(value.slice(0,i),value.slice(i+1));},configurable:true});
 const location={get href(){return current.href;},get origin(){return current.origin;},get hostname(){return current.hostname;},get pathname(){return current.pathname;},get search(){return current.search;},get hash(){return current.hash;},assign:v=>{current=new URL(v,current);},reload(){}};
 const history={state:null,pushState(_a,_b,v){current=new URL(v,current);},replaceState(_a,_b,v){current=new URL(v,current);}};
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}),window={OPORTALS_OWNER:owner,Event,addEventListener(name,fn){listeners[name]=fn;}};
 let releaseGrant;const ctx=vm.createContext({window,document,location,history,URL,Date,JSON,Promise,crypto,navigator:{userAgent:'Mozilla/5.0',webdriver:false},localStorage:storage(local),sessionStorage:storage(tab),setTimeout,fetch:async(url,options)=>{const data=JSON.parse(options.body);posts.push({url,data});if(delayedConsent&&url==='/api/meta/consent'&&data.consent===true)return await new Promise(resolve=>{releaseGrant=()=>resolve({ok:true});});return {ok:true};}});
 vm.runInContext(readFileSync('public/analytics.js','utf8'),ctx);const source=readFileSync('public/meta-pixel.js','utf8');vm.runInContext(source,ctx);
 return {window,document,location,history,posts,local,tab,ctx,source,releaseGrant:()=>releaseGrant(),calls:()=>Array.from(window.fbq?.queue||[],a=>Array.from(a)),ga:()=>Array.from(window.dataLayer||[],a=>Array.from(a)).filter(a=>a[0]==='event')};
}
test('pixel loads once after separate Meta consent; PageView/ViewContent deduplicate across SPA hooks',async()=>{
 const b=browser();assert.equal(b.calls().filter(a=>a[0]==='init').length,1);assert.equal(b.calls().filter(a=>a[2]==='PageView').length,1);assert.equal(b.calls().filter(a=>a[2]==='ViewContent').length,1);assert.equal(b.document.querySelectorAll('#oportals-meta-sdk').length,1);assert.equal(b.window.fbq.disablePushState,true);
 vm.runInContext(b.source,b.ctx);b.window.oportalsTrackPage();b.window.oportalsMetaPage();b.window.oportalsMetaEvent('view_item','art-of-attention');assert.equal(b.calls().filter(a=>a[2]==='PageView').length,1);assert.equal(b.calls().filter(a=>a[0]==='init').length,1);
 b.history.pushState({},'','/book/man-and-people');b.document.title='Man and People';b.window.oportalsTrackPage();await Promise.resolve();assert.equal(b.calls().filter(a=>a[2]==='PageView').length,2);const view=b.calls().filter(a=>a[2]==='ViewContent').at(-1);assert.equal(view[3].value,9.99);assert.equal(view[3].currency,'USD');assert.equal(view[3].content_ids[0],'man-and-people');assert.equal(b.ga().filter(a=>a[1]==='page_view').at(-1)[2].page_title,'Man and People');
});
test('preview/checkout events use selected actual product; browser never emits Meta Purchase and GA retains campaign',async()=>{
 const b=browser();b.document.getElementById('preview').dispatchEvent(new b.window.Event('click',{bubbles:true}));assert.equal(b.ga().filter(a=>a[1]==='preview_opened').length,1);assert.equal(b.calls().filter(a=>a[2]==='Purchase').length,0);
 b.document.getElementById('buy').dispatchEvent(new b.window.Event('click',{bubbles:true,cancelable:true}));const checkout=b.calls().find(a=>a[2]==='InitiateCheckout');assert.equal(checkout[3].value,8.99);assert.equal(checkout[3].content_ids[0],'art-of-attention');b.window.oportalsMetaEvent('begin_checkout','art-of-attention');assert.equal(b.calls().filter(a=>a[2]==='InitiateCheckout').length,1);
 b.history.pushState({},'','/paypal/return');const purchase={eligible:true,transaction_id:'OP-'+('a'.repeat(24)),value:8.99,currency:'USD',items:[{item_id:'art-of-attention',item_name:'The Art of Attention',price:8.99,quantity:1}]};b.window.oportalsTrackPurchase(purchase);b.window.oportalsTrackPurchase(purchase);const purchases=b.ga().filter(a=>a[1]==='purchase');assert.equal(purchases.length,1);assert.equal(purchases[0][2].campaign_source,'instagram');assert.equal(purchases[0][2].campaign_name,'attention_cro');assert.equal(b.calls().filter(a=>a[2]==='Purchase').length,0);
});
test('analytics consent alone never loads Meta; rejection revokes cookies and prevents new events',async()=>{
 const b=browser({consented:false});assert.equal(b.calls().length,0);assert.equal(b.document.querySelectorAll('#oportals-meta-sdk').length,0);assert.equal(b.ga().filter(a=>a[1]==='page_view').length,1);
 b.document.getElementById('meta-marketing-consent').checked=true;b.document.getElementById('measurement-accept').dispatchEvent(new b.window.Event('click'));assert.equal(b.calls().filter(a=>a[0]==='init').length,1);const before=b.calls().length;b.document.getElementById('measurement-reject').dispatchEvent(new b.window.Event('click'));assert.equal(b.calls().at(-1)[1],'revoke');assert.ok(b.posts.some(p=>p.url==='/api/meta/consent'&&p.data.consent===false));b.window.oportalsMetaEvent('view_item','man-and-people');assert.equal(b.calls().length,before+1);
 for(const opts of [{owner:true},{href:origin+'/Testing/book/art-of-attention'},{href:origin+'/SocialMirror?ref=PRIVATE'},{href:origin+'/paypal/return?tx=PRIVATE'},{analyticsChoice:'rejected'},{enabled:false},{testMode:true}])assert.equal(browser(opts).calls().length,0,JSON.stringify(opts));
});
test('sanitizing the Meta SDK address preserves selected checkout while removing unrelated sensitive query data',()=>{
 const b=browser({href:origin+'/checkout?book=the-space-before-yes&utm_source=instagram&email=PRIVATE&tx=SECRET'});
 assert.equal(new URL(b.location.href).searchParams.get('book'),'the-space-before-yes');assert.ok(!b.location.href.includes('PRIVATE'));assert.ok(!b.location.href.includes('SECRET'));
 const meta=b.calls().find(a=>a[2]==='InitiateCheckout'),ga=b.ga().find(a=>a[1]==='begin_checkout');assert.equal(meta[3].content_ids[0],'the-space-before-yes');assert.equal(meta[3].value,7.99);assert.equal(ga[2].items[0].item_id,'the-space-before-yes');
});
test('reaccepting Meta sends consent grant again without duplicate SDK initialization or PageView',async()=>{
 const b=browser();await new Promise(setImmediate);b.document.getElementById('meta-marketing-consent').checked=false;b.document.getElementById('measurement-accept').dispatchEvent(new b.window.Event('click'));b.document.getElementById('meta-marketing-consent').checked=true;b.document.getElementById('measurement-accept').dispatchEvent(new b.window.Event('click'));await new Promise(setImmediate);
 assert.deepEqual(b.calls().filter(a=>a[0]==='consent').map(a=>a[1]),['grant','revoke','grant']);assert.equal(b.calls().filter(a=>a[0]==='init').length,1);assert.equal(b.calls().filter(a=>a[2]==='PageView').length,1);
});
test('withdrawal wins over delayed grants in both browser and server, even without a context cookie',async()=>{
 const b=browser({delayedConsent:true});const grant=b.posts.find(p=>p.url==='/api/meta/consent'&&p.data.consent===true).data;b.document.getElementById('measurement-reject').dispatchEvent(new b.window.Event('click'));const before=b.posts.filter(p=>p.url==='/api/meta/consent'&&p.data.consent===false);assert.ok(before.some(p=>p.data.context===grant.context));b.releaseGrant();await new Promise(setImmediate);assert.ok(b.posts.filter(p=>p.url==='/api/meta/consent'&&p.data.consent===false).length>before.length);
 const f=await fixture(),context=crypto.randomUUID();await metaConsent(jsonRequest('/api/meta/consent',{consent:false,context}),f.env);
 const late=await metaConsent(jsonRequest('/api/meta/consent',{consent:true,context}),f.env);assert.equal((await late.json()).enabled,false);assert.ok(f.DB.sql.prepare('SELECT revoked_at FROM meta_contexts WHERE id=?').get(context).revoked_at);assert.match(late.headers.get('set-cookie'),/Max-Age=0/);
});
test('live purchases cannot enter Meta test mode and queued test events cannot drain into live reporting',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='LIVEWITHTEST1234';f.env.META_TEST_MODE='true';f.env.META_TEST_EVENT_CODE='TEST10333';f.payments.set(tx,paid(tx));await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');
 const real=await(await f.h(verify(tx,cookie),f.env)).json();assert.equal(real.purchase.value,8.99);assert.equal(f.metaRequests.length,0);
 f.env.PAYPAL_ENV='sandbox';delete f.env.META_CAPI_ACCESS_TOKEN;const sandbox='ISOLATEDMETA1234';f.payments.set(sandbox,paid(sandbox,{test_ipn:'1'}));await f.h(verify(sandbox,cookie),f.env);const row=f.DB.sql.prepare('SELECT * FROM meta_purchase_outbox').get();assert.equal(row.mode,'test');assert.match(row.event_id,/^TEST-OP-/);
 f.env.META_CAPI_ACCESS_TOKEN='mock-secret';f.env.META_TEST_MODE='false';await deliverMetaPurchases(f.env,{fetcher:f.fetcher});assert.equal(f.metaRequests.length,0);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM conversion_purchases').get().n,1);
});
test('worker background delivery does not hold up the verified download response',async()=>{
 const f=await fixture(),cookie=await consent(f),tx='BACKGROUND12345';f.payments.set(tx,paid(tx));await recordMetaCheckout(new Request(origin+'/checkout',{headers:{cookie}}),f.env,'art-of-attention');
 let finish;const delayed=async(url,options)=>url.startsWith('https://graph.facebook.com/')?await new Promise(resolve=>{finish=()=>resolve(new Response('{"events_received":1}'));}):f.fetcher(url,options);
 const jobs=[],h=createHandler({},delayed),response=await h(verify(tx,cookie),f.env,{waitUntil:p=>jobs.push(p)});assert.equal(response.status,200);assert.ok((await response.json()).download);assert.equal(jobs.length,1);await new Promise(setImmediate);assert.equal(f.DB.sql.prepare('SELECT state FROM meta_purchase_outbox').get().state,'sending');finish();await Promise.all(jobs);assert.equal(f.DB.sql.prepare('SELECT state FROM meta_purchase_outbox').get().state,'sent');
});
const diagnostic=(data={testCode:'TEST10333',eventId:crypto.randomUUID()},extra={})=>new Request(origin+'/Conversions/meta/test',{method:'POST',headers:{origin,'Content-Type':'application/json','oai-authenticated-user-id':'owner-fixture','oai-authenticated-user-email':'owner@example.com',...extra},body:JSON.stringify(data)});
test('owner diagnostic uses only isolated custom Test Events and does not create a purchase',async()=>{
 const f=await fixture();f.env.PREVIEW_OWNER_EMAIL='owner@example.com';const request=diagnostic(),body=JSON.parse(await request.clone().text());const response=await f.h(request,f.env),result=await response.json();assert.equal(response.status,200);assert.equal(result.accepted,true);assert.equal(result.eventsReceived,1);assert.equal(result.traceId,'MOCK-ONLY');assert.equal(result.purchaseEvent,false);
 const sent=f.metaRequests[0].body;assert.equal(sent.test_event_code,'TEST10333');assert.equal(sent.data[0].event_name,'OPortalsConnectionTest');assert.equal(sent.data[0].event_id,'OP-CONNECTION-'+body.eventId);assert.equal(sent.data[0].custom_data,undefined);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM conversion_purchases').get().n,0);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM meta_purchase_outbox').get().n,0);assert.ok(!JSON.stringify(result).includes(f.env.META_CAPI_ACCESS_TOKEN));
});
test('diagnostic rejects anonymous, cross-origin, fake Purchase payloads and excessive requests',async()=>{
 const f=await fixture();f.env.PREVIEW_OWNER_EMAIL='owner@example.com';assert.equal((await f.h(jsonRequest('/Conversions/meta/test',{testCode:'TEST10333',eventId:crypto.randomUUID()}),f.env)).status,401);assert.equal((await f.h(diagnostic(undefined,{origin:'https://elsewhere.example'}),f.env)).status,403);
 assert.equal((await f.h(diagnostic({testCode:'TEST10333',eventId:crypto.randomUUID(),event_name:'Purchase',value:8.99}),f.env)).status,400);assert.equal(f.metaRequests.length,0);
 for(let i=0;i<10;i++)assert.equal((await f.h(diagnostic(),f.env)).status,200);assert.equal((await f.h(diagnostic(),f.env)).status,429);assert.equal(f.metaRequests.length,10);
});
test('diagnostic errors expose safe codes only and missing secrets fail closed',async()=>{
 const f=await fixture();f.env.PREVIEW_OWNER_EMAIL='owner@example.com';f.metaFailure=true;const response=await f.h(diagnostic(),f.env),data=await response.json();assert.equal(response.status,502);assert.equal(data.accepted,false);assert.equal(data.metaErrorCode,190);assert.ok(!JSON.stringify(data).includes('secret error'));assert.ok(!JSON.stringify(data).includes(f.env.META_CAPI_ACCESS_TOKEN));delete f.env.META_CAPI_ACCESS_TOKEN;assert.equal((await f.h(diagnostic(),f.env)).status,503);
});
test('new visitors see the Meta option selected while SDK and server grants wait for acceptance',()=>{
 const b=browser({consented:false});assert.equal(b.document.getElementById('meta-marketing-consent').checked,true);assert.equal(b.local.has('oportals-meta-consent-v1'),false);assert.equal(b.calls().length,0);assert.ok(!b.posts.some(p=>p.url==='/api/meta/consent'&&p.data.consent===true));
 b.document.getElementById('privacy-settings').dispatchEvent(new b.window.Event('click'));assert.equal(b.document.getElementById('meta-marketing-consent').checked,true);assert.equal(b.calls().length,0);
 b.document.getElementById('measurement-accept').dispatchEvent(new b.window.Event('click'));assert.equal(b.calls().filter(a=>a[0]==='init').length,1);assert.ok(b.posts.some(p=>p.url==='/api/meta/consent'&&p.data.consent===true));
});
test('saved Meta and all-measurement opt-outs remain unchecked when opening settings',()=>{
 for(const options of [{metaChoice:'rejected'},{consented:false,analyticsChoice:'rejected'}]){
  const b=browser(options);assert.equal(b.document.getElementById('meta-marketing-consent').checked,false);b.document.getElementById('privacy-settings').dispatchEvent(new b.window.Event('click'));assert.equal(b.document.getElementById('meta-marketing-consent').checked,false);assert.equal(b.calls().length,0);assert.ok(!b.posts.some(p=>p.url==='/api/meta/consent'&&p.data.consent===true));
 }
});
test('a new visitor can uncheck the suggested Meta option and save without enabling advertising tracking',()=>{
 const b=browser({consented:false});b.document.getElementById('meta-marketing-consent').checked=false;b.document.getElementById('measurement-accept').dispatchEvent(new b.window.Event('click'));assert.equal(JSON.parse(b.local.get('oportals-meta-consent-v1')).choice,'rejected');assert.equal(b.calls().length,0);b.document.getElementById('privacy-settings').dispatchEvent(new b.window.Event('click'));assert.equal(b.document.getElementById('meta-marketing-consent').checked,false);
});
