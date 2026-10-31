import {visitsRange} from './visits.mjs';
const sessionHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow, noarchive'};
const sessionJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:sessionHeaders});
const sessionDuration="MAX(0,CAST(ROUND((julianday(last_seen_at)-julianday(started_at))*86400) AS INTEGER))";
const sessionColumns='session_id AS id,site,started_day,started_at,last_seen_at,country,city,timezone,source,first_page,last_page,page_views,distinct_pages,clicks,'+sessionDuration+' AS duration_seconds';
export async function siteSessionsReport(request,env){
 let range;try{range=visitsRange(new URL(request.url));}catch(e){return sessionJson({error:e.message},400);}
 const url=new URL(request.url),raw=url.searchParams.get('page')||'0';if(!/^\d{1,4}$/.test(raw)||Number(raw)>2000)return sessionJson({error:'Invalid page.'},400);
 if(!env.DB)return sessionJson({error:'Sessions are temporarily unavailable.'},503);
 const {from,to,site}=range,where='started_day BETWEEN ? AND ?'+(site==='all'?'':' AND site=?'),args=site==='all'?[from,to]:[from,to,site],page=Number(raw),limit=50;
 try{
  const [summary,list,first]=await env.DB.batch([
   env.DB.prepare('SELECT COUNT(*) AS sessions,COALESCE(SUM(page_views),0) AS pageViews,COALESCE(SUM(clicks),0) AS clicks,COALESCE(ROUND(AVG('+sessionDuration+')),0) AS averageSeconds FROM site_sessions WHERE '+where).bind(...args),
   env.DB.prepare('SELECT '+sessionColumns+' FROM site_sessions WHERE '+where+' ORDER BY started_at DESC,session_id LIMIT ? OFFSET ?').bind(...args,limit,page*limit),
   env.DB.prepare('SELECT MIN(started_day) AS first_day FROM site_sessions')
  ]);
  const totals=summary.results[0];return sessionJson({range,summary:totals,sessions:list.results,page,limit,hasMore:(page+1)*limit<Number(totals.sessions),firstDay:first.results[0]?.first_day||null,generatedAt:new Date().toISOString()});
 }catch{return sessionJson({error:'Sessions are temporarily unavailable. Please try again shortly.'},503);}
}
export async function siteSessionTimeline(request,env,id){
 const site=new URL(request.url).searchParams.get('site')||(new URL(request.url).pathname.startsWith('/Testing/')?'testing':'live');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!['live','testing'].includes(site))return sessionJson({error:'Invalid session.'},400);
 if(!env.DB)return sessionJson({error:'Sessions are temporarily unavailable.'},503);
 try{
  const [found,events]=await env.DB.batch([
   env.DB.prepare('SELECT '+sessionColumns+' FROM site_sessions WHERE site=? AND session_id=?').bind(site,id.toLowerCase()),
   env.DB.prepare('SELECT sequence,occurred_at,event_name,page,target FROM site_session_events WHERE site=? AND session_id=? ORDER BY sequence,occurred_at,event_id LIMIT 10001').bind(site,id.toLowerCase())
  ]);
  if(!found.results.length)return sessionJson({error:'This session was not found.'},404);
  return sessionJson({session:found.results[0],events:events.results});
 }catch{return sessionJson({error:'Could not load this session. Please try again shortly.'},503);}
}
