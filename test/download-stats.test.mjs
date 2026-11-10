import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler} from '../src/worker.mjs';
import {createDownloadDB} from './helpers/download-db.mjs';
const origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
async function fixture(){
 const key=randomBytes(32).toString('base64'),k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);
 async function seal(text){const iv=crypto.getRandomValues(new Uint8Array(12));return {keyEnv:'PREVIEW_CONTENT_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text))).toString('base64')}}
 const pdf=await seal('%PDF-1.4\nprivate sample\n%%EOF');const assets={testing:await seal('<h1>Testing</h1>'),completedBooks:{'sneakpeak-ideas.pdf':pdf,'art-of-attention.pdf':pdf,'art-of-attention-sample.pdf':pdf}};
 const env={PREVIEW_OWNER_EMAIL:'owner@example.com',PREVIEW_CONTENT_KEY:key,DB:createDownloadDB()};return {env,assets,handler:createHandler(assets)};
}
test('per-book sample and full counters record only authenticated successful download requests',async()=>{
 const {env,handler:h}=await fixture();const full=origin+'/Testing/books/art-of-attention.pdf',sample=origin+'/Testing/books/art-of-attention-sample.pdf';
 const get=(url,extra={})=>h(new Request(url,{headers:auth,...extra}),env);
 assert.equal((await h(new Request(sample+'?download=1'),env)).status,401);
 assert.equal((await h(new Request(sample+'?download=1',{headers:{...auth,'oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
 assert.equal((await get(sample)).status,200);assert.equal((await get(sample+'?download=1',{method:'HEAD'})).status,200);
 assert.equal((await get(sample+'?download=1',{headers:{...auth,'sec-purpose':'prefetch'}})).status,200);assert.equal(env.DB.rows().length,0);
 for(let i=0;i<2;i++)assert.equal((await get(full+'?download=1')).status,200);
 assert.equal((await get(sample+'?download=1')).status,200);
 assert.equal((await get(origin+'/Testing/books/unknown.pdf?download=1')).status,404);
 const report=await get(origin+'/Testing/downloads.json');assert.equal(report.status,200);assert.equal(report.headers.get('Cache-Control'),'private, no-store');const json=await report.json();assert.equal(json.scope,'private-testing');assert.deepEqual(json.books.find(b=>b.id==='art-of-attention').sample,1);assert.equal(json.books.find(b=>b.id==='art-of-attention').full,2);assert.equal(json.books.find(b=>b.id==='life-secrets').full,0);
 assert.equal(env.DB.rows().length,2);assert.ok(env.DB.rows().every(row=>!('email' in row)&&!('ip' in row)));
 assert.equal((await h(new Request(origin+'/Testing/downloads'),env)).status,401);
 assert.equal((await h(new Request(origin+'/Testing/downloads.json',{headers:{...auth,'oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
});
test('decryption or recording errors cannot create a successful unrecorded attachment',async()=>{
 const {env,handler:h}=await fixture(),url=origin+'/Testing/books/art-of-attention-sample.pdf?download=1';
 const badKey=await h(new Request(url,{headers:auth}),{...env,PREVIEW_CONTENT_KEY:randomBytes(32).toString('base64')});assert.equal(badKey.status,503);assert.equal(env.DB.rows().length,0);
 const noDB={...env,DB:undefined};assert.equal((await h(new Request(url,{headers:auth}),noDB)).status,503);
 assert.equal((await h(new Request(url.split('?')[0],{headers:auth}),noDB)).status,200);
 assert.equal((await h(new Request(origin+'/Testing/downloads.json',{headers:auth}),noDB)).status,503);
});

test('free anthology has its own per-book download count',async()=>{const {env,handler}=await fixture();const r=await handler(new Request(origin+'/Testing/books/sneakpeak-ideas.pdf?download=1',{headers:auth}),env);assert.equal(r.status,200);const report=await handler(new Request(origin+'/Testing/downloads.json',{headers:auth}),env);const book=(await report.json()).books.find(b=>b.id==='sneakpeak-ideas');assert.equal(book.full,1);assert.equal(book.sample,0);});

test('date filtering uses inclusive Amman dates, preserves lifetime totals and exports the same filtered counts',async()=>{
 const {env,handler:h}=await fixture();
 async function bump(kind,at){await env.DB.prepare('INSERT INTO download_counts (book_id,kind,download_count,updated_at) VALUES (?,?,1,?) ON CONFLICT(book_id,kind) DO UPDATE SET download_count=download_counts.download_count+1,updated_at=excluded.updated_at').bind('art-of-attention',kind,at).run();}
 await bump('sample','2026-11-01T20:59:59.000Z'); // 1 Nov in Amman.
 await bump('sample','2026-11-01T21:00:00.000Z'); // 2 Nov in Amman.
 await bump('sample','2026-11-02T20:59:59.000Z'); // Last second of 2 Nov.
 await bump('full','2026-11-02T21:00:00.000Z'); // 3 Nov in Amman.
 const report=await(await h(new Request(origin+'/Testing/downloads.json?from=2026-11-02&to=2026-11-02',{headers:auth}),env)).json();
 assert.equal(report.range.timeZone,'Asia/Amman');assert.equal(report.range.from,'2026-11-02');const selected=report.books.find(b=>b.id==='art-of-attention');assert.equal(selected.sample,2);assert.equal(selected.full,0);assert.equal(selected.lastDownload,'2026-11-02T20:59:59.000Z');assert.equal(report.books.find(b=>b.id==='life-secrets').full,0);
 const all=await(await h(new Request(origin+'/Testing/downloads.json',{headers:auth}),env)).json();const life=all.books.find(b=>b.id==='art-of-attention');assert.equal(life.sample,3);assert.equal(life.full,1);assert.equal(all.range.preset,'all');assert.ok(all.dateTrackingStartedAt);
 const {parseHTML}=await import('linkedom');const {document}=parseHTML(await(await h(new Request(origin+'/Testing/downloads?from=2026-11-02&to=2026-11-02',{headers:auth}),env)).text());
 assert.equal(document.querySelector('#download-from').getAttribute('value'),'2026-11-02');assert.equal(document.querySelector('#download-to').getAttribute('value'),'2026-11-02');assert.equal(document.querySelector('form').getAttribute('method'),'get');assert.match(document.querySelector('.coverage').textContent,/Older download totals remain/);assert.equal(document.querySelectorAll('.presets a').length,4);
 const exported=await(await h(new Request(origin+document.querySelector('#download-json').getAttribute('href'),{headers:auth}),env)).json();assert.deepEqual(exported,report);
});

test('shortcuts include the current day and malformed dates never bypass owner access',async()=>{
 const {env,handler:h}=await fixture();await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf?download=1',{headers:auth}),env);
 for(const range of ['today','7d','30d']){const response=await h(new Request(origin+'/Testing/downloads.json?range='+range,{headers:auth}),env);assert.equal(response.status,200);const report=await response.json();assert.equal(report.range.preset,range);assert.equal(report.books.find(b=>b.id==='art-of-attention').sample,1);const days=(Date.parse(report.range.to)-Date.parse(report.range.from))/86400000+1;assert.equal(days,range==='today'?1:range==='7d'?7:30);}
 for(const q of ['from=2026-02-31&to=2026-03-01','from=2026-11-03&to=2026-11-02','from=2026-11-01','from=2999-01-01&to=2999-01-02','from=2020-01-01&to=2026-01-01','range=unknown','from=%3Cscript%3E&to=2026-11-01'])assert.equal((await h(new Request(origin+'/Testing/downloads.json?'+q,{headers:auth}),env)).status,400,q);
 for(const path of ['/Testing/downloads?range=today','/Testing/downloads.json?from=2026-11-01&to=2026-11-02'])assert.equal((await h(new Request(origin+path),env)).status,401);
});

test('failure of the daily counter rolls back the lifetime count and does not serve an unrecorded download',async()=>{
 const {env,handler:h}=await fixture();
 await env.DB.prepare("CREATE TRIGGER fail_daily_counter BEFORE INSERT ON download_daily_counts BEGIN SELECT RAISE(ABORT, 'fixture daily counter failure'); END").run();
 assert.equal((await h(new Request(origin+'/Testing/books/art-of-attention-sample.pdf?download=1',{headers:auth}),env)).status,503);assert.equal(env.DB.rows().length,0);
});


test('published and Testing reports keep their own filter links and recover from invalid date input',async()=>{
 const {env,assets}=await fixture(),h=createHandler({...assets,testing:{...assets.testing,liveStorefront:true}});
 const {parseHTML}=await import('linkedom');
 for(const base of ['', '/Testing']){
  const r=await h(new Request(origin+base+'/downloads?range=7d',{headers:auth}),env);assert.equal(r.status,200);const {document}=parseHTML(await r.text());assert.equal(document.querySelector('form').getAttribute('action'),base+'/downloads');assert.equal(document.querySelector('#download-json').getAttribute('href'),base+'/downloads.json?range=7d');assert.equal(document.querySelector('.presets [aria-current=page]').textContent,'Last 7 days');
  const invalid=await h(new Request(origin+base+'/downloads?from=2026-02-31&to=2026-03-01',{headers:auth}),env);assert.equal(invalid.status,400);assert.match(invalid.headers.get('content-type'),/text\/html/);assert.match(await invalid.text(),/Back to book downloads/);
 }
});
