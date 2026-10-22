import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertPayment, verifyPDT, verifyIPN, issueToken, readToken, decryptBook, emailReceipt, SITE_URL } from '../src/payment.mjs';
import { createHandler } from '../src/worker.mjs';
const tx='8AB12345CD678901E';
const env={PAYPAL_PDT_TOKEN:'test-token',PAYPAL_RECEIVER_EMAIL:'seller@example.com',PAYPAL_ITEM_NUMBER:'LIFE-SECRETS',BOOK_ENCRYPTION_KEY:randomBytes(32).toString('base64'),DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64')};
function payment(changes={}) {return new URLSearchParams({payment_status:'Completed',mc_currency:'USD',mc_gross:'15.00',receiver_email:'seller@example.com',txn_id:tx,item_number:'LIFE-SECRETS',payer_email:'buyer@example.com',payment_date:'13:00:00 Oct 20, 2026 PDT',...changes});}
function pdt(p=payment()){return 'SUCCESS\n'+p.toString().split('&').join('\n');}
const okFetch=async()=>new Response(pdt());
const post=(body,origin=SITE_URL)=>new Request(SITE_URL+'/api/paypal/verify',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('only completed $15 USD payments for the configured seller and book qualify',()=>{
 assert.equal(assertPayment(payment(),env).get('txn_id'),tx);
 for(const bad of [{payment_status:'Pending'},{payment_status:'Refunded'},{payment_status:'Reversed'},{mc_gross:'2.00'},{mc_gross:'15.001'},{mc_gross:'15.00garbage'},{mc_currency:'EUR'},{receiver_email:'attacker@example.com'},{item_number:'OTHER'},{test_ipn:'1'}])assert.throws(()=>assertPayment(payment(bad),env));
});
test('PDT ignores browser status and verifies the exact transaction with PayPal',async()=>{
 let calls=0;
 const p=await verifyPDT(tx,env,async(url,opts)=>{calls++;assert.equal(url,'https://www.paypal.com/cgi-bin/webscr');assert.equal(new URLSearchParams(opts.body).get('at'),'test-token');return new Response(pdt());});
 assert.equal(p.get('txn_id'),tx);assert.equal(calls,1);
 await assert.rejects(verifyPDT(tx,env,async()=>new Response('FAIL')));
 await assert.rejects(verifyPDT(tx,env,async()=>new Response(pdt(payment({txn_id:'OTHER1234567'})))));
 await assert.rejects(verifyPDT(tx,env,async()=>new Response(pdt()+'\nmc_gross=15.00')));
 await assert.rejects(verifyPDT(tx,env,async()=>new Response('error',{status:500})),e=>e.status===503);
 await assert.rejects(verifyPDT(tx,{},okFetch),e=>e.status===503);
});
test('sandbox verification uses sandbox host; live mode rejects test payment',async()=>{
 await verifyPDT(tx,{...env,PAYPAL_ENV:'sandbox'},async(url)=>{assert.equal(url,'https://www.sandbox.paypal.com/cgi-bin/webscr');return new Response(pdt(payment({test_ipn:'1'})));});
 await assert.rejects(verifyPDT(tx,env,async()=>new Response(pdt(payment({test_ipn:'1'})))));
});
test('IPN echoes the exact raw payload and rejects forged or duplicate-field notifications',async()=>{
 const raw=payment().toString();await verifyIPN(raw,env,async(url,opts)=>{assert.equal(url,'https://ipnpb.paypal.com/cgi-bin/webscr');assert.equal(opts.body,'cmd=_notify-validate&'+raw);return new Response('VERIFIED');});
 await assert.rejects(verifyIPN(raw,env,async()=>new Response('INVALID')));
 await assert.rejects(verifyIPN(raw+'&mc_gross=15.00',env,async()=>new Response('VERIFIED')));
});
test('download tokens reject tampering, wrong signing keys and expiration',async()=>{
 const now=Math.floor(Date.now()/1000);const t=await issueToken(tx,env,now+50);assert.equal((await readToken(t,env)).tx,tx);
 const payload=Buffer.from(JSON.stringify({v:1,tx,exp:now+999999})).toString('base64url');
 await assert.rejects(readToken(payload+'.'+t.split('.')[1],env));
 await assert.rejects(readToken(t,{...env,DOWNLOAD_SIGNING_KEY:randomBytes(32).toString('base64')}));
 await assert.rejects(readToken(t,env,now+51));
});
test('valid verified purchase unlocks the encrypted PDF; forged redirects and direct PDF URLs do not',async()=>{
 const key=await crypto.subtle.importKey('raw',Buffer.from(env.BOOK_ENCRYPTION_KEY,'base64'),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));
 const pdf=new TextEncoder().encode('%PDF-1.4\npaid-test-content');
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,pdf);
 const assets={book:{iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')},home:'<h1>Life Secrets</h1>',sample:''};
 const handler=createHandler(assets,okFetch);
 const verify=await handler(post({transaction:tx,paid:true}),env);assert.equal(verify.status,200);const data=await verify.json();
 const download=await handler(new Request(SITE_URL+data.download),env);assert.equal(download.status,200);assert.equal(download.headers.get('Content-Type'),'application/pdf');assert.equal(await download.text(),'%PDF-1.4\npaid-test-content');
 assert.equal((await handler(new Request(SITE_URL+'/download?paid=true'),env)).status,403);
 assert.equal((await handler(new Request(SITE_URL+'/Life-Secrets.pdf'),env)).status,404);
 assert.equal((await handler(post({transaction:tx},'https://evil.example'),env)).status,403);
 const invalid=createHandler(assets,async()=>new Response('FAIL'));assert.equal((await invalid(post({transaction:tx}),env)).status,403);
 assert.equal((await handler(new Request(SITE_URL+'/checkout'),{})).status,503);
 const checkout=await handler(new Request(SITE_URL+'/checkout'),env);assert.equal(checkout.status,303);assert.match(checkout.headers.get('Location'),/CS8XK9B6XLU64$/);
 assert.equal((await handler(post({transaction:tx}),{})).status,503);
 await assert.rejects(decryptBook(assets.book,randomBytes(32).toString('base64')));
});
test('email goes only to the verified payer, with deterministic idempotency on duplicate IPNs',async()=>{
 const e={...env,RESEND_API_KEY:'test-email-key',EMAIL_FROM:'Life Secrets <books@example.com>'};let prior;
 const p=payment({payment_date:new Date().toISOString()});
 const send=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');const b=JSON.parse(opts.body);assert.deepEqual(b.to,['buyer@example.com']);assert.equal(opts.headers['Idempotency-Key'],'life-secrets-'+tx);if(prior)assert.equal(opts.body,prior);prior=opts.body;return new Response('{}');};
 await emailReceipt(p,e,send);await emailReceipt(p,e,send);
 await assert.rejects(emailReceipt(p,e,async()=>new Response('{}',{status:500})),x=>x.status===503);
 assert.deepEqual(await emailReceipt(p,env,send),{enabled:false});
});
test('IPN pending events never send mail and outages cause retries instead of acknowledging delivery',async()=>{
 const h=createHandler({},async()=>new Response('VERIFIED'));
 const req=p=>new Request(SITE_URL+'/api/paypal/ipn',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});
 assert.equal((await h(req(payment({payment_status:'Pending'})),env)).status,200);
 const h2=createHandler({},async(url)=>url.includes('resend')?new Response('{}',{status:500}):new Response('VERIFIED'));
 assert.equal((await h2(req(payment({payment_date:new Date().toISOString()})),{...env,RESEND_API_KEY:'test',EMAIL_FROM:'books@example.com'})).status,503);
});

test('payment-link title matching verifies the exact configured book when no SKU is sent',()=>{
 const linkEnv={...env,PAYPAL_ITEM_NAME:'Life secrets book'};
 const p=payment({item_name:'Life secrets book',item_number:''});
 assert.equal(assertPayment(p,linkEnv).get('txn_id'),tx);
 assert.throws(()=>assertPayment(payment({item_name:'Another book',item_number:''}),linkEnv));
 assert.throws(()=>assertPayment(payment({item_name:'Life secrets book',mc_gross:'1.00'}),linkEnv));
});

test('published paid download delivers the current edition only after PayPal verification',async()=>{const currentKey=randomBytes(32).toString('base64'),k=await crypto.subtle.importKey('raw',Buffer.from(currentKey,'base64'),'AES-GCM',false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode('%PDF-1.4\ncurrent-edition'));const assets={testing:{liveStorefront:true},completedBooks:{'life-secrets.pdf':{keyEnv:'PREVIEW_V5_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(bytes).toString('base64')}}};const h=createHandler(assets,okFetch);const e={...env,PREVIEW_V5_KEY:currentKey};const result=await h(post({transaction:tx}),e);assert.equal(result.status,200);const link=(await result.json()).download;const r=await h(new Request(SITE_URL+link),e);assert.equal(r.status,200);assert.equal(await r.text(),'%PDF-1.4\ncurrent-edition');const rejected=createHandler(assets,async()=>new Response('FAIL'));assert.equal((await rejected(new Request(SITE_URL+link),e)).status,403);});
