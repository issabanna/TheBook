import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomBytes,createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminAuthRoute,adminSession,adminReturnPath} from '../src/admin-auth.mjs';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com',password='local-fixture-only',salt=randomBytes(16).toString('hex');
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const file of ['0001_testing_events.sql','0002_contact_messages.sql','0007_site_visits.sql','0008_site_sessions.sql'])sql.exec(readFileSync('drizzle/'+file,'utf8'));
 const DB={sql,prepare(q){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:sql.prepare(q).all(...args)};},async run(){return sql.prepare(q).run(...args);}};},async batch(q){return Promise.all(q.map(s=>s.all()));}};
 return {DB,ADMIN_PASSWORD_HASH:salt+'.'+pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex'),ADMIN_SESSION_KEY:randomBytes(32).toString('hex'),PREVIEW_OWNER_EMAIL:'owner@example.com',PREVIEW_V5_KEY:'fixture'};
}
const post=(fields={},extra={})=>new Request(origin+'/admin/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams({username:'admin',password,next:'/Visits',...fields})});
const cookieOf=response=>response.headers.get('set-cookie').split(';')[0];
test('password login returns a secure eight-hour session and restores the requested private dashboard',async()=>{
 const env=fixture(),h=createHandler({visitsDashboard:'<body><header></header>Visits</body>',sessionsDashboard:'<body><header></header>Sessions</body>',testing:{keyEnv:'PREVIEW_V5_KEY',publicPreview:true,liveStorefront:true},testingDraft:'<body><footer></footer><script></script></body>'});
 const login=await h(post({next:'/Sessions?site=testing&sort=clicks'}),env);assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/Sessions?site=testing&sort=clicks');
 const set=login.headers.get('set-cookie');for(const flag of ['__Host-','Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=28800'])assert.ok(set.includes(flag));
 const cookie=cookieOf(login);assert.equal(await adminSession(new Request(origin,{headers:{cookie}}),env),true);
 for(const path of ['/Visits','/Sessions','/Testing/Visits','/Testing/Sessions','/Visits/data','/Sessions/data','/Testing']){
  const r=await h(new Request(origin+path,{headers:{cookie}}),env);assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/no-store/);if(!path.includes('/data'))assert.equal(r.headers.get('referrer-policy'),'same-origin',path+' must preserve browser form Origin');
  if(path==='/Visits')assert.match(await r.text(),/Sign out of admin/);
  if(path==='/Testing')assert.match(await r.text(),/OPORTALS_OWNER=true/);
 }
 const event=new Request(origin+'/api/visits-event',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify({event:'page_view',page:'/',target:'',source:'direct',consent:true})});
 assert.equal((await h(event,env)).status,204);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM site_visits_daily').get().n,0);
});
test('wrong credentials fail without a cookie; attempts are bounded and store no raw IP',async()=>{
 const env=fixture();for(let i=0;i<10;i++){const r=await adminAuthRoute(post({password:'wrong'},{'cf-connecting-ip':'192.0.2.7'}),env);assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);assert.ok(!(await r.text()).includes('value="wrong"'));}
 const limited=await adminAuthRoute(post({}, {'cf-connecting-ip':'192.0.2.7'}),env);assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');
 const row=env.DB.sql.prepare('SELECT * FROM contact_limits').get();assert.match(row.limit_key,/^admin:[a-f0-9]{64}$/);assert.equal(row.request_count,11);
 assert.equal((await adminAuthRoute(post({username:'other'},{'cf-connecting-ip':'192.0.2.8'}),env)).status,401);
 assert.equal((await adminAuthRoute(post({}, {'cf-connecting-ip':'192.0.2.8'}),env)).status,303);
});
test('forged, expired, excessively long and modified cookies cannot access owner pages',async()=>{
 const env=fixture(),h=createHandler({visitsDashboard:'private'}),valid=cookieOf(await adminAuthRoute(post(),env));
 const token=expires=>{const payload=expires+'.'+'a'.repeat(32),sig=createHmac('sha256',env.ADMIN_SESSION_KEY).update('admin.'+payload).digest('hex');return '__Host-oportals-admin='+payload+'.'+sig;};
 for(const cookie of [valid+'x',valid.slice(0,-1)+(valid.endsWith('0')?'1':'0'),token(Math.floor(Date.now()/1000)-1),token(Math.floor(Date.now()/1000)+28860),'__Host-oportals-admin='+'x'.repeat(201),'__Host-oportals-admin=admin']){
  assert.equal(await adminSession(new Request(origin,{headers:{cookie}}),env),false);
  assert.equal((await h(new Request(origin+'/Visits/data',{headers:{cookie}}),env)).status,401);
 }
 assert.equal(await adminSession(new Request(origin,{headers:{cookie:valid}}),{...env,ADMIN_SESSION_KEY:'rotated'}),false);
});
test('login and logout require same-origin POST and logout clears the session cookie',async()=>{
 const env=fixture();assert.equal((await adminAuthRoute(post({}, {origin:'https://example.org'}),env)).status,403);
 assert.equal((await adminAuthRoute(post({}, {origin:''}),env)).status,403);
 assert.equal((await adminAuthRoute(new Request(origin+'/admin/logout'),env)).status,405);
 assert.equal((await adminAuthRoute(new Request(origin+'/admin/logout',{method:'POST',headers:{origin:'https://example.org'}}),env)).status,403);
 const result=await adminAuthRoute(new Request(origin+'/admin/logout',{method:'POST',headers:{origin}}),env);assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/admin/login');assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await adminAuthRoute(post(),{})).status,503);
 assert.equal((await adminAuthRoute(post({password:'x'.repeat(3000)}),env)).status,413);
});
test('login pages preserve only safe local destinations and keep credentials out of HTML',async()=>{
 const env=fixture();for(const path of ['https://evil.example','//evil.example','/Testing\\evil','/Testing\nLocation:evil','/Testing\"><script>','/admin/login'])assert.equal(adminReturnPath(path),'/Visits');
 const r=await adminAuthRoute(new Request(origin+'/admin/login?next='+encodeURIComponent('/Sessions?site=all&sort=pages')),env),html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get('referrer-policy'),'same-origin');assert.match(html,/\/Sessions\?site=all&amp;sort=pages/);assert.ok(html.includes('autocomplete="current-password"'));assert.ok(html.includes('Sign in with ChatGPT'));assert.ok(!html.includes(password));assert.ok(!html.includes(env.ADMIN_PASSWORD_HASH));assert.ok(!html.includes('visits-tracking'));assert.match(r.headers.get('x-robots-tag'),/noindex/);
 const login=await adminAuthRoute(post({next:'https://evil.example'}),env);assert.equal(login.headers.get('location'),'/Visits');
});

test('all embedded admin forms preserve browser POST origin and still reject null or foreign origins',async()=>{
 const env=fixture(),h=createHandler({testing:{keyEnv:'PREVIEW_V5_KEY',publicPreview:true,liveStorefront:true},testingDraft:'<body><footer></footer><script></script></body>'});
 for(const path of ['/Visits','/Sessions','/Testing/Visits','/Testing/Sessions','/Testing/contact-inbox','/contact-inbox']){
  const r=await h(new Request(origin+path),env),html=await r.text();assert.equal(r.status,401);assert.ok(html.includes('action="/admin/login"'));assert.equal(r.headers.get('referrer-policy'),'same-origin',path);assert.ok(!html.includes('<meta name="referrer" content="no-referrer">'));
 }
 for(const from of ['null','','https://evil.example']){
  const r=await adminAuthRoute(post({}, {origin:from}),env);assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);assert.ok((await r.text()).includes('Please reload this sign-in page'));
 }
 const loginPage=await adminAuthRoute(new Request(origin+'/admin/login'),env);
 // A browser following same-origin retains its origin for the form POST.
 // With the former no-referrer header, that POST has the literal Origin: null.
 const browserOrigin=loginPage.headers.get('referrer-policy')==='no-referrer'?'null':origin;
 const login=await adminAuthRoute(post({}, {origin:browserOrigin}),env);assert.equal(login.status,303);
 assert.equal(env.DB.sql.prepare('SELECT SUM(request_count) AS n FROM contact_limits').get().n,1);
});
