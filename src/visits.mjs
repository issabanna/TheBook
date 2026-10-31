// Aggregate first-party measurements. No visitor identity or raw URL is stored.
const visitBooks=['life-secrets','art-of-attention','lead-without-the-noise','man-and-people','sneakpeak-ideas','the-philosopher-manager','time-for-what-matters','stand-out-for-something'];
const visitPages=new Set(['/','/ideas','/SocialMirror',...visitBooks.map(s=>'/book/'+s),...['about','contact','privacy','terms','refunds'].map(s=>'/info/'+s)]);
const visitSources=new Set(['direct','internal','instagram','facebook','google','search','email','whatsapp','campaign','other']);
const visitTargets=new Set(['home','ideas','social_mirror','explore_books','our_approach','external_link','paypal_checkout','week_selection',
 'mirror_start','mirror_continue','mirror_results','mirror_share_card','mirror_save_card','mirror_paid_offer','mirror_payment','mirror_copy_link','mirror_share_link','mirror_refresh','mirror_back','mirror_close_toggle','mirror_next','mirror_submit','mirror_create_own','mirror_example',
 ...visitBooks.flatMap(s=>['book:'+s,'buy:'+s,'preview:'+s]),...['all','original','inspired'].map(s=>'filter:'+s),...['about','contact','privacy','terms','refunds'].map(s=>'info:'+s)]);
const visitHeaders={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
function visitsJson(data,status=200){return new Response(JSON.stringify(data),{status,headers:visitHeaders});}
export function visitsOwner(request,env){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return !!id&&!!email&&!!env.PREVIEW_OWNER_EMAIL&&email.trim().toLowerCase()===env.PREVIEW_OWNER_EMAIL.trim().toLowerCase();}
export function visitsDay(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Amman',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(v=>[v.type,v.value]));return p.year+'-'+p.month+'-'+p.day;
}
export function withVisitsTracking(html,script){return script&&!html.includes('id="oportals-visits-tracking"')?html.replace('</body>','<script id="oportals-visits-tracking">'+script+'</script></body>'):html;}
export async function recordSiteVisit(request,env){
 if(request.method!=='POST')return visitsJson({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return visitsJson({error:'Origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return visitsJson({error:'Use JSON.'},415);
 if(Number(request.headers.get('content-length'))>512)return visitsJson({error:'Event is too large.'},413);
 try{
  const reader=request.body?.getReader();if(!reader)return visitsJson({error:'Invalid event.'},400);
  const chunks=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>512){await reader.cancel();return visitsJson({error:'Event is too large.'},413);}chunks.push(r.value);}
  const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}
  let d;try{d=JSON.parse(new TextDecoder().decode(bytes));}catch{return visitsJson({error:'Invalid event.'},400);}
  if(!d||Object.keys(d).some(k=>!['event','page','target','source','consent'].includes(k))||d.consent!==true||!['page_view','click'].includes(d.event)||!visitPages.has(d.page)||!visitSources.has(d.source)||!(d.event==='page_view'?d.target==='':visitTargets.has(d.target)))return visitsJson({error:'Invalid event.'},400);
  if(visitsOwner(request,env))return new Response(null,{status:204,headers:visitHeaders});
  if(!env.DB)return visitsJson({error:'Measurement unavailable.'},503);
  const now=new Date(),site=new URL(request.url).pathname.startsWith('/Testing/')?'testing':'live',country=/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'ZZ';
  await env.DB.prepare('INSERT INTO site_visits_daily (day,site,event_name,page,target,source,country,event_count,updated_at) VALUES (?,?,?,?,?,?,?,1,?) ON CONFLICT(day,site,event_name,page,target,source,country) DO UPDATE SET event_count=site_visits_daily.event_count+1,updated_at=excluded.updated_at').bind(visitsDay(now),site,d.event,d.page,d.target,d.source,country,now.toISOString()).run();
  return new Response(null,{status:204,headers:visitHeaders});
 }catch{return visitsJson({error:'Measurement unavailable.'},503);}
}
function validVisitDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;}
export function visitsRange(url,now=new Date()){
 const today=visitsDay(now),ago=new Date(today+'T00:00:00Z');ago.setUTCDate(ago.getUTCDate()-6);
 const from=url.searchParams.get('from')||ago.toISOString().slice(0,10),to=url.searchParams.get('to')||today,site=url.searchParams.get('site')||(url.pathname.startsWith('/Testing/')?'testing':'live');
 if(!validVisitDate(from)||!validVisitDate(to)||from>to||to>today||!['live','testing','all'].includes(site)||(new Date(to)-new Date(from))/86400000>365)throw Error('Choose a valid date range of up to 366 days, ending today or earlier.');
 return {from,to,site,timeZone:'Asia/Amman'};
}
export async function siteVisitsReport(request,env){
 let range;try{range=visitsRange(new URL(request.url));}catch(e){return visitsJson({error:e.message},400);}
 if(!env.DB)return visitsJson({error:'The visits dashboard is temporarily unavailable.'},503);
 const {from,to,site}=range,where='day BETWEEN ? AND ?'+(site==='all'?'':' AND site=?'),bind=site==='all'?[from,to]:[from,to,site];
 const q=sql=>env.DB.prepare(sql).bind(...bind);
 try{
  const reads=await env.DB.batch([
   q('SELECT event_name,target,SUM(event_count) AS count FROM site_visits_daily WHERE '+where+' GROUP BY event_name,target'),
   q('SELECT day,event_name,SUM(event_count) AS count FROM site_visits_daily WHERE '+where+' GROUP BY day,event_name ORDER BY day'),
   q("SELECT page,SUM(CASE WHEN event_name='page_view' THEN event_count ELSE 0 END) AS views,SUM(CASE WHEN event_name='click' THEN event_count ELSE 0 END) AS clicks FROM site_visits_daily WHERE "+where+' GROUP BY page ORDER BY views DESC,clicks DESC LIMIT 30'),
   q("SELECT target,SUM(event_count) AS count FROM site_visits_daily WHERE "+where+" AND event_name='click' GROUP BY target ORDER BY count DESC LIMIT 15"),
   q("SELECT source,SUM(event_count) AS count FROM site_visits_daily WHERE "+where+" AND event_name='page_view' GROUP BY source ORDER BY count DESC"),
   q("SELECT country,SUM(event_count) AS count FROM site_visits_daily WHERE "+where+" AND event_name='page_view' GROUP BY country ORDER BY count DESC LIMIT 12"),
   q('SELECT event_name,page,target,SUM(event_count) AS count FROM site_visits_daily WHERE '+where+' GROUP BY event_name,page,target'),
   env.DB.prepare('SELECT event_name,SUM(event_count) AS count FROM testing_events GROUP BY event_name'),
   env.DB.prepare('SELECT MIN(day) AS first_event FROM site_visits_daily')
  ]);
  const groups=reads[0].results,all=reads[6].results,n=v=>Number(v)||0,sum=pred=>groups.filter(pred).reduce((a,r)=>a+n(r.count),0);
  const summary={pageViews:sum(r=>r.event_name==='page_view'),clicks:sum(r=>r.event_name==='click'),bookViews:all.filter(r=>r.event_name==='page_view'&&r.page.startsWith('/book/')).reduce((a,r)=>a+n(r.count),0),previewClicks:sum(r=>r.event_name==='click'&&r.target.startsWith('preview:')),buyClicks:sum(r=>r.event_name==='click'&&r.target.startsWith('buy:')),mirrorViews:all.filter(r=>r.event_name==='page_view'&&r.page==='/SocialMirror').reduce((a,r)=>a+n(r.count),0)};
  const mirror={};for(const action of ['mirror_start','mirror_share_link','mirror_copy_link','mirror_results','mirror_share_card','mirror_save_card','mirror_paid_offer','mirror_payment'])mirror[action]=sum(r=>r.event_name==='click'&&r.target===action);
  const books=visitBooks.map(slug=>({slug,views:all.filter(r=>r.event_name==='page_view'&&r.page==='/book/'+slug).reduce((a,r)=>a+n(r.count),0),previews:sum(r=>r.event_name==='click'&&r.target==='preview:'+slug),buys:sum(r=>r.event_name==='click'&&r.target==='buy:'+slug)}));
  return visitsJson({range,summary,mirror,books,trend:reads[1].results,pages:reads[2].results,actions:reads[3].results,sources:reads[4].results,countries:reads[5].results,legacy:reads[7].results,firstEvent:reads[8].results[0]?.first_event||null,generatedAt:new Date().toISOString()});
 }catch{return visitsJson({error:'The visits dashboard is temporarily unavailable. Please try again shortly.'},503);}
}
