import {createDownloadDB} from './helpers/download-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com';
const env={PREVIEW_OWNER_EMAIL:'owner@example.com',PREVIEW_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const key=await crypto.subtle.importKey('raw',Buffer.from(env.PREVIEW_ENCRYPTION_KEY,'base64'),'AES-GCM',false,['encrypt']);
const iv=crypto.getRandomValues(new Uint8Array(12));
const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('<h1>Private catalogue test</h1>'));
const assets={testing:{iv:Buffer.from(iv).toString('base64'),data:Buffer.from(cipher).toString('base64')},home:'Public homepage'};
const handler=createHandler(assets);
test('anonymous and other signed-in visitors cannot read private preview',async()=>{
 let r=await handler(new Request(origin+'/Testing'),env);assert.equal(r.status,401);assert.match(await r.text(),/signin-with-chatgpt/);assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 r=await handler(new Request(origin+'/Testing',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'}}),env);assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/Private catalogue test/);
 r=await handler(new Request(origin+'/Testing',{headers:{'oai-authenticated-user-email':'owner@example.com'}}),env);assert.equal(r.status,401);
});
test('configured site owner can decrypt the preview; GET and HEAD have private cache controls',async()=>{
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'Owner@example.com'};
 const r=await handler(new Request(origin+'/Testing',{headers}),env);assert.equal(r.status,200);assert.equal(await r.text(),'<h1>Private catalogue test</h1>');assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 const head=await handler(new Request(origin+'/Testing/',{method:'HEAD',headers}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('missing settings and incorrect keys fail closed; public homepage remains public',async()=>{
 assert.equal((await handler(new Request(origin+'/Testing'),{})).status,503);
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
 assert.equal((await handler(new Request(origin+'/Testing',{headers}),{...env,PREVIEW_ENCRYPTION_KEY:randomBytes(32).toString('base64')})).status,503);
 assert.equal(await (await handler(new Request(origin+'/'),env)).text(),'Public homepage');
 assert.equal((await handler(new Request(origin+'/Testing',{method:'POST'}),env)).status,405);
});

test('private review PDFs require the owner and use an independent content key',async()=>{
 const newKey=randomBytes(32).toString('base64');
 const k=await crypto.subtle.importKey('raw',Buffer.from(newKey,'base64'),'AES-GCM',false,['encrypt']);
 async function seal(text){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text));return {keyEnv:'PREVIEW_CONTENT_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(bytes).toString('base64')}}
 const fixture={...assets,testing:await seal('<h1>Completed private books</h1>'),completedBooks:{'art-of-attention.pdf':await seal('%PDF-1.4\nprivate review copy\n%%EOF')}};
 const h=createHandler(fixture),config={...env,PREVIEW_CONTENT_KEY:newKey,DB:createDownloadDB()};
 const auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
 const url=origin+'/Testing/books/art-of-attention.pdf';
 assert.equal((await h(new Request(url),config)).status,401);
 assert.equal((await h(new Request(url,{headers:{...auth,'oai-authenticated-user-email':'someone@example.com'}}),config)).status,403);
 const pdf=await h(new Request(url,{headers:auth}),config);
 assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.equal(pdf.headers.get('Cache-Control'),'private, no-store');assert.match(pdf.headers.get('Content-Disposition'),/^inline;/);assert.match(pdf.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);assert.equal(pdf.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.match(await pdf.text(),/^%PDF-1.4/);
 const attachment=await h(new Request(url+'?download=1',{headers:auth}),config);assert.match(attachment.headers.get('Content-Disposition'),/^attachment; filename="art-of-attention.pdf"/);
 const head=await h(new Request(url,{method:'HEAD',headers:auth}),config);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Type'),'application/pdf');
 assert.equal((await h(new Request(origin+'/Testing/books/not-a-book.pdf',{headers:auth}),config)).status,404);
 assert.equal((await h(new Request(url,{headers:auth,method:'POST'}),config)).status,405);
 assert.equal((await h(new Request(url,{headers:auth}),{...config,PREVIEW_CONTENT_KEY:randomBytes(32).toString('base64')})).status,503);
 assert.match(await(await h(new Request(origin+'/Testing',{headers:auth}),config)).text(),/Completed private books/);
 // The preserved Version 1 ciphertext still selects the old key when the new key is present.
 const old=createHandler(assets);assert.match(await(await old(new Request(origin+'/Testing',{headers:auth}),config)).text(),/Private catalogue test/);
});
