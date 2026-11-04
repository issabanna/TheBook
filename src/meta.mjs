import {BOOK_PRODUCTS,assertPayment} from './payment.mjs';
import {visitsOwner} from './visits.mjs';

// One existing dataset. The token is read only while making the server request.
export const META_PIXEL_ID='4490808921236945';
const metaCookie='__Host-oportals-meta',metaLifetime=7*86400000;
const metaUtmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const metaHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
const metaJson=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...metaHeaders,...extra}});
const metaUuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const metaBook=id=>Object.hasOwn(BOOK_PRODUCTS,id)&&!BOOK_PRODUCTS[id].service;
const metaBot=r=>/bot|spider|crawler|headless|lighthouse|pagespeed/i.test(r?.headers.get('user-agent')||'');
const metaEnabled=env=>env.META_TRACKING_ENABLED==='true'&&(!env.META_PIXEL_ID||env.META_PIXEL_ID===META_PIXEL_ID);
export function metaPublicConfig(env){return {pixelId:META_PIXEL_ID,enabled:metaEnabled(env),testMode:env.META_TEST_MODE==='true'};}
async function metaHash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function metaMac(id,env){
 if(!env.DOWNLOAD_SIGNING_KEY)return null;
 const bytes=Uint8Array.from(atob(env.DOWNLOAD_SIGNING_KEY),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('oportals-meta-context-v1:'+id)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function metaContext(request,env,{revoked=false}={}){
 try{
  const value=(request?.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(metaCookie+'='))?.slice(metaCookie.length+1);
  if(!value||value.length>150)return null;const [id,signature,extra]=value.split('.');
  if(extra||!metaUuid(id)||!signature||await metaMac(id,env)!==signature)return null;
  const row=(await env.DB.prepare('SELECT * FROM meta_contexts WHERE id=?').bind(id).all()).results[0];
  return row&&(revoked||(!row.revoked_at&&row.expires_at>Date.now()))?row:null;
 }catch{return null;}
}
function metaSafeUtm(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!metaUtmKeys.includes(k)))return null;
 if(Object.values(value).some(v=>typeof v!=='string'||!/^[A-Za-z0-9_. -]{1,150}$/.test(v)))return null;
 return Object.fromEntries(metaUtmKeys.filter(k=>value[k]).map(k=>[k,value[k]]));
}
function metaIdentifier(value,type){
 if(value===undefined||value===null||value==='')return null;
 const pattern=type==='fbp'?/^fb\.\d{1,2}\.\d{13}\.[0-9]{1,40}$/:/^fb\.\d{1,2}\.\d{13}\.[A-Za-z0-9_-]{1,500}$/;
 return typeof value==='string'&&pattern.test(value)?value:false;
}
export async function metaConsent(request,env){
 if(request.method!=='POST')return metaJson({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return metaJson({error:'Origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return metaJson({error:'Use JSON.'},415);
 try{
  const reader=request.body?.getReader();if(!reader)return metaJson({error:'Invalid choice.'},400);
  let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return metaJson({error:'Request too large.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
  let d;try{d=JSON.parse(new TextDecoder().decode(bytes));}catch{return metaJson({error:'Invalid choice.'},400);}
  if(d?.consent===false&&Object.keys(d).every(k=>['consent','context'].includes(k))&&(d.context==null||metaUuid(d.context))){
   const context=d.context?{id:d.context}:await metaContext(request,env,{revoked:true});
   if(context&&env.DB){
    // A revocation tombstone wins even when its grant request is still in flight
    // and the browser has not received the signed cookie yet.
    await env.DB.prepare("INSERT INTO meta_contexts(id,consented_at,expires_at,revoked_at) VALUES(?,0,0,?) ON CONFLICT(id) DO UPDATE SET revoked_at=excluded.revoked_at,fbp=NULL,fbc=NULL,utm_json='{}'").bind(context.id,Date.now()).run();
    await env.DB.prepare("UPDATE meta_purchase_outbox SET state='dropped',payload_json='{}',last_error_code='consent-withdrawn' WHERE context_id=? AND state='pending'").bind(context.id).run();
   }
   return new Response(null,{status:204,headers:{...metaHeaders,'Set-Cookie':metaCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
  }
  if(!d||d.consent!==true||!metaUuid(d.context)||Object.keys(d).some(k=>!['consent','context','session','utm','fbp','fbc'].includes(k))||d.session!=null&&!metaUuid(d.session))return metaJson({error:'Invalid choice.'},400);
  const utm=metaSafeUtm(d.utm||{}),fbp=metaIdentifier(d.fbp,'fbp'),fbc=metaIdentifier(d.fbc,'fbc');
  if(!utm||fbp===false||fbc===false)return metaJson({error:'Invalid attribution.'},400);
  if(!metaEnabled(env)||!env.DB||!env.DOWNLOAD_SIGNING_KEY)return metaJson({enabled:false},200);
  if(new URL(request.url).pathname.startsWith('/Testing/')||metaBot(request)||await visitsOwner(request,env))return new Response(null,{status:204,headers:metaHeaders});
  const now=Date.now();
  await env.DB.prepare('INSERT OR IGNORE INTO meta_contexts(id,session_id,consented_at,expires_at,fbp,fbc,utm_json) VALUES(?,?,?,?,?,?,?)').bind(d.context,d.session||null,now,now+metaLifetime,fbp,fbc,JSON.stringify(utm)).run();
  const context=(await env.DB.prepare('SELECT * FROM meta_contexts WHERE id=?').bind(d.context).all()).results[0];
  if(!context||context.revoked_at||context.expires_at<=now)return metaJson({enabled:false},200,{'Set-Cookie':metaCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
  // Acquisition belongs to the consented context; a PayPal return cannot replace it.
  await env.DB.prepare('UPDATE meta_contexts SET fbp=COALESCE(?,fbp),fbc=COALESCE(?,fbc) WHERE id=? AND revoked_at IS NULL').bind(fbp,fbc,context.id).run();
  return metaJson({enabled:true},200,{'Set-Cookie':metaCookie+'='+context.id+'.'+await metaMac(context.id,env)+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800'});
 }catch{return metaJson({error:'Advertising measurement unavailable.'},503);}
}
export async function recordMetaCheckout(request,env,book,orderId=null){
 try{
  if(!metaEnabled(env)||!metaBook(book)||metaBot(request)||await visitsOwner(request,env))return;
  const context=await metaContext(request,env);if(!context)return;const now=Date.now();
  await env.DB.prepare('INSERT OR IGNORE INTO meta_checkouts(id,context_id,book_id,started_at,expires_at) VALUES(?,?,?,?,?)').bind(orderId||crypto.randomUUID(),context.id,book,now,now+86400000).run();
 }catch{} // Attribution must never prevent checkout.
}
async function metaPurchaseContext(payment,book,env,request,paid){
 const allocation=(await env.DB.prepare('SELECT order_id FROM book_payment_allocations WHERE transaction_id=?').bind(payment.get('txn_id')).all()).results[0];
 let checkout;
 if(allocation?.order_id)checkout=(await env.DB.prepare('SELECT * FROM meta_checkouts WHERE id=? AND book_id=?').bind(allocation.order_id,book).all()).results[0];
 else{
  const context=await metaContext(request,env);if(!context)return null;
  checkout=(await env.DB.prepare('SELECT * FROM meta_checkouts WHERE context_id=? AND book_id=? AND started_at<=? AND expires_at>=? ORDER BY started_at DESC LIMIT 1').bind(context.id,book,paid+5000,paid).all()).results[0];
 }
 if(!checkout||checkout.started_at>paid+5000||checkout.expires_at<paid)return null;
 const context=(await env.DB.prepare('SELECT m.*,s.stats_excluded FROM meta_contexts m LEFT JOIN site_sessions s ON s.site=\'live\' AND s.session_id=m.session_id WHERE m.id=?').bind(checkout.context_id).all()).results[0];
 return context&&!context.revoked_at&&!context.stats_excluded&&context.consented_at<=paid+5000&&context.expires_at>paid?context:null;
}
export async function recordMetaPurchase(payment,book,env,request=null,{fetcher=fetch,ctx=null}={}){
 try{
  if(!metaEnabled(env)||!env.DB||!metaBook(book)||metaBot(request)||request&&await visitsOwner(request,env))return;
  assertPayment(payment,env);
  const sandbox=env.PAYPAL_ENV==='sandbox'||payment.get('test_ipn')==='1',test=env.META_TEST_MODE==='true';
  if(sandbox&&!test||test&&(!sandbox||!/^TEST[A-Za-z0-9]{1,100}$/.test(env.META_TEST_EVENT_CODE||'')))return;
  const paid=Date.parse(payment.get('payment_date')||''),cutover=Date.parse(env.META_PURCHASES_FROM||'');
  if(!Number.isFinite(paid)||!Number.isFinite(cutover)||paid<cutover||paid>Date.now()+120000||Date.now()-paid>7*86400000)return;
  const hash=await metaHash('oportals-purchase:'+payment.get('txn_id')),eventId=(test?'TEST-OP-':'OP-')+hash.slice(0,24),value=Number(payment.get('mc_gross'));
  if(!test){
   const verified=(await env.DB.prepare('SELECT * FROM conversion_purchases WHERE transaction_hash=?').bind(hash).all()).results[0];
   if(!verified||verified.book_id!==book||verified.value_cents!==Math.round(value*100)||verified.currency!=='USD')return;
  }
  // No anonymous IPN is guessed into a browser. Missing consent/order attribution
  // remains untracked until the verified return resolves it.
  const context=await metaPurchaseContext(payment,book,env,request,paid);if(!context)return;
  const user={external_id:[await metaHash('oportals-meta-browser:'+context.id)]};if(context.fbp)user.fbp=context.fbp;if(context.fbc)user.fbc=context.fbc;
  const source=new URL('https://oportals.com/book/'+book);for(const [key,v] of Object.entries(JSON.parse(context.utm_json)))source.searchParams.set(key,v);
  const event={event_name:'Purchase',event_time:Math.floor(paid/1000),event_id:eventId,action_source:'website',event_source_url:source.href,user_data:user,custom_data:{content_type:'product',content_ids:[book],contents:[{id:book,quantity:1,item_price:value}],num_items:1,value,currency:'USD',order_id:eventId}};
  await env.DB.prepare('INSERT OR IGNORE INTO meta_purchase_outbox(event_id,context_id,book_id,mode,payload_json,created_at) VALUES(?,?,?,?,?,?)').bind(eventId,context.id,book,test?'test':'live',JSON.stringify(event),Date.now()).run();
  const delivery=deliverMetaPurchases(env,{fetcher,eventId});if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;
 }catch{} // Never interrupt verified PDF delivery or expose a Meta response/token.
}
export async function deliverMetaPurchases(env,{fetcher=fetch,eventId=null,limit=10}={}){
 if(!metaEnabled(env)||!env.DB||!env.META_CAPI_ACCESS_TOKEN)return {sent:0};
 const test=env.META_TEST_MODE==='true';if(test&&!/^TEST[A-Za-z0-9]{1,100}$/.test(env.META_TEST_EVENT_CODE||''))return {sent:0};
 const now=Date.now(),rows=(await env.DB.prepare("SELECT * FROM meta_purchase_outbox WHERE state IN ('pending','sending') AND next_attempt_at<=? AND lease_until<=? AND mode=?"+(eventId?' AND event_id=?':'')+' ORDER BY created_at LIMIT ?').bind(now,now,test?'test':'live',...(eventId?[eventId]:[]),Math.min(10,Math.max(1,limit))).all()).results;let sent=0;
 for(const row of rows){
  const context=(await env.DB.prepare("SELECT m.*,s.stats_excluded FROM meta_contexts m LEFT JOIN site_sessions s ON s.site='live' AND s.session_id=m.session_id WHERE m.id=?").bind(row.context_id).all()).results[0],event=JSON.parse(row.payload_json);
  if(!context||context.revoked_at||context.stats_excluded||context.expires_at<now||now-event.event_time*1000>7*86400000||now-row.created_at>=86400000){await env.DB.prepare("UPDATE meta_purchase_outbox SET state='dropped',payload_json='{}',last_error_code='consent-or-delivery-window-expired' WHERE event_id=? AND state!='sent'").bind(row.event_id).run();continue;}
  const lease=now+30000,claimed=await env.DB.prepare("UPDATE meta_purchase_outbox SET state='sending',lease_until=?,attempts=attempts+1 WHERE event_id=? AND state IN ('pending','sending') AND lease_until<=? AND next_attempt_at<=?").bind(lease,row.event_id,now,now).run();
  if(claimed.meta?.changes!==1)continue;
  let error='network';
  try{
   const body={data:[event],...(test?{test_event_code:env.META_TEST_EVENT_CODE}:{})};
   const response=await fetcher('https://graph.facebook.com/v26.0/'+META_PIXEL_ID+'/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.META_CAPI_ACCESS_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
   let result;try{result=await response.json();}catch{result=null;}
   if(response.ok&&result?.events_received===1){delete event.user_data;await env.DB.prepare("UPDATE meta_purchase_outbox SET state='sent',payload_json=?,sent_at=?,lease_until=0,last_error_code=NULL WHERE event_id=? AND state='sending' AND lease_until=?").bind(JSON.stringify(event),Date.now(),row.event_id,lease).run();sent++;continue;}
   error='http-'+response.status+(Number.isInteger(result?.error?.code)?'-meta-'+result.error.code:'');
  }catch{}
  // Ambiguous network failures retry the identical event ID; Meta can deduplicate
  // an accepted request whose acknowledgement was lost. Sent rows never resend.
  await env.DB.prepare("UPDATE meta_purchase_outbox SET state='pending',lease_until=0,next_attempt_at=?,last_error_code=? WHERE event_id=? AND state='sending' AND lease_until=?").bind(Date.now()+Math.min(3600000,30000*2**Math.min(row.attempts,7)),error,row.event_id,lease).run();
 }
 return {sent};
}
export async function metaTrackingStatus(env){
 const configuration={pixelId:META_PIXEL_ID,enabled:metaEnabled(env),tokenConfigured:!!env.META_CAPI_ACCESS_TOKEN,testMode:env.META_TEST_MODE==='true',testCodeConfigured:!!env.META_TEST_EVENT_CODE,purchasesFrom:env.META_PURCHASES_FROM||null,purchaseActivationConfigured:Number.isFinite(Date.parse(env.META_PURCHASES_FROM||''))};
 try{const rows=(await env.DB.prepare('SELECT mode,state,last_error_code,COUNT(*) AS count FROM meta_purchase_outbox GROUP BY mode,state,last_error_code').all()).results;return {...configuration,deliveries:rows};}catch{return {...configuration,deliveries:[],storageReady:false};}
}
// An owner-requested connectivity probe. This deliberately cannot represent a
// purchase, alter the sales ledger or enable test mode for live customers.
export async function metaConnectionTest(request,env,{fetcher=fetch}={}){
 if(!await visitsOwner(request,env))return metaJson({error:'Owner access required.'},401);
 if(request.method!=='POST')return metaJson({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return metaJson({error:'Origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return metaJson({error:'Use JSON.'},415);
 if(!env.META_CAPI_ACCESS_TOKEN)return metaJson({error:'The server access token is not configured.',tokenConfigured:false},503);
 try{
  const reader=request.body?.getReader();if(!reader)return metaJson({error:'Invalid test request.'},400);let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return metaJson({error:'Test request too large.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const p of chunks){bytes.set(p,offset);offset+=p.length;}
  let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return metaJson({error:'Invalid test request.'},400);}
  if(!data||data.testCode!=='TEST10333'||!metaUuid(data.eventId)||Object.keys(data).some(k=>!['testCode','eventId'].includes(k)))return metaJson({error:'Provide the approved test code and a unique test identifier.'},400);
  if(!env.DB)return metaJson({error:'Test rate limiting is unavailable.'},503);
  const windowStart=Math.floor(Date.now()/900000)*900,rate=(await env.DB.prepare('INSERT INTO contact_limits(limit_key,window_start,request_count) VALUES(?,?,1) ON CONFLICT(limit_key,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count').bind('meta-connection-test',windowStart).all()).results[0];
  if(rate.request_count>10)return metaJson({error:'Test request limit reached. Try again in 15 minutes.'},429);
  const eventId='OP-CONNECTION-'+data.eventId,event={event_name:'OPortalsConnectionTest',event_time:Math.floor(Date.now()/1000),event_id:eventId,action_source:'website',event_source_url:'https://oportals.com/',user_data:{external_id:[await metaHash('oportals-connection-test:'+data.eventId)]}};
  const response=await fetcher('https://graph.facebook.com/v26.0/'+META_PIXEL_ID+'/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.META_CAPI_ACCESS_TOKEN},body:JSON.stringify({data:[event],test_event_code:data.testCode}),signal:AbortSignal.timeout(10000)});
  let result;try{result=await response.json();}catch{result={};}
  const trace=result?.fbtrace_id||result?.error?.fbtrace_id,traceId=typeof trace==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(trace)?trace:null;
  const accepted=response.ok&&result.events_received===1,code=Number.isInteger(result?.error?.code)?result.error.code:null,subcode=Number.isInteger(result?.error?.error_subcode)?result.error.error_subcode:null;
  const explanation=accepted?null:code===190?'Meta rejected the access token.':code===10||code===200?'Meta denied access to this dataset.':'Meta did not accept the test event.';
  return metaJson({accepted,pixelId:META_PIXEL_ID,eventName:event.event_name,eventId,testCode:data.testCode,eventsReceived:Number.isInteger(result.events_received)?result.events_received:0,metaHttpStatus:response.status,traceId,...(!accepted?{error:explanation,metaErrorCode:code,metaErrorSubcode:subcode}:{}),purchaseEvent:false,financialRecordsChanged:false},accepted?200:502);
 }catch{return metaJson({accepted:false,error:'Meta test delivery is temporarily unavailable.',purchaseEvent:false},502);}
}
