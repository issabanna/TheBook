import {BOOK_PRODUCTS,assertPayment,fromBase64} from './payment.mjs';
import {visitsOwner,visitsDay,visitsRange} from './visits.mjs';
const conversionStart='2026-11-04T18:23:05Z';
const conversionCookie='__Host-oportals-attribution';
const conversionBooks=Object.keys(BOOK_PRODUCTS).filter(id=>!BOOK_PRODUCTS[id].service);
const conversionSources=new Set(['direct','internal','instagram','facebook','google','search','email','whatsapp','campaign','other']);
const conversionPages=new Set(['/','/checkout','/ideas','/SocialMirror',...['attention','choices','leadership','meaning'].map(s=>'/ideas/'+s),...conversionBooks.map(s=>'/book/'+s),...['about','contact','privacy','terms','refunds'].map(s=>'/info/'+s)]);
const conversionEvents=new Set(['page_view','view_item','select_item','preview_opened','begin_checkout']);
const conversionHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const conversionJson=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...conversionHeaders,...extra}});
const conversionUuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
async function conversionDigest(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function conversionSign(value,env){if(!env.DOWNLOAD_SIGNING_KEY)return null;const bytes=fromBase64(env.DOWNLOAD_SIGNING_KEY),key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('oportals-attribution-v1:'+value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function conversionAttribution(request,env){
 try{const cookie=(request?.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(conversionCookie+'='))?.slice(conversionCookie.length+1);if(!cookie||cookie.length>700)return null;const [value,sig,extra]=cookie.split('.');if(extra||!sig||await conversionSign(value,env)!==sig)return null;const data=JSON.parse(atob(value));if(!conversionUuid(data.session)||!conversionSources.has(data.source)||!Number.isFinite(data.iat)||data.iat>Date.now()+5000||data.exp!==data.iat+7*86400000||!Number.isFinite(data.exp)||data.exp<Date.now()||data.exp>Date.now()+8*86400000)return null;return data;}catch{return null;}
}
export async function recordConversionEvent(request,env){
 if(request.method!=='POST')return conversionJson({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return conversionJson({error:'Origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return conversionJson({error:'Use JSON.'},415);
 try{
  const reader=request.body?.getReader();if(!reader)return conversionJson({error:'Invalid event.'},400);let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>768){await reader.cancel();return conversionJson({error:'Event too large.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}let d;try{d=JSON.parse(new TextDecoder().decode(bytes));}catch{return conversionJson({error:'Invalid event.'},400);}
  if(d?.consent===false&&Object.keys(d).length===1)return new Response(null,{status:204,headers:{...conversionHeaders,'Set-Cookie':conversionCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
  if(!d||Object.keys(d).some(k=>!['event','eventId','session','page','book','source','consent'].includes(k))||d.consent!==true||!conversionEvents.has(d.event)||!conversionUuid(d.eventId)||!conversionUuid(d.session)||!conversionPages.has(d.page)||!conversionSources.has(d.source)||!(d.book===''||conversionBooks.includes(d.book)))return conversionJson({error:'Invalid event.'},400);
  if(d.event!=='page_view'&&!conversionBooks.includes(d.book))return conversionJson({error:'Choose a published book.'},400);
  if(d.event==='view_item'&&d.page!=='/book/'+d.book)return conversionJson({error:'Invalid book view.'},400);
  if(/bot|spider|crawler|headless|lighthouse|pagespeed/i.test(request.headers.get('user-agent')||'')||await visitsOwner(request,env))return new Response(null,{status:204,headers:conversionHeaders});
  if(!env.DB)return conversionJson({error:'Measurement unavailable.'},503);
  const now=new Date(),site=new URL(request.url).pathname.startsWith('/Testing/')?'testing':'live';
  await env.DB.prepare('INSERT OR IGNORE INTO conversion_events(site,event_id,session_id,day,occurred_at,event_name,page,book_id,source) VALUES(?,?,?,?,?,?,?,?,?)').bind(site,d.eventId.toLowerCase(),d.session.toLowerCase(),visitsDay(now),now.toISOString(),d.event,d.page,d.book,d.source).run();
  const extra={},current=await conversionAttribution(request,env);
  if(site==='live'&&(!current||current.session!==d.session||current.source!==d.source)){
   const issued=Date.now(),value=btoa(JSON.stringify({session:d.session,source:d.source,iat:issued,exp:issued+7*86400000})),sig=await conversionSign(value,env);
   if(sig)extra['Set-Cookie']=conversionCookie+'='+value+'.'+sig+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800';
  }
  return new Response(null,{status:204,headers:{...conversionHeaders,...extra}});
 }catch{return conversionJson({error:'Measurement unavailable.'},503);}
}
export async function recordCheckoutAttribution(order,request,env){
 try{const value=await conversionAttribution(request,env);if(!value||!env.DB)return;await env.DB.prepare('INSERT OR IGNORE INTO conversion_checkout_attribution(order_id,session_id,source,started_at) VALUES(?,?,?,?)').bind(order.id,value.session,value.source,new Date().toISOString()).run();}catch{}
}
async function purchaseAttribution(payment,env,request,paid){
 const allocation=(await env.DB.prepare('SELECT order_id FROM book_payment_allocations WHERE transaction_id=?').bind(payment.get('txn_id')).all()).results[0];
 if(allocation?.order_id){const row=(await env.DB.prepare('SELECT * FROM conversion_checkout_attribution WHERE order_id=?').bind(allocation.order_id).all()).results[0];return row&&Date.parse(row.started_at)<=paid.valueOf()+120000?{session:row.session_id,source:row.source}:null;}
 const cookie=await conversionAttribution(request,env);return cookie&&cookie.iat<=paid.valueOf()+5000&&paid.valueOf()-cookie.iat<=7*86400000?cookie:null;
}
// Call only with independently verified PayPal data. Reporting cannot authorise
// a payment, allocate a book, grant a download or interfere with paid delivery.
export async function recordVerifiedPurchase(payment,book,env,request=null){
 try{
  if(!env.DB||env.PAYPAL_ENV==='sandbox'||payment.get('test_ipn')==='1')return null;
  assertPayment(payment,env);if(book!==null&&(!BOOK_PRODUCTS[book]||BOOK_PRODUCTS[book].service))return null;
  const raw=payment.get('mc_gross'),paid=new Date(payment.get('payment_date')||'');if(!/^\d+\.\d{2}$/.test(raw)||!Number.isFinite(paid.valueOf()))return null;
  const value=Math.round(Number(raw)*100),hash=await conversionDigest('oportals-purchase:'+payment.get('txn_id')),reference='OP-'+hash.slice(0,24),now=new Date().toISOString(),attribution=await purchaseAttribution(payment,env,request,paid),id=book||'unassigned';
  await env.DB.prepare('INSERT OR IGNORE INTO conversion_purchases(transaction_hash,order_reference,book_id,value_cents,currency,paid_at,paid_day,recorded_at,session_id,source) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(hash,reference,id,value,'USD',paid.toISOString(),visitsDay(paid),now,attribution?.session||null,attribution?.source||'unknown').run();
  let row=(await env.DB.prepare('SELECT * FROM conversion_purchases WHERE transaction_hash=?').bind(hash).all()).results[0];
  if(!row||row.value_cents!==value||row.currency!=='USD'||(row.book_id!==id&&row.book_id!=='unassigned'&&id!=='unassigned'))return null;
  if(book&&row.book_id==='unassigned')await env.DB.prepare("UPDATE conversion_purchases SET book_id=? WHERE transaction_hash=? AND book_id='unassigned'").bind(book,hash).run();
  if(attribution&&row.source==='unknown')await env.DB.prepare("UPDATE conversion_purchases SET session_id=?,source=? WHERE transaction_hash=? AND source='unknown'").bind(attribution.session,attribution.source,hash).run();
  if(!book)return null;
  return {transaction_id:reference,value:value/100,currency:'USD',items:[{item_id:book,item_name:BOOK_PRODUCTS[book].title,price:value/100,quantity:1}],eligible:paid.valueOf()>=Date.parse(conversionStart)};
 }catch{return null;}
}
export async function recordVerifiedRefund(payment,env){
 try{
  if(!env.DB||env.PAYPAL_ENV==='sandbox'||payment.get('test_ipn')==='1'||!['Refunded','Reversed','Canceled_Reversal'].includes(payment.get('payment_status')))return;
  const seller=(payment.get('receiver_email')||payment.get('business')||'').toLowerCase();if(!env.PAYPAL_RECEIVER_EMAIL||seller!==env.PAYPAL_RECEIVER_EMAIL.toLowerCase()||payment.get('mc_currency')!=='USD'||!payment.get('parent_txn_id')||!payment.get('txn_id'))return;
  const raw=payment.get('mc_gross')||'',paid=new Date(payment.get('payment_date')||'');if(!/^-?\d+\.\d{2}$/.test(raw)||!Number.isFinite(paid.valueOf()))return;const cents=Math.round(Math.abs(Number(raw))*100);if(cents<=0)return;
  await env.DB.prepare('INSERT OR IGNORE INTO conversion_refunds(refund_hash,transaction_hash,value_cents,state,occurred_at,day) VALUES(?,?,?,?,?,?)').bind(await conversionDigest('oportals-refund:'+payment.get('txn_id')+':'+payment.get('payment_status')),await conversionDigest('oportals-purchase:'+payment.get('parent_txn_id')),cents,payment.get('payment_status'),paid.toISOString(),visitsDay(paid)).run();
 }catch{}
}
export async function conversionReport(request,env){
 if(!env.DB)return conversionJson({error:'The conversion dashboard is unavailable.'},503);
 let range;try{range=visitsRange(new URL(request.url));}catch(error){return conversionJson({error:error.message},400);}
 try{
  const eventWhere='e.day BETWEEN ? AND ?'+(range.site==='all'?'':' AND e.site=?')+' AND COALESCE(s.stats_excluded,0)=0',eventBind=range.site==='all'?[range.from,range.to]:[range.from,range.to,range.site];
  const eventRows=(await env.DB.prepare('SELECT e.source,e.book_id,e.event_name,COUNT(*) AS count,COUNT(DISTINCT e.site||e.session_id) AS sessions FROM conversion_events e LEFT JOIN site_sessions s ON s.site=e.site AND s.session_id=e.session_id WHERE '+eventWhere+' GROUP BY e.source,e.book_id,e.event_name').bind(...eventBind).all()).results;
  const sessionRows=(await env.DB.prepare("SELECT e.source,COUNT(DISTINCT e.site||e.session_id) AS sessions FROM conversion_events e LEFT JOIN site_sessions s ON s.site=e.site AND s.session_id=e.session_id WHERE "+eventWhere+" AND e.event_name='page_view' GROUP BY e.source").bind(...eventBind).all()).results;
  const sales=range.site==='testing'?[]:(await env.DB.prepare("SELECT p.source,p.book_id,COUNT(*) AS purchases,SUM(p.value_cents) AS gross_cents,SUM(MIN(p.value_cents,COALESCE(r.refunds,0))) AS refunded_cents FROM conversion_purchases p LEFT JOIN (SELECT transaction_hash,SUM(CASE WHEN state='Refunded' THEN value_cents ELSE 0 END)+MAX(0,SUM(CASE WHEN state='Reversed' THEN value_cents WHEN state='Canceled_Reversal' THEN -value_cents ELSE 0 END)) AS refunds FROM conversion_refunds GROUP BY transaction_hash) r ON r.transaction_hash=p.transaction_hash LEFT JOIN site_sessions s ON s.site='live' AND s.session_id=p.session_id WHERE p.paid_day BETWEEN ? AND ? AND COALESCE(s.stats_excluded,0)=0 GROUP BY p.source,p.book_id").bind(range.from,range.to).all()).results;
  const sourceNames=new Set([...eventRows.map(r=>r.source),...sales.map(r=>r.source)]),total=(rows,key)=>rows.reduce((sum,r)=>sum+Number(r[key]||0),0),events=(rows,event)=>total(rows.filter(r=>r.event_name===event),'count');
  const sources=[...sourceNames].map(source=>{const e=eventRows.filter(r=>r.source===source),p=sales.filter(r=>r.source===source);return {source,sessions:Number(sessionRows.find(r=>r.source===source)?.sessions||0),bookViews:events(e,'view_item'),previews:events(e,'preview_opened'),checkoutStarts:events(e,'begin_checkout'),purchases:total(p,'purchases'),gross:total(p,'gross_cents')/100,refunds:total(p,'refunded_cents')/100,net:(total(p,'gross_cents')-total(p,'refunded_cents'))/100}});
  const books=conversionBooks.map(book=>{const e=eventRows.filter(r=>r.book_id===book),p=sales.filter(r=>r.book_id===book);return {book,title:BOOK_PRODUCTS[book].title,views:events(e,'view_item'),previews:events(e,'preview_opened'),checkoutStarts:events(e,'begin_checkout'),purchases:total(p,'purchases'),gross:total(p,'gross_cents')/100}});
  const summary={sessions:total(sources,'sessions'),bookViews:events(eventRows,'view_item'),previews:events(eventRows,'preview_opened'),checkoutStarts:events(eventRows,'begin_checkout'),purchases:total(sales,'purchases'),gross:total(sales,'gross_cents')/100,refunds:total(sales,'refunded_cents')/100,net:(total(sales,'gross_cents')-total(sales,'refunded_cents'))/100,unassignedPurchases:total(sales.filter(r=>r.book_id==='unassigned'),'purchases')};
  return conversionJson({range,summary,sources,books,measurementStartedAt:conversionStart,generatedAt:new Date().toISOString(),currency:'USD',notes:'Consented interactions are measured separately from verified PayPal sales. Purchases use their original payment date. Unassigned verified payments await book selection. Refund totals refer to the selected sales period. Source attribution is observational; unknown means no consented source was available. Excluded sessions are omitted.'});
 }catch{return conversionJson({error:'The conversion dashboard is temporarily unavailable. Please try again.'},503);}
}
