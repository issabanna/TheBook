import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import vm from 'node:vm';import {createRequire} from 'node:module';
import {createHandler} from '../src/worker.mjs';import {recordSiteVisit,visitsDay} from '../src/visits.mjs';import {siteSessionsReport,siteSessionTimeline} from '../src/sessions.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom'),origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of ['0001_testing_events.sql','0007_site_visits.sql','0008_site_sessions.sql'])sql.exec(readFileSync('drizzle/'+f,'utf8'));return {sql,prepare(q){let a=[];return {bind(...p){a=p;return this;},async all(){return {results:sql.prepare(q).all(...a)};},async run(){return {meta:{changes:sql.prepare(q).run(...a).changes}};}};},async batch(q){sql.exec('BEGIN');try{const out=[];for(const s of q)out.push(await s.all());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const body=(id,sequence,event='page_view',page='/',target='')=>({session:id,sequence,event,page,target,source:'instagram',timezone:'Asia/Amman',consent:true});
const request=(data,path='/api/visits-event',headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test('Sessions list, timeline and HTML are owner-only on live and Testing',async()=>{
 const DB=database(),h=createHandler({sessionsDashboard:readFileSync('public/sessions-dashboard.html','utf8')}),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'},id=randomUUID();
 for(const path of ['/Sessions','/Sessions/data','/Sessions/session/'+id,'/Testing/Sessions','/Testing/Sessions/data']){
  assert.equal((await h(new Request(origin+path),env)).status,401);
  assert.equal((await h(new Request(origin+path,{headers:{...auth,'oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
 }
 assert.equal((await h(new Request(origin+'/Sessions',{headers:auth}),env)).status,200);
 assert.equal((await h(new Request(origin+'/Sessions/data',{headers:auth}),env)).status,200);
 assert.equal((await h(new Request(origin+'/Sessions/session/'+id,{headers:auth}),env)).status,404);
 assert.equal((await h(new Request(origin+'/Sessions/session/invalid',{headers:auth}),env)).status,400);
 assert.equal((await h(new Request(origin+'/Sessions',{method:'POST',headers:auth}),env)).status,405);
 assert.equal((await h(new Request(origin+'/sessions'),env)).headers.get('location'),'/Sessions');
});
test('session event trigger keeps session and aggregate counts idempotent and ordered',async()=>{
 const DB=database(),env={DB},id=randomUUID();
 const first=request(body(id,1));Object.defineProperty(first,'cf',{value:{country:'JO',city:'Amman'}});
 assert.equal((await recordSiteVisit(first,env)).status,204);
 assert.equal((await recordSiteVisit(request(body(id,1)),env)).status,204);
 assert.equal((await recordSiteVisit(request(body(id,3,'click','/book/life-secrets','buy:life-secrets')),env)).status,204);
 assert.equal((await recordSiteVisit(request(body(id,2,'page_view','/book/life-secrets')),env)).status,204);
 assert.equal((await recordSiteVisit(request(body(id,4,'page_view','/book/life-secrets')),env)).status,204);
 const row=DB.sql.prepare('SELECT * FROM site_sessions').get();assert.equal(row.country,'JO');assert.equal(row.city,'Amman');assert.equal(row.page_views,3);assert.equal(row.distinct_pages,2);assert.equal(row.clicks,1);assert.equal(row.first_page,'/');assert.equal(row.last_page,'/book/life-secrets');
 assert.equal(DB.sql.prepare('SELECT SUM(event_count) AS n FROM site_visits_daily').get().n,4);
 const detail=await (await siteSessionTimeline(new Request(origin+'/Sessions/session/'+id),env,id)).json();assert.deepEqual(detail.events.map(e=>e.sequence),[1,2,3,4]);assert.equal(detail.events[2].target,'buy:life-secrets');
 const text=JSON.stringify(detail);assert.ok(!text.includes('email'));assert.ok(!text.includes('answers'));assert.ok(!text.includes('cf-connecting-ip'));
 assert.equal((await siteSessionTimeline(new Request(origin+'/Sessions/session/'+id+'?site=testing'),env,id)).status,404);
 // Duplicated tabs can copy the same sequence number. Distinct event IDs must
 // preserve both clicks, while retrying an already saved ID stays idempotent.
 const a={...body(id,5,'click','/book/life-secrets','preview:life-secrets'),eventId:randomUUID()},b={...body(id,5,'click','/book/life-secrets','buy:life-secrets'),eventId:randomUUID()};
 for(const d of [a,b,a])assert.equal((await recordSiteVisit(request(d),env)).status,204);
 assert.equal(DB.sql.prepare('SELECT clicks FROM site_sessions').get().clicks,3);
 assert.equal(DB.sql.prepare('SELECT SUM(event_count) AS n FROM site_visits_daily').get().n,6);
});
test('session IDs, time zones, locations and scope are bounded; owner traffic is excluded',async()=>{
 const DB=database(),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'},id=randomUUID();
 for(const d of [{...body(id,1),session:'someone@example.com'},{...body(id,1),sequence:0},{...body(id,1),sequence:10001},{...body(id,1),timezone:'bad/timezone'},{...body(id,1),email:'secret@example.com'}])assert.equal((await recordSiteVisit(request(d),env)).status,400);
 assert.equal((await recordSiteVisit(request(body(id,1),'/api/visits-event',auth),env)).status,204);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n,0);
 assert.equal((await recordSiteVisit(request(body(id,1),'/Testing/api/visits-event',{'cf-ipcountry':'GB','cf-ipcity':'London'}),env)).status,204);
 const row=DB.sql.prepare('SELECT * FROM site_sessions').get();assert.equal(row.site,'testing');assert.equal(row.country,'GB');assert.equal(row.city,'London');
});
function fixtureEvent(DB,id,day,at,sequence,event,page,target='',site='live'){
 DB.sql.prepare('INSERT OR IGNORE INTO site_sessions(site,session_id,started_day,started_at,last_seen_at,country,city,timezone,source,first_page,last_page) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(site,id,day,at,at,'GB','London','Europe/London','instagram',page,page);
 DB.sql.prepare('INSERT INTO site_session_events(site,session_id,event_id,sequence,day,occurred_at,event_name,page,target,source,country) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(site,id,id+':'+sequence,sequence,day,at,event,page,target,'instagram','GB');
}
test('session date/site filters, distinct page counts and observed duration use recorded events',async()=>{
 const DB=database(),day=visitsDay(),id=randomUUID(),other=randomUUID();
 fixtureEvent(DB,id,day,day+'T08:00:00.000Z',1,'page_view','/');fixtureEvent(DB,id,day,day+'T08:01:05.000Z',2,'click','/','book:life-secrets');fixtureEvent(DB,id,day,day+'T08:01:30.000Z',3,'page_view','/book/life-secrets');
 fixtureEvent(DB,other,day,day+'T09:00:00.000Z',1,'page_view','/SocialMirror','','testing');
 const data=await (await siteSessionsReport(new Request(origin+'/Sessions/data?from='+day+'&to='+day),{DB})).json();assert.equal(data.summary.sessions,1);assert.equal(data.summary.pageViews,2);assert.equal(data.summary.clicks,1);assert.equal(data.summary.averageSeconds,90);assert.equal(data.sessions[0].duration_seconds,90);assert.equal(data.sessions[0].distinct_pages,2);
 const all=await (await siteSessionsReport(new Request(origin+'/Sessions/data?site=all'),{DB})).json();assert.equal(all.summary.sessions,2);
 assert.equal((await siteSessionsReport(new Request(origin+'/Sessions/data?page=-1'),{DB})).status,400);
 assert.equal((await siteSessionsReport(new Request(origin+'/Sessions/data?from=2026-02-31'),{DB})).status,400);
});
test('browser session survives navigation, renews after 30 minutes and clears on opt-out',async()=>{
 const tracker=readFileSync('public/visits-tracking.js','utf8'),store=new Map(),calls=[];
 function browser(path='/',owner=false){
  const {window}=parseHTML('<a id="buy" href="/checkout?book=life-secrets">Buy</a>'),document=window.document;let current=new URL(origin+path);const local=new Map();
  const context={window:{OPORTALS_OWNER:owner,addEventListener(){}},document,location:{get pathname(){return current.pathname;},get href(){return current.href;},origin,hostname:'oportals.com'},history:{pushState(a,b,p){current=new URL(p,origin);},replaceState(a,b,p){current=new URL(p,origin);}},URL,crypto:globalThis.crypto,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},localStorage:{getItem:k=>local.get(k)||null},fetch:async(url,o)=>{calls.push(JSON.parse(o.body));return new Response(null,{status:204});}};
  vm.runInNewContext(tracker,context);return {local,click:()=>document.getElementById('buy').dispatchEvent(new window.Event('click',{bubbles:true}))};
 }
 browser('/?utm_source=instagram').click();browser('/book/life-secrets');assert.equal(calls.length,3);assert.ok(calls.every(c=>c.session===calls[0].session));assert.deepEqual(calls.map(c=>c.sequence),[1,2,3]);assert.ok(calls.every(c=>c.source==='instagram'));
 const saved=JSON.parse(store.get('oportals-visit-session-live'));saved.last=Date.now()-31*60*1000;store.set('oportals-visit-session-live',JSON.stringify(saved));browser('/ideas');assert.notEqual(calls.at(-1).session,calls[0].session);assert.equal(calls.at(-1).sequence,1);
 const current=browser('/');current.local.set('oportals-testing-measurement','deny');const n=calls.length;current.click();assert.equal(calls.length,n);assert.equal(store.has('oportals-visit-session-live'),false);
 browser('/',true);assert.equal(store.has('oportals-visit-session-live'),false);
});
test('sessions UI opens the selected session and toggles clicks versus full activity',async()=>{
 const DB=database(),day=visitsDay(),id=randomUUID();fixtureEvent(DB,id,day,day+'T08:00:00Z',1,'page_view','/');fixtureEvent(DB,id,day,day+'T08:01:00Z',2,'click','/','buy:life-secrets');
 const html=readFileSync('public/sessions-dashboard.html','utf8'),{window}=parseHTML(html),document=window.document;
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 const select=document.getElementById('site');let selected='live';Object.defineProperty(select,'value',{get(){return selected;},set(v){selected=v;}});
 let current=new URL(origin+'/Sessions');const context={window,document,URLSearchParams,location:{get pathname(){return current.pathname;},get search(){return current.search;}},history:{replaceState(a,b,p){current=new URL(p,origin);}},fetch:async path=>{const url=new URL(path,origin);return url.pathname.includes('/session/')?siteSessionTimeline(new Request(url),{DB},url.pathname.split('/').pop()):siteSessionsReport(new Request(url),{DB});}};
 vm.createContext(context);for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context);
 const settle=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};await settle();assert.equal(document.getElementById('sessions-total').textContent,'1');
 document.querySelector('[data-session] button').dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.equal(document.getElementById('session-dialog').open,true);assert.equal(document.querySelectorAll('#timeline .event').length,1);assert.match(document.getElementById('timeline').textContent,/Buy Now/);
 document.getElementById('all-activity').onclick();assert.equal(document.querySelectorAll('#timeline .event').length,2);document.getElementById('close-detail').onclick();assert.equal(document.getElementById('session-dialog').open,false);
});
