import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import {randomBytes} from 'node:crypto';import vm from 'node:vm';import {parseHTML} from 'linkedom';
import {recordConversionEvent,recordVerifiedPurchase,recordVerifiedRefund,recordCheckoutAttribution,conversionReport} from '../src/conversions.mjs';
import {createHandler} from '../src/worker.mjs';import {createBookOrder} from '../src/book-checkout.mjs';
const origin='https://oportals.com',sid='2d497839-c584-4712-84e8-0c14fb93d365';
function database(){const sql=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));const db={sql,prepare(q){let args=[];return {bind(...v){args=v;return this;},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}},async all(){return {results:sql.prepare(q).all(...args)}}}},async batch(stmts){const out=[];for(const s of stmts)out.push(await s.all());return out;}};return db;}
const config=DB=>({DB,DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64'),PAYPAL_PDT_TOKEN:'fixture',PAYPAL_RECEIVER_EMAIL:'seller@example.com',BOOK_ENCRYPTION_KEY:randomBytes(32).toString('base64'),SHARED_BOOK_CHECKOUT_FROM:new Date(Date.now()-60000).toISOString()});
const payment=(tx,extra={})=>new URLSearchParams({txn_id:tx,payment_status:'Completed',mc_currency:'USD',mc_gross:'8.99',receiver_email:'seller@example.com',payment_date:new Date().toISOString(),item_name:'The Art of Attention',...extra});
const event=(name='page_view',book='',extra={})=>({event:name,eventId:crypto.randomUUID(),session:sid,page:book?'/book/'+book:'/',book,source:'instagram',consent:true,...extra});
const post=data=>new Request(origin+'/api/conversion-event',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
test('funnel accepts only bounded consented interactions; a client cannot post purchases or money',async()=>{
 const DB=database(),env=config(DB),d=event();assert.equal((await recordConversionEvent(post(d),env)).status,204);assert.equal((await recordConversionEvent(post(d),env)).status,204);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM conversion_events').get().n,1);
 for(const data of [event('purchase','art-of-attention'),{...event(),value:899},{...event(),transaction:'SECRET'},{...event(),page:'/SocialMirror?ref=secret'},{...event(),session:'invalid'},event('view_item','art-of-attention',{page:'/'})])assert.equal((await recordConversionEvent(post(data),env)).status,400);
 const off=await recordConversionEvent(post({consent:false}),env);assert.equal(off.status,204);assert.match(off.headers.get('set-cookie'),/Max-Age=0/);
 const denied=new Request(origin+'/api/conversion-event',{method:'POST',headers:{origin:'https://elsewhere.example','Content-Type':'application/json'},body:JSON.stringify(event())});assert.equal((await recordConversionEvent(denied,env)).status,403);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM conversion_purchases').get().n,0);
});
test('verified purchase ledger deduplicates, keeps real prices/dates and upgrades safe attribution',async()=>{
 const DB=database(),env=config(DB),r=await recordConversionEvent(post(event()),env),cookie=r.headers.get('set-cookie').split(';')[0];assert.match(cookie,/__Host-oportals-attribution=/);
 const req=new Request(origin+'/api/paypal/verify',{headers:{cookie}}),p=payment('VERIFIED1234567');
 const a=await recordVerifiedPurchase(p,'art-of-attention',env,req),b=await recordVerifiedPurchase(p,'art-of-attention',env,req);assert.deepEqual(a,b);assert.equal(a.value,8.99);assert.equal(a.currency,'USD');assert.equal(a.eligible,true);assert.match(a.transaction_id,/^OP-[a-f0-9]{24}$/);assert.ok(!JSON.stringify(a).includes(p.get('txn_id')));
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM conversion_purchases').get().n,1);assert.equal(DB.sql.prepare('SELECT source FROM conversion_purchases').get().source,'instagram');
 assert.equal(await recordVerifiedPurchase(payment('PENDING1234567',{payment_status:'Pending'}),'art-of-attention',env),null);
 assert.equal(await recordVerifiedPurchase(payment('SANDBOX1234567'),'art-of-attention',{...env,PAYPAL_ENV:'sandbox'}),null);
 assert.equal(await recordVerifiedPurchase(payment('TESTIPN1234567',{test_ipn:'1'}),'art-of-attention',env),null);
 const historic=await recordVerifiedPurchase(payment('HISTORIC123456',{item_name:'Life Secrets',mc_gross:'15.00',payment_date:'2026-10-01T12:00:00Z'}),'life-secrets',env);assert.equal(historic.value,15);assert.equal(historic.eligible,false);assert.equal(DB.sql.prepare('SELECT paid_day FROM conversion_purchases WHERE book_id=?').get('life-secrets').paid_day,'2026-10-01');
 const shared=payment('UNASSIGNED12345',{item_name:'Life Secrets',mc_gross:'7.99'});await recordVerifiedPurchase(shared,null,env);assert.equal(DB.sql.prepare('SELECT book_id FROM conversion_purchases WHERE value_cents=799').get().book_id,'unassigned');await recordVerifiedPurchase(shared,'the-space-before-yes',env,req);assert.equal(DB.sql.prepare('SELECT book_id FROM conversion_purchases WHERE value_cents=799').get().book_id,'the-space-before-yes');
});
test('real verification endpoint records the allocated shared book; receipt replay and refunds do not inflate revenue',async()=>{
 const DB=database(),env=config(DB),payments=new Map(),fetcher=async(url,options)=>url.includes('ipnpb')?new Response('VERIFIED'):new Response(payments.has(new URLSearchParams(options.body).get('tx'))?'SUCCESS\n'+payments.get(new URLSearchParams(options.body).get('tx')).toString().split('&').join('\n'):'FAIL');
 const h=createHandler({},fetcher),order=await createBookOrder(new Request(origin+'/checkout'),env,'the-space-before-yes'),tx='SHAREDPAID123456';payments.set(tx,payment(tx,{item_name:'Life Secrets',mc_gross:'7.99'}));
 const verify=()=>h(new Request(origin+'/api/paypal/verify',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({transaction:tx,checkout:order.token})}),env);
 let r=await verify();assert.equal(r.status,200);assert.equal((await r.json()).purchase.items[0].item_id,'the-space-before-yes');assert.equal((await verify()).status,200);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM conversion_purchases').get().n,1);
 const refund=payment('REFUNDPAID12345',{parent_txn_id:tx,payment_status:'Refunded',mc_gross:'-7.99'});const ipn=()=>h(new Request(origin+'/api/paypal/ipn',{method:'POST',body:refund}),env);assert.equal((await ipn()).status,200);assert.equal((await ipn()).status,200);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM conversion_refunds').get().n,1);
 const data=await(await conversionReport(new Request(origin+'/Conversions/data'),env)).json();assert.equal(data.summary.purchases,1);assert.equal(data.summary.gross,7.99);assert.equal(data.summary.refunds,7.99);assert.equal(data.summary.net,0);
});
test('funnel counts sessions once across pages and honours existing session exclusions',async()=>{
 const DB=database(),env=config(DB);for(const d of [event(),event('page_view','art-of-attention'),event('view_item','art-of-attention'),event('begin_checkout','art-of-attention')])assert.equal((await recordConversionEvent(post(d),env)).status,204);
 const r=await recordConversionEvent(post(event()),env),cookie=r.headers.get('set-cookie').split(';')[0];await recordVerifiedPurchase(payment('EXCLUDED1234567'),'art-of-attention',env,new Request(origin+'/api/paypal/verify',{headers:{cookie}}));
 let data=await(await conversionReport(new Request(origin+'/Conversions/data'),env)).json();assert.equal(data.summary.sessions,1);assert.equal(data.summary.bookViews,1);assert.equal(data.summary.checkoutStarts,1);assert.equal(data.summary.purchases,1);
 DB.sql.prepare('INSERT INTO site_sessions(site,session_id,started_day,started_at,last_seen_at,country,city,timezone,source,first_page,last_page,stats_excluded) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('live',sid,'2026-11-04',new Date().toISOString(),new Date().toISOString(),'ZZ','','','instagram','/','/',1);
 data=await(await conversionReport(new Request(origin+'/Conversions/data'),env)).json();assert.equal(data.summary.sessions,0);assert.equal(data.summary.bookViews,0);assert.equal(data.summary.purchases,0);
 const h=createHandler({conversionsDashboard:'owner report'});assert.equal((await h(new Request(origin+'/Conversions/data'),env)).status,401);assert.equal((await h(new Request(origin+'/Conversions'),env)).status,401);
});
test('checkout attribution stays with its order and historical recovery cannot acquire a later source',async()=>{
 const DB=database(),env=config(DB),a=await recordConversionEvent(post(event()),env),cookieA=a.headers.get('set-cookie').split(';')[0],order=await createBookOrder(new Request(origin+'/checkout'),env,'the-space-before-yes');
 await recordCheckoutAttribution(order,new Request(origin+'/checkout',{headers:{cookie:cookieA}}),env);
 const paidAt=new Date(),tx='ATTRIBUTION12345';DB.sql.prepare('INSERT INTO book_payment_allocations(transaction_id,book_id,order_id,paid_at,created_at) VALUES(?,?,?,?,?)').run(tx,'the-space-before-yes',order.id,Math.floor(paidAt.valueOf()/1000),Math.floor(Date.now()/1000));
 const b=await recordConversionEvent(post(event('page_view','',{source:'facebook'})),env),cookieB=b.headers.get('set-cookie').split(';')[0];
 await recordVerifiedPurchase(payment(tx,{item_name:'Life Secrets',mc_gross:'7.99',payment_date:paidAt.toISOString()}),'the-space-before-yes',env,new Request(origin+'/api/paypal/verify',{headers:{cookie:cookieB}}));
 assert.equal(DB.sql.prepare('SELECT source FROM conversion_purchases WHERE book_id=?').get('the-space-before-yes').source,'instagram');
 const old=payment('OLDERRECEIPT123',{payment_date:'2026-10-01T12:00:00Z'});await recordVerifiedPurchase(old,'art-of-attention',env);await recordVerifiedPurchase(old,'art-of-attention',env,new Request(origin+'/api/paypal/verify',{headers:{cookie:cookieB}}));assert.equal(DB.sql.prepare('SELECT source FROM conversion_purchases WHERE book_id=?').get('art-of-attention').source,'unknown');
});
test('a canceled reversal restores revenue without erasing an independent partial refund',async()=>{
 const DB=database(),env=config(DB),tx='REVERSALSALE123';await recordVerifiedPurchase(payment(tx),'art-of-attention',env);
 const adjustment=(id,state,value)=>payment(id,{parent_txn_id:tx,payment_status:state,mc_gross:value});
 await recordVerifiedRefund(adjustment('REVERSAL12345','Reversed','-8.99'),env);
 let report=await(await conversionReport(new Request(origin+'/Conversions/data'),env)).json();assert.equal(report.summary.net,0);
 await recordVerifiedRefund(adjustment('PARTIAL12345','Refunded','-1.00'),env);await recordVerifiedRefund(adjustment('RESTORED12345','Canceled_Reversal','8.99'),env);await recordVerifiedRefund(adjustment('RESTORED12345','Canceled_Reversal','8.99'),env);
 report=await(await conversionReport(new Request(origin+'/Conversions/data'),env)).json();assert.equal(report.summary.purchases,1);assert.equal(report.summary.refunds,1);assert.equal(report.summary.net,7.99);
});
function browser({testing=false,owner=false,rejected=false}={}){
 const {window:domWindow,document}=parseHTML('<html><head><title>Home</title><script id="cro-products" type="application/json">{"art-of-attention":{"title":"The Art of Attention","price":"8.99"}}</script></head><body><a id="buy" href="/checkout?book=art-of-attention" data-purchase="art-of-attention">Buy</a></body></html>');
 const window={Event:domWindow.Event,addEventListener(){}};let current=new URL(origin+(testing?'/Testing':'/')),posts=[];const store=new Map(),sessionStore=new Map();sessionStore.set('oportals-visit-session-'+(testing?'testing':'live'),JSON.stringify({id:sid,last:Date.now(),source:'instagram'}));if(rejected)store.set('oportals-analytics-consent-v1',JSON.stringify({choice:'rejected',at:Date.now()}));
 const location={get href(){return current.href},get hostname(){return current.hostname},reload(){},assign(v){current=new URL(v,current)}},history={pushState(_a,_b,v){current=new URL(v,current)},replaceState(_a,_b,v){current=new URL(v,current)}};window.OPORTALS_OWNER=owner;
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});const ctx=vm.createContext({window,document,location,history,URL,Date,JSON,crypto,localStorage:storage(store),sessionStorage:storage(sessionStore),setTimeout,fetch:async(url,options)=>{posts.push({url,data:JSON.parse(options.body)});return {ok:true}}});vm.runInContext(readFileSync('public/analytics.js','utf8'),ctx);
 return {window,document,history,posts,events:()=>Array.from(window.dataLayer||[],args=>Array.from(args)).filter(args=>args[0]==='event')};
}
test('GA4 tracks SPA titles and correct SKU values; only verified-response data triggers deduplicated purchases',()=>{
 const b=browser();assert.equal(b.events().filter(e=>e[1]==='page_view').length,1);b.history.pushState({},'','/book/art-of-attention');b.document.title='The Art of Attention';b.window.oportalsTrackPage();b.window.oportalsTrackPage();
 assert.equal(b.events().filter(e=>e[1]==='page_view').length,2);assert.equal(b.events().find(e=>e[1]==='view_item')[2].value,8.99);assert.equal(b.events().filter(e=>e[1]==='page_view').at(-1)[2].page_title,'The Art of Attention');
 b.document.getElementById('buy').dispatchEvent(new b.window.Event('click',{bubbles:true}));assert.equal(b.events().find(e=>e[1]==='begin_checkout')[2].items[0].item_id,'art-of-attention');assert.equal(b.events().filter(e=>e[1]==='purchase').length,0);
 const purchase={transaction_id:'OP-'+('a'.repeat(24)),value:8.99,currency:'USD',items:[{item_id:'art-of-attention',item_name:'The Art of Attention',price:8.99,quantity:1}],eligible:true};b.window.oportalsTrackPurchase(purchase);b.window.oportalsTrackPurchase(purchase);assert.equal(b.events().filter(e=>e[1]==='purchase').length,1);
 assert.ok(b.posts.every(p=>!JSON.stringify(p).includes('transaction_id')));assert.equal(browser({testing:true}).events().length,0);assert.equal(browser({owner:true}).events().length,0);assert.ok(browser({rejected:true}).posts.every(p=>p.data.consent===false&&Object.keys(p.data).length===1));
});
