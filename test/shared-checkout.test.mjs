import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';import vm from 'node:vm';import {createRequire} from 'node:module';
import {createHandler} from '../src/worker.mjs';import {BOOK_PRODUCTS,PAYPAL_LINK,issueToken} from '../src/payment.mjs';import {createBookOrder,resolveBookPayment} from '../src/book-checkout.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom'),origin='https://oportals.com';
function database(){const sql=new DatabaseSync(':memory:');for(const name of ['0002_contact_messages.sql','0009_book_checkout_orders.sql'])sql.exec(readFileSync('drizzle/'+name,'utf8'));return {sql,prepare(q){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}}};}
async function fixture(){
 const DB=database(),env={DB,PAYPAL_PDT_TOKEN:'test',PAYPAL_RECEIVER_EMAIL:'seller@example.com',PAYPAL_ITEM_NAME:'Life secrets book',BOOK_ENCRYPTION_KEY:randomBytes(32).toString('base64'),CHARACTER_COLLECTION_KEY:randomBytes(32).toString('base64'),DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64'),SHARED_BOOK_CHECKOUT_FROM:new Date(Date.now()-60000).toISOString()},files={};
 const key=await crypto.subtle.importKey('raw',Buffer.from(env.CHARACTER_COLLECTION_KEY,'base64'),'AES-GCM',false,['encrypt']);
 for(const [book,b]of Object.entries(BOOK_PRODUCTS).filter(([id,b])=>!b.service)){const iv=crypto.getRandomValues(new Uint8Array(12));files[b.file]={keyEnv:'CHARACTER_COLLECTION_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('PDF:'+book))).toString('base64')}}
 const payments=new Map(),emails=[],fetcher=async(url,options)=>{if(url.includes('resend.com')){emails.push(JSON.parse(options.body));return new Response('{}')};if(url.includes('ipnpb'))return new Response('VERIFIED');const id=new URLSearchParams(options.body).get('tx'),p=payments.get(id);return new Response(p?'SUCCESS\n'+p.toString().split('&').join('\n'):'FAIL')};
 return {DB,env,payments,emails,h:createHandler({testing:{liveStorefront:true},completedBooks:files,socialMirrorPublished:'<body>Mirror</body>'},fetcher)};
}
function paid(tx,changes={}){return new URLSearchParams({txn_id:tx,payment_status:'Completed',mc_currency:'USD',mc_gross:'7.99',receiver_email:'seller@example.com',payer_email:'buyer@example.com',payment_date:new Date().toISOString(),item_name:'Life secrets book',item_number:'LIFE-SECRETS',...changes})}
function postVerify(transaction,checkout=null,cookie='',book=null){return new Request(origin+'/api/paypal/verify',{method:'POST',headers:{origin,'Content-Type':'application/json',cookie},body:JSON.stringify({transaction,checkout,book})})}
async function start(f,book,cookie=''){
 const page=await f.h(new Request(origin+'/checkout?book='+book),f.env);assert.equal(page.status,200);assert.equal(page.headers.get('referrer-policy'),'same-origin');assert.ok((await page.text()).includes(BOOK_PRODUCTS[book].title));
 const response=await f.h(new Request(origin+'/checkout',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded',cookie,'cf-connecting-ip':'192.0.2.3'},body:new URLSearchParams({book})}),f.env);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(PAYPAL_LINK));assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
 const token=JSON.parse(html.match(/sessionStorage\.setItem\("oportals-book-checkout",("[^"]+")\)/)[1]);return {token,html,cookie:response.headers.get('set-cookie').split(';')[0]};
}
test('each shared checkout keeps its selected book through verified payment and PDF delivery',async()=>{
 const f=await fixture();let n=0;
 for(const [book,b]of Object.entries(BOOK_PRODUCTS).filter(([id,b])=>b.shared||id==='life-secrets')){
  const order=await start(f,book),tx='SHARED'+String(++n).padStart(10,'0');f.payments.set(tx,paid(tx));const r=await f.h(postVerify(tx,order.token,order.cookie),f.env);assert.equal(r.status,200,book);const result=await r.json();assert.equal(result.book,book);assert.equal(result.title,b.title);
  const pdf=await f.h(new Request(origin+result.download),f.env);assert.equal(pdf.status,200);assert.equal(await pdf.text(),'PDF:'+book);
  const again=await f.h(postVerify(tx),f.env);assert.equal((await again.json()).book,book);
  const wrong=await issueToken(tx,f.env,undefined,book==='life-secrets'?'the-space-before-yes':'life-secrets');assert.equal((await f.h(new Request(origin+'/download?t='+wrong),f.env)).status,403);f.payments.set(tx,paid(tx,{payment_status:'Refunded'}));assert.equal((await f.h(new Request(origin+result.download),f.env)).status,403);
 }
 assert.equal(f.DB.sql.prepare('SELECT COUNT(*) AS n FROM book_payment_allocations').get().n,14);
});
test('one transaction cannot be retargeted and one order cannot consume another payment',async()=>{
 const f=await fixture(),a=await start(f,'the-space-before-yes'),b=await start(f,'think-again-gently'),tx='REPLAY12345678';f.payments.set(tx,paid(tx));assert.equal((await f.h(postVerify(tx,a.token),f.env)).status,200);assert.equal((await f.h(postVerify(tx,b.token),f.env)).status,409);
 const tx2='SECOND12345678';f.payments.set(tx2,paid(tx2));assert.equal((await f.h(postVerify(tx2,a.token),f.env)).status,409);
 const allocation=f.DB.sql.prepare('SELECT * FROM book_payment_allocations').get();assert.equal(allocation.book_id,'the-space-before-yes');assert.equal(f.DB.sql.prepare('SELECT COUNT(*) AS n FROM book_payment_allocations').get().n,1);
});
test('forged, unpaid, historic, underpaid, wrong-currency and wrong-seller receipts cannot claim a new book',async()=>{
 const f=await fixture(),order=await start(f,'when-life-changes'),tx='INVALID12345678';
 f.payments.set(tx,paid(tx));assert.equal((await f.h(postVerify(tx,order.token+'x'),f.env)).status,403);
 for(const changes of [{payment_status:'Pending'},{payment_status:'Refunded'},{mc_gross:'1.00'},{mc_gross:'15.00'},{mc_currency:'EUR'},{receiver_email:'other@example.com'},{payment_date:'2026-10-20T12:00:00Z'}]){f.payments.set(tx,paid(tx,changes));assert.equal((await f.h(postVerify(tx,order.token),f.env)).status,403,JSON.stringify(changes));}
 assert.equal(f.DB.sql.prepare('SELECT COUNT(*) AS n FROM book_payment_allocations').get().n,0);
 f.payments.set(tx,paid(tx,{payment_date:'2026-10-20T12:00:00Z'}));const legacy=await f.h(postVerify(tx),f.env);assert.equal(legacy.status,200);assert.equal((await legacy.json()).book,'life-secrets');
});
test('browser recovery asks the payer to confirm their book when tab context is missing',async()=>{
 const f=await fixture(),a=await start(f,'the-space-before-yes'),tx='RECOVER12345678';f.payments.set(tx,paid(tx));const recovered=await f.h(postVerify(tx,null,a.cookie),f.env);const selection=await recovered.json();assert.equal(selection.selectionRequired,true);assert.equal(selection.suggestedBook,'the-space-before-yes');const confirmed=await f.h(postVerify(tx,null,a.cookie,'the-space-before-yes'),f.env);assert.equal((await confirmed.json()).book,'the-space-before-yes');
 const b=await start(f,'think-again-gently'),c=await start(f,'when-life-changes',b.cookie),other='AMBIGUOUS12345';f.payments.set(other,paid(other));assert.equal((await (await f.h(postVerify(other,null,c.cookie),f.env)).json()).selectionRequired,true);assert.equal((await (await f.h(postVerify(other),f.env)).json()).selectionRequired,true);
 assert.equal((await f.h(postVerify(other,b.token,c.cookie),f.env)).status,200);
});
test('concurrent competing claims yield exactly one book allocation',async()=>{
 const f=await fixture(),a=await start(f,'the-space-before-yes'),b=await start(f,'think-again-gently'),p=paid('CONCURRENT12345');const outcomes=await Promise.allSettled([resolveBookPayment(p,f.env,null,a.token),resolveBookPayment(p,f.env,null,b.token)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) AS n FROM book_payment_allocations').get().n,1);
});
test('IPN never emails an unallocated Life Secrets PDF for another selected book',async()=>{
 const f=await fixture();f.env.RESEND_API_KEY='test';f.env.EMAIL_FROM='books@example.com';const a=await start(f,'epictetus-a-freer-mind'),tx='IPNMAIL12345678',p=paid(tx);f.payments.set(tx,p);
 const ipn=()=>new Request(origin+'/api/paypal/ipn',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});assert.equal((await f.h(ipn(),f.env)).status,200);assert.ok(f.emails[0].text.includes('/paypal/return?tx='));assert.ok(!f.emails[0].text.includes('/download?t='));
 assert.equal((await f.h(postVerify(tx,a.token),f.env)).status,200);assert.ok(f.emails.at(-1).subject.includes('Epictetus: A Freer Mind'));assert.ok(f.emails.at(-1).text.includes('/download?t='));assert.equal((await f.h(ipn(),f.env)).status,200);assert.ok(f.emails.at(-1).subject.includes('Epictetus: A Freer Mind'));
});
test('checkout mutations enforce same origin, keep prices fixed, and retain the dedicated higher-priced links',async()=>{
 const f=await fixture();for(const from of ['null','https://example.org',''])assert.equal((await f.h(new Request(origin+'/checkout',{method:'POST',headers:{origin:from,'Content-Type':'application/x-www-form-urlencoded'},body:'book=the-space-before-yes'}),f.env)).status,403);
 assert.equal((await f.h(new Request(origin+'/checkout?book=made-up'),f.env)).status,404);assert.equal((await f.h(new Request(origin+'/checkout?book=social-mirror-analysis'),f.env)).status,404);
 for(const book of ['art-of-attention','lead-without-the-noise','man-and-people']){const r=await f.h(new Request(origin+'/checkout?book='+book),f.env);assert.equal(r.status,303);assert.equal(r.headers.get('location'),BOOK_PRODUCTS[book].link)}
 for(let i=0;i<30;i++)await createBookOrder(new Request(origin+'/checkout',{headers:{'cf-connecting-ip':'192.0.2.99'}}),f.env,'life-secrets');await assert.rejects(createBookOrder(new Request(origin+'/checkout',{headers:{'cf-connecting-ip':'192.0.2.99'}}),f.env,'life-secrets'),e=>e.status===429);
});
test('the actual receipt script submits selected-order proof and names the delivered book',async()=>{
 const f=await fixture(),order=await start(f,'the-space-before-yes'),tx='BROWSER12345678';f.payments.set(tx,paid(tx));const response=await f.h(new Request(origin+'/paypal/return?tx='+tx),f.env),html=await response.text();assert.equal(response.headers.get('referrer-policy'),'same-origin');assert.ok(!html.includes('O PORTALS / LIFE SECRETS'));
 const {window}=parseHTML(html),document=window.document,store=new Map([['oportals-book-checkout',order.token]]),pending=[],ctx={document,location:{search:'?tx='+tx,pathname:'/paypal/return'},history:{replaceState(){}},URLSearchParams,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},fetch:(url,options)=>{const result=f.h(new Request(origin+url,{...options,headers:{...options.headers,origin,cookie:order.cookie}}),f.env);pending.push(result);return result;}};vm.createContext(ctx);
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],ctx);await Promise.all(pending);await new Promise(setImmediate);assert.ok(document.querySelector('#message').textContent.includes('The Space Before Yes'));assert.ok(document.querySelector('#download').textContent.includes('The Space Before Yes'));assert.equal(store.has('oportals-book-checkout'),false);
});

test('receipt recovery on another device allows exactly one equal-price book and rejects expensive selections',async()=>{
 const f=await fixture(),tx='CROSSDEVICE1234';f.payments.set(tx,paid(tx));const response=await f.h(postVerify(tx),f.env),data=await response.json();assert.equal(data.selectionRequired,true);assert.equal(data.choices.length,14);assert.ok(!data.choices.some(b=>b.id==='man-and-people'));
 assert.equal((await f.h(postVerify(tx,null,'','man-and-people'),f.env)).status,400);
 const chosen=await f.h(postVerify(tx,null,'','epicurus-the-art-of-enough'),f.env);assert.equal(chosen.status,200);const result=await chosen.json();assert.equal(result.book,'epicurus-the-art-of-enough');assert.equal(await (await f.h(new Request(origin+result.download),f.env)).text(),'PDF:epicurus-the-art-of-enough');
 assert.equal((await f.h(postVerify(tx,null,'','think-again-gently'),f.env)).status,409);
 const old='HISTORIC1234567';f.payments.set(old,paid(old,{payment_date:'2026-10-20T12:00:00Z'}));assert.equal((await f.h(postVerify(old,null,'','think-again-gently'),f.env)).status,403);
});
test('shared checkout starts on the merchant return origin and sales can be paused without revoking paid delivery',async()=>{
 const f=await fixture();const redirect=await f.h(new Request('https://life-secrets-guide.issawbanna.chatgpt.site/checkout?book=when-life-changes'),f.env);assert.equal(redirect.status,303);assert.equal(redirect.headers.get('location'),origin+'/checkout?book=when-life-changes');
 const order=await start(f,'when-life-changes'),tx='PAUSE1234567890';f.payments.set(tx,paid(tx));const paidResponse=await f.h(postVerify(tx,order.token),f.env);const download=(await paidResponse.json()).download;f.env.SHARED_BOOK_SALES_ENABLED='false';assert.equal((await f.h(new Request(origin+'/checkout?book=when-life-changes'),f.env)).status,503);assert.equal((await f.h(new Request(origin+download),f.env)).status,200);
});
test('the receipt recovery form completes a selected-book download without browser order storage',async()=>{
 const f=await fixture(),tx='RECOVERYUI12345';f.payments.set(tx,paid(tx));const html=await (await f.h(new Request(origin+'/paypal/return?tx='+tx),f.env)).text(),{window}=parseHTML(html),document=window.document;
 let selected='';Object.defineProperty(document.querySelector('#selected-book'),'value',{get(){return selected},set(v){selected=v},configurable:true});
 const pending=[],ctx={document,location:{search:'?tx='+tx,pathname:'/paypal/return'},history:{replaceState(){}},URLSearchParams,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:(url,options)=>{const promise=f.h(new Request(origin+url,{...options,headers:{...options.headers,origin}}),f.env);pending.push(promise);return promise;}};vm.createContext(ctx);
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],ctx);
 await Promise.all(pending);await new Promise(setImmediate);assert.equal(document.querySelectorAll('#selected-book option').length,15);assert.equal(document.querySelector('#book-choice').hidden,false);selected='think-again-gently';document.querySelector('#book-choice').dispatchEvent(new window.Event('submit',{cancelable:true}));await Promise.all(pending);await new Promise(setImmediate);
 assert.ok(document.querySelector('#download').textContent.includes('Think Again, Gently'));assert.equal(document.querySelector('#book-choice').hidden,true);
});

test('PayPal redirect still works when tab storage is blocked; receipt recovery remains available',async()=>{
 const f=await fixture(),order=await start(f,'when-life-changes');let target=null;const ctx={sessionStorage:{setItem(){throw Error('blocked')}},location:{replace:url=>{target=url}}};vm.createContext(ctx);for(const script of order.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],ctx);assert.equal(target,PAYPAL_LINK);
});
