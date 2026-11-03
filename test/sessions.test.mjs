import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import vm from 'node:vm';import {createRequire} from 'node:module';
import {createHandler} from '../src/worker.mjs';import {recordSiteVisit,visitsDay,siteVisitsReport} from '../src/visits.mjs';import {siteSessionsReport,siteSessionTimeline,setSessionStatsExclusion} from '../src/sessions.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom'),origin='https://oportals.com',auth={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of ['0001_testing_events.sql','0007_site_visits.sql','0008_site_sessions.sql','0010_session_stats_exclusions.sql'])sql.exec(readFileSync('drizzle/'+f,'utf8'));return {sql,prepare(q){let a=[];return {bind(...p){a=p;return this;},async all(){return {results:sql.prepare(q).all(...a)};},async run(){return {meta:{changes:sql.prepare(q).run(...a).changes}};}};},async batch(q){sql.exec('BEGIN');try{const out=[];for(const s of q)out.push(await s.all());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
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
test('sorting is numeric, allowlisted and applied before pagination across the full result set',async()=>{
 const DB=database(),day=visitsDay(),high='00000000-0000-4000-8000-000000000001';
 fixtureEvent(DB,high,day,day+'T07:00:00Z',1,'page_view','/');
 for(let i=2;i<=12;i++)fixtureEvent(DB,high,day,day+'T07:01:00Z',i,'click','/','buy:life-secrets');
 for(let i=2;i<=55;i++)fixtureEvent(DB,'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),day,day+'T10:00:00Z',1,'page_view','/');
 const read=async query=>{const r=await siteSessionsReport(new Request(origin+'/Sessions/data?'+query),{DB});assert.equal(r.status,200);return r.json();};
 const initial=await read('');assert.equal(initial.sessions.length,50);assert.ok(!initial.sessions.some(s=>s.id===high));
 const descending=await read('sort=clicks&direction=desc');assert.equal(descending.sessions[0].id,high);assert.equal(descending.sessions[0].clicks,11);assert.equal(descending.hasMore,true);
 const ascending=await read('sort=clicks&direction=asc');assert.ok(ascending.sessions.every(s=>s.clicks===0));
 const second=await read('sort=clicks&direction=asc&page=1');assert.equal(second.sessions.length,5);assert.equal(second.sessions.at(-1).id,high);
 const firstStarted=await read('sort=started&direction=asc');assert.equal(firstStarted.sessions[0].id,high);
 const longest=await read('sort=duration&direction=desc');assert.equal(longest.sessions[0].duration_seconds,60);
 assert.equal((await siteSessionsReport(new Request(origin+'/Sessions/data?sort=clicks%3BDROP+TABLE+site_sessions'),{DB})).status,400);
 assert.equal((await siteSessionsReport(new Request(origin+'/Sessions/data?direction=DOWN'),{DB})).status,400);
});
test('location sorting follows the displayed city/country names instead of country-code order',async()=>{
 const DB=database(),day=visitsDay();
 const entries=[['GB','','United Kingdom'],['JO','Amman','Amman'],['CA','','Canada'],['US','','United States']];
 for(let i=0;i<entries.length;i++){const id=randomUUID();fixtureEvent(DB,id,day,day+'T08:00:00Z',1,'page_view','/');DB.sql.prepare('UPDATE site_sessions SET country=?,city=? WHERE session_id=?').run(entries[i][0],entries[i][1],id);}
 const data=await (await siteSessionsReport(new Request(origin+'/Sessions/data?sort=location&direction=asc'),{DB})).json();assert.deepEqual(data.sessions.map(s=>s.city||s.country),['Amman','CA','GB','US']);
 const reverse=await (await siteSessionsReport(new Request(origin+'/Sessions/data?sort=location&direction=desc'),{DB})).json();assert.deepEqual(reverse.sessions.map(s=>s.city||s.country),['US','GB','CA','Amman']);
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
test('sessions UI toggles sortable headers, opens details and switches activity modes',async()=>{
 const DB=database(),day=visitsDay(),id=randomUUID();fixtureEvent(DB,id,day,day+'T08:00:00Z',1,'page_view','/');fixtureEvent(DB,id,day,day+'T08:01:00Z',2,'click','/','buy:life-secrets');
 const html=readFileSync('public/sessions-dashboard.html','utf8'),{window}=parseHTML(html),document=window.document;
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 for(const [id,initial] of [['site','live'],['stats','included']]){let selected=initial;Object.defineProperty(document.getElementById(id),'value',{get(){return selected;},set(v){selected=v;}});}
 let current=new URL(origin+'/Sessions'),requests=[];const context={window,document,URLSearchParams,location:{get pathname(){return current.pathname;},get search(){return current.search;}},history:{replaceState(a,b,p){current=new URL(p,origin);}},fetch:async(path,options={})=>{requests.push(path);return createHandler({})(new Request(new URL(path,origin),{...options,headers:{...options.headers,...auth,origin}}),{DB,PREVIEW_OWNER_EMAIL:'owner@example.com'});}};
 vm.createContext(context);for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context);
 const settle=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};await settle();assert.equal(document.getElementById('sessions-total').textContent,'1');
 assert.equal(document.querySelectorAll('button[data-sort]').length,7);assert.equal(document.querySelector('[data-sort-column="started"]').getAttribute('aria-sort'),'descending');
 const clicks=document.querySelector('button[data-sort="clicks"]');clicks.dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.equal(new URL(requests.at(-1),origin).searchParams.get('direction'),'desc');assert.equal(document.querySelector('[data-sort-column="clicks"]').getAttribute('aria-sort'),'descending');
 clicks.dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.equal(new URL(requests.at(-1),origin).searchParams.get('direction'),'asc');assert.equal(document.querySelector('[data-sort-column="clicks"]').getAttribute('aria-sort'),'ascending');assert.equal(document.querySelector('[data-sort-column="started"]').getAttribute('aria-sort'),'none');
 document.querySelector('[data-session] button').dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.equal(document.getElementById('session-dialog').open,true);assert.equal(document.querySelectorAll('#timeline .event').length,1);assert.match(document.getElementById('timeline').textContent,/Buy Now/);
 document.getElementById('all-activity').onclick();assert.equal(document.querySelectorAll('#timeline .event').length,2);
 const toggle=document.getElementById('toggle-session-stats');await toggle.onclick();await settle();assert.equal(document.getElementById('sessions-total').textContent,'0');assert.equal(document.querySelectorAll('[data-session]').length,0);assert.equal(document.getElementById('session-stats-label').textContent,'Restore to stats');assert.equal(document.getElementById('session-dialog').open,true);
 document.getElementById('close-detail').onclick();assert.equal(document.getElementById('session-dialog').open,false);
 const stats=document.getElementById('stats');stats.value='excluded';stats.dispatchEvent(new window.Event('change'));await settle();assert.equal(document.querySelectorAll('[data-session]').length,1);assert.match(document.querySelector('[data-session]').textContent,/Excluded/);assert.equal(document.getElementById('sessions-total').textContent,'0');assert.match(document.getElementById('page-caption').textContent,/of 1 sessions/);
 document.querySelector('[data-session] button').dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.equal(document.getElementById('session-stats-label').textContent,'Restore to stats');await toggle.onclick();await settle();assert.equal(document.getElementById('sessions-total').textContent,'1');assert.equal(document.querySelectorAll('[data-session]').length,0);assert.equal(document.getElementById('session-stats-label').textContent,'Exclude from stats');
});

test('excluding a session reconciles every day and action, retains history and restores exactly once',async()=>{
 const DB=database(),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'},id=randomUUID(),other=randomUUID(),day=visitsDay(),prior=new Date(day+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);const yesterday=prior.toISOString().slice(0,10);
 fixtureEvent(DB,id,yesterday,yesterday+'T23:59:00Z',1,'page_view','/book/life-secrets');
 fixtureEvent(DB,id,day,day+'T00:01:00Z',2,'click','/book/life-secrets','preview:life-secrets');
 fixtureEvent(DB,id,day,day+'T00:02:00Z',3,'click','/book/life-secrets','buy:life-secrets');
 fixtureEvent(DB,id,day,day+'T00:03:00Z',4,'page_view','/SocialMirror');
 fixtureEvent(DB,id,day,day+'T00:04:00Z',5,'click','/SocialMirror','mirror_start');
 fixtureEvent(DB,other,day,day+'T01:00:00Z',1,'page_view','/SocialMirror');
 fixtureEvent(DB,id,day,day+'T01:00:00Z',1,'page_view','/SocialMirror','','testing');
 // Five historic aggregate-only visits cannot be attributed to this session.
 DB.sql.prepare("UPDATE site_visits_daily SET event_count=event_count+5 WHERE site='live' AND page='/SocialMirror' AND event_name='page_view'").run();
 const mutate=async(excluded,site='live')=>{
  const req=new Request(origin+'/Sessions/session/'+id+'/stats?site='+site,{method:'POST',headers:{...auth,origin,'Content-Type':'application/json'},body:JSON.stringify({excluded})});
  const r=await createHandler({})(req,env);assert.equal(r.status,200);return r.json();
 };
 const visits=async()=> (await siteVisitsReport(new Request(origin+'/Visits/data?from='+yesterday+'&to='+day),env)).json();
 const before=await visits();assert.equal(before.summary.pageViews,8);assert.equal(before.summary.clicks,3);
 assert.equal((await mutate(true)).session.stats_excluded,1);await mutate(true);
 const excluded=await visits();assert.equal(excluded.summary.pageViews,6);assert.equal(excluded.summary.clicks,0);assert.equal(excluded.summary.bookViews,0);assert.equal(excluded.summary.previewClicks,0);assert.equal(excluded.summary.buyClicks,0);assert.equal(excluded.mirror.mirror_start,0);assert.ok(excluded.trend.every(r=>r.count>0));assert.ok(excluded.actions.every(r=>r.count>0));
 const timeline=await(await siteSessionTimeline(new Request(origin+'/Sessions/session/'+id),env,id)).json();assert.equal(timeline.events.length,5);assert.equal(timeline.session.stats_excluded,1);
 // An additional event in the excluded session is retained without affecting any total.
 const next={...body(id,6,'page_view','/ideas'),eventId:randomUUID()};assert.equal((await recordSiteVisit(request(next),env)).status,204);assert.equal((await recordSiteVisit(request(next),env)).status,204);
 assert.deepEqual((await visits()).summary,excluded.summary);
 const sessions=await(await siteSessionsReport(new Request(origin+'/Sessions/data?site=all&stats=all'),env)).json();assert.equal(sessions.summary.sessions,2);assert.equal(sessions.total,3);assert.equal(sessions.excludedSessions,1);assert.equal(sessions.sessions.find(s=>s.id===id&&s.site==='testing').stats_excluded,0);
 const only=await(await siteSessionsReport(new Request(origin+'/Sessions/data?stats=excluded'),env)).json();assert.equal(only.sessions.length,1);assert.equal(only.summary.sessions,1);assert.equal(only.summary.pageViews,1);
 assert.equal((await mutate(false)).session.stats_excluded,0);await mutate(false);
 const restored=await visits();assert.equal(restored.summary.pageViews,before.summary.pageViews+1);assert.equal(restored.summary.clicks,before.summary.clicks);assert.equal(restored.pages.find(p=>p.page==='/ideas').views,1);
 assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM site_session_events WHERE site=? AND session_id=?').get('live',id).n,6);
 for(let i=0;i<3;i++){await mutate(true);await mutate(false);}assert.deepEqual((await visits()).summary,restored.summary);
 assert.equal((await siteSessionsReport(new Request(origin+'/Sessions/data?stats=bad'),env)).status,400);
});

test('session exclusion changes require owner authentication, same-origin POST and a bounded explicit boolean',async()=>{
 const DB=database(),env={DB,PREVIEW_OWNER_EMAIL:'owner@example.com'},id=randomUUID(),h=createHandler({});fixtureEvent(DB,id,visitsDay(),new Date().toISOString(),1,'page_view','/');
 const call=(overrides={})=>{const {path='/Sessions/session/'+id+'/stats',method='POST',headers={},raw='{"excluded":true}'}=overrides;return h(new Request(origin+path,{method,headers:{...auth,origin,'Content-Type':'application/json',...headers},...(!['GET','HEAD'].includes(method)?{body:raw}:{})}),env);};
 assert.equal((await call({headers:{'oai-authenticated-user-id':'','oai-authenticated-user-email':''}})).status,401);
 assert.equal((await call({headers:{'oai-authenticated-user-email':'other@example.com'}})).status,403);
 for(const method of ['GET','HEAD','PUT'])assert.equal((await call({method})).status,405);
 for(const origin of ['', 'null', 'https://other.example'])assert.equal((await call({headers:{origin}})).status,403);
 assert.equal((await call({headers:{'Content-Type':'text/plain'}})).status,415);
 for(const raw of ['null','[]','{}','{"excluded":1}','{"excluded":false,"email":"x"}','{'])assert.equal((await call({raw})).status,400);
 assert.equal((await call({raw:'x'.repeat(257)})).status,413);
 assert.equal((await call({path:'/Sessions/session/'+randomUUID()+'/stats'})).status,404);
 assert.equal((await call({path:'/Sessions/session/invalid/stats'})).status,400);
 assert.equal((await call({path:'/Sessions/session/'+id+'/stats?site=all'})).status,400);
 assert.equal(DB.sql.prepare('SELECT stats_excluded FROM site_sessions').get().stats_excluded,0);
 fixtureEvent(DB,id,visitsDay(),new Date().toISOString(),1,'page_view','/','','testing');
 assert.equal((await call({path:'/Testing/Sessions/session/'+id+'/stats'})).status,200);assert.equal(DB.sql.prepare('SELECT stats_excluded FROM site_sessions WHERE site=?').get('testing').stats_excluded,1);assert.equal(DB.sql.prepare('SELECT stats_excluded FROM site_sessions WHERE site=?').get('live').stats_excluded,0);
 assert.equal((await setSessionStatsExclusion(new Request(origin+'/Sessions/session/'+id+'/stats',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{"excluded":true}'}),env,id)).status,401);
});

test('the exclusion migration preserves existing sessions, events and daily totals until the owner chooses a session',()=>{
 const sql=new DatabaseSync(':memory:');for(const f of ['0007_site_visits.sql','0008_site_sessions.sql'])sql.exec(readFileSync('drizzle/'+f,'utf8'));
 const id=randomUUID(),day=visitsDay(),at=new Date().toISOString();sql.prepare('INSERT INTO site_sessions(site,session_id,started_day,started_at,last_seen_at,source,first_page,last_page) VALUES(?,?,?,?,?,?,?,?)').run('live',id,day,at,at,'direct','/','/');
 sql.prepare('INSERT INTO site_session_events(site,session_id,event_id,sequence,day,occurred_at,event_name,page,target,source,country) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('live',id,id,1,day,at,'page_view','/','','direct','ZZ');
 const daily=sql.prepare('SELECT * FROM site_visits_daily').all(),events=sql.prepare('SELECT * FROM site_session_events').all(),session=sql.prepare('SELECT * FROM site_sessions').get();sql.exec(readFileSync('drizzle/0010_session_stats_exclusions.sql','utf8'));
 assert.deepEqual(sql.prepare('SELECT * FROM site_visits_daily').all(),daily);assert.deepEqual(sql.prepare('SELECT * FROM site_session_events').all(),events);const updated=sql.prepare('SELECT * FROM site_sessions').get();assert.equal(updated.stats_excluded,0);delete updated.stats_excluded;assert.deepEqual(updated,session);
});
