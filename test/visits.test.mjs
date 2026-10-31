import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHandler} from '../src/worker.mjs';
import {recordSiteVisit,siteVisitsReport,visitsDay,visitsRange} from '../src/visits.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
const origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0001_testing_events.sql','utf8'));sql.exec(readFileSync('drizzle/0007_site_visits.sql','utf8'));
 return {sql,prepare(q){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:sql.prepare(q).all(...args)};},async first(){return sql.prepare(q).get(...args)||null;},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}};}};},async batch(q){return Promise.all(q.map(s=>s.all()));}};
}
const payload={event:'page_view',page:'/',target:'',source:'instagram',consent:true};
function event(body=payload,path='/api/visits-event',headers={}){return new Request(origin+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
const today=()=>visitsDay(),shift=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function seed(db,day,site,event,page,target,count=1){db.sql.prepare('INSERT INTO site_visits_daily(day,site,event_name,page,target,source,country,event_count,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(day,site,event,page,target,'instagram','JO',count,new Date().toISOString());}

test('Visits and its JSON report require the owner, including HEAD and Testing routes',async()=>{
 const DB=database(),h=createHandler({visitsDashboard:readFileSync('public/visits-dashboard.html','utf8')}),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'};
 for(const path of ['/Visits','/Visits/data','/Testing/Visits','/Testing/Visits/data']){
  assert.equal((await h(new Request(origin+path),env)).status,401,path);
  assert.equal((await h(new Request(origin+path,{method:'HEAD'}),env)).status,401,path+' HEAD');
  assert.equal((await h(new Request(origin+path,{headers:{...auth,'oai-authenticated-user-email':'stranger@example.com'}}),env)).status,403,path);
  const r=await h(new Request(origin+path,{headers:auth}),env);assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.match(r.headers.get('x-robots-tag'),/noindex/);
 }
 const html=await (await h(new Request(origin+'/Visits',{headers:auth}),env)).text();assert.match(html,/Social Mirror visits/);assert.match(html,/Buy Now clicks/);assert.ok(!html.includes('id="oportals-visits-tracking"'));
 assert.equal((await h(new Request(origin+'/Visits',{method:'POST',headers:auth}),env)).status,405);
 assert.equal((await h(new Request(origin+'/visits'),env)).headers.get('location'),'/Visits');
});

test('first-party measurements aggregate by Amman date/site and reject personal or arbitrary fields',async()=>{
 const DB=database(),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'},h=createHandler({});
 assert.equal((await h(event(),env)).status,204);assert.equal((await h(event(),env)).status,204);
 assert.equal((await h(event(payload,'/Testing/api/visits-event'),env)).status,204);
 assert.equal((await h(event(payload,'/api/visits-event',auth),env)).status,204);
 const rows=DB.sql.prepare('SELECT day,site,event_count FROM site_visits_daily ORDER BY site').all();assert.equal(rows.length,2);assert.equal(rows[0].site,'live');assert.equal(rows[0].event_count,2);assert.equal(rows[1].event_count,1);assert.equal(rows[0].day,today());
 for(const body of [{...payload,email:'private@example.com'},{...payload,page:'/SocialMirror?ref=PRIVATE'},{...payload,page:'/Visits'},{...payload,consent:false},{...payload,event:'click',target:'Natali private name'},{...payload,source:'private-campaign-id'}])assert.equal((await h(event(body),env)).status,400);
 assert.equal((await h(event(payload,'/api/visits-event',{origin:'https://wrong.example'}),env)).status,403);
 assert.equal((await h(event({...payload,extra:'x'.repeat(600)}),env)).status,413);
 assert.equal((await h(new Request(origin+'/api/visits-event'),env)).status,405);
 assert.equal((await recordSiteVisit(event(),{})).status,503);
 assert.equal(visitsDay(new Date('2026-10-30T21:30:00Z')),'2026-10-31');
 assert.equal(visitsDay(new Date('2026-10-30T20:59:00Z')),'2026-10-30');
});

test('custom dates and site filters produce exact book/preview/buy and Social Mirror totals',async()=>{
 const DB=database(),day=shift(today(),-1),old=shift(today(),-2);
 seed(DB,day,'live','page_view','/','',3);seed(DB,day,'live','page_view','/book/life-secrets','',2);seed(DB,day,'live','click','/book/life-secrets','preview:life-secrets',2);seed(DB,day,'live','click','/book/life-secrets','buy:life-secrets',1);seed(DB,day,'live','page_view','/SocialMirror','',4);seed(DB,day,'live','click','/SocialMirror','mirror_start',2);seed(DB,day,'live','click','/SocialMirror','mirror_share_link',1);
 seed(DB,day,'testing','page_view','/','',50);seed(DB,old,'live','page_view','/','',100);
 DB.sql.prepare('INSERT INTO testing_events VALUES(?,?,?,?,?)').run('home_view','','JO',77,new Date().toISOString());
 const request=site=>new Request(origin+'/Visits/data?from='+day+'&to='+day+'&site='+site);
 const data=await (await siteVisitsReport(request('live'),{DB})).json();assert.deepEqual(data.summary,{pageViews:9,clicks:6,bookViews:2,previewClicks:2,buyClicks:1,mirrorViews:4});assert.equal(data.books[0].views,2);assert.equal(data.books[0].previews,2);assert.equal(data.books[0].buys,1);assert.equal(data.mirror.mirror_start,2);assert.equal(data.legacy[0].count,77);
 const all=await (await siteVisitsReport(request('all'),{DB})).json();assert.equal(all.summary.pageViews,59);
 const testing=await (await siteVisitsReport(request('testing'),{DB})).json();assert.equal(testing.summary.pageViews,50);assert.equal(testing.summary.buyClicks,0);
 assert.equal((await siteVisitsReport(new Request(origin+'/Visits/data?from=2026-02-31&to='+day),{DB})).status,400);
 assert.equal((await siteVisitsReport(new Request(origin+'/Visits/data?from='+day+'&to='+old),{DB})).status,400);
 assert.equal((await siteVisitsReport(new Request(origin+'/Visits/data?site=anything'),{DB})).status,400);
 assert.throws(()=>visitsRange(new URL(origin+'/Visits/data?to=2999-01-01')));
});

function trackerBrowser({env,denied=false,owner=false}={}){
 const html='<a id="book" href="/book/life-secrets">Book</a><a id="preview" href="/books/life-secrets-sample.pdf" data-sample="life-secrets">Preview</a><a id="buy" href="/checkout?book=life-secrets">Buy</a><button id="sample-start">Start</button><button id="copy-invite">Copy</button>',{window}=parseHTML(html),document=window.document;
 Object.defineProperty(document,'referrer',{value:'https://l.facebook.com/l.php?private=SECRET'});
 let current=new URL(origin+'/?email=PRIVATE&tx=SECRET&utm_source=instagram#key=PRIVATE');
 const location={get pathname(){return current.pathname;},get href(){return current.href;},get origin(){return current.origin;},get hostname(){return current.hostname;}};
 const history={pushState(a,b,url){current=new URL(url,current);},replaceState(a,b,url){current=new URL(url,current);}};
 const store=new Map();if(denied)store.set('oportals-testing-measurement','deny');
 const calls=[],pending=[],listeners={};const win={OPORTALS_OWNER:owner,addEventListener(name,fn){listeners[name]=fn;}};
 const context={document,window:win,location,history,URL,localStorage:{getItem:k=>store.get(k)||null},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});const p=recordSiteVisit(new Request(origin+url,{...options,headers:{...options.headers,origin}}),env);pending.push(p);return p;}};
 vm.runInNewContext(readFileSync('public/visits-tracking.js','utf8'),context);
 return {calls,pending,store,history,click:id=>document.getElementById(id).dispatchEvent(new window.Event('click',{bubbles:true})),pop:()=>listeners.popstate()};
}
test('real client tracker → API → SQLite → dashboard counts previews, Buy Now and Social Mirror without URL secrets',async()=>{
 const DB=database(),b=trackerBrowser({env:{DB}});b.click('book');b.history.pushState({},'','/book/life-secrets');await Promise.resolve();b.click('preview');b.click('buy');b.history.pushState({},'','/SocialMirror?ref=PRIVATE#key=PRIVATE');await Promise.resolve();b.click('sample-start');b.click('copy-invite');await Promise.all(b.pending);
 for(const r of await Promise.all(b.pending))assert.equal(r.status,204);
 assert.ok(!JSON.stringify(b.calls).includes('PRIVATE'));assert.ok(!JSON.stringify(b.calls).includes('SECRET'));assert.ok(b.calls.every(c=>c.body.source==='instagram'));
 const data=await (await siteVisitsReport(new Request(origin+'/Visits/data'),{DB})).json();assert.equal(data.summary.pageViews,3);assert.equal(data.summary.bookViews,1);assert.equal(data.summary.previewClicks,1);assert.equal(data.summary.buyClicks,1);assert.equal(data.summary.mirrorViews,1);assert.equal(data.mirror.mirror_start,1);assert.equal(data.mirror.mirror_copy_link,1);
 const before=b.calls.length;b.store.set('oportals-testing-measurement','deny');b.click('buy');assert.equal(b.calls.length,before);
 assert.equal(trackerBrowser({env:{DB},denied:true}).calls.length,0);assert.equal(trackerBrowser({env:{DB},owner:true}).calls.length,0);
});

test('tracking is attached to storefront and Social Mirror once, while payment verification and PDFs stay separate',async()=>{
 const html='<html><body><footer></footer><script></script></body></html>',source=readFileSync('public/visits-tracking.js','utf8'),h=createHandler({visitsTracking:source,testing:{keyEnv:'PREVIEW_V5_KEY',publicPreview:true,liveStorefront:true},publishedDraft:true,testingDraft:html,liveDraft:html,socialMirror:html,socialMirrorPublished:html});
 const env={PREVIEW_V5_KEY:'static-html-test',PREVIEW_OWNER_EMAIL:'owner@example.com'};
 for(const path of ['/','/Testing','/SocialMirror','/Testing/SocialMirror']){const body=await (await h(new Request(origin+path),env)).text();assert.equal(body.split('id="oportals-visits-tracking"').length,2,path);}
 const guest=await (await h(new Request(origin+'/'),env)).text();assert.ok(!guest.includes('href="/Visits"'));
 const owner=await (await h(new Request(origin+'/',{headers:auth}),env)).text();assert.ok(owner.includes('href="/Visits"'));
});

test('dashboard controls request their selected dates and render measured values and empty states',async()=>{
 const DB=database(),day=today();seed(DB,day,'live','page_view','/SocialMirror','',7);seed(DB,day,'live','click','/SocialMirror','mirror_start',2);seed(DB,shift(day,-1),'live','page_view','/book/life-secrets','',4);
 const html=readFileSync('public/visits-dashboard.html','utf8'),{window}=parseHTML(html),document=window.document;
 // Linkedom exposes select.value as read-only; browsers provide both accessors.
 const select=document.getElementById('site');let selected='live';Object.defineProperty(select,'value',{get(){return selected;},set(v){selected=v;}});
 let current=new URL(origin+'/Visits'),calls=[];
 const location={get pathname(){return current.pathname;},get search(){return current.search;}};
 const context={window,document,location,URLSearchParams,history:{replaceState(a,b,path){current=new URL(path,origin);}},fetch:async url=>{calls.push(url);return siteVisitsReport(new Request(origin+url),{DB});}};
 vm.createContext(context);for(const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(s[1],context);
 const settle=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};await settle();
 assert.equal(document.getElementById('mirrorViews').textContent,'7');assert.equal(document.getElementById('bookViews').textContent,'4');assert.ok(document.getElementById('trend').querySelector('svg'));
 document.querySelector('[data-days="1"]').onclick();await settle();assert.ok(calls.at(-1).includes('from='+day+'&to='+day));assert.equal(document.getElementById('bookViews').textContent,'0');
 document.getElementById('from').value=shift(day,-1);document.getElementById('to').value=shift(day,-1);document.getElementById('filters').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.getElementById('bookViews').textContent,'4');assert.equal(document.getElementById('mirrorViews').textContent,'0');
 document.getElementById('site').value='testing';document.getElementById('filters').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(document.getElementById('pageViews').textContent,'0');assert.match(document.getElementById('trend').textContent,/New views and clicks/);
});
