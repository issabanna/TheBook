import {recordConversionEvent,recordVerifiedPurchase,recordVerifiedRefund,recordCheckoutAttribution,conversionReport} from './conversions.mjs';
import {metaPublicConfig,metaConsent,recordMetaCheckout,recordMetaPurchase,deliverMetaPurchases,metaTrackingStatus} from './meta.mjs';
import {SEO_ORIGIN,SEO_ROBOTS,applyPageSeo,seoSitemap} from './seo.mjs';
import {usesSharedBookCheckout,sharedBookCheckoutEnabled,isNewSharedBookPayment,createBookOrder,bookPaymentAllocation,resolveBookPayment,sharedBookCheckoutPage,sharedBookRedirectPage} from './book-checkout.mjs';
import {testingOnlyBooks,testingOnlyBookSlugs} from './testing-catalogue.mjs';
import {adminAuthRoute,adminLoginPage,adminSession,adminSignOutControl} from './admin-auth.mjs';
import {siteSessionsReport,siteSessionTimeline,setSessionStatsExclusion} from './sessions.mjs';
import {visitsOwner,withVisitsTracking,recordSiteVisit,siteVisitsReport} from './visits.mjs';
import {socialMirrorApi} from './social-mirror.mjs';
import {registerFreeBook,freeBookGrant,noteFreeBookDownload,freeBookLeadReport} from './free-book-leads.mjs';
import {submitContact,contactInbox,processContactQueue,deleteContact} from './contact.mjs';
import {previewBookSlugs,recordPreviewEvent,previewMetrics} from './testing-events.mjs';
import { SITE_URL, PAYPAL_LINK, BOOK_PRODUCTS, paymentBook, PaymentError, ready, emailReady, verifyPDT, verifyIPN, assertPayment, issueToken, readToken, decryptBook, fromBase64, emailReceipt } from './payment.mjs';
// Build injects the public assets and encrypted paid book. No plaintext paid PDF is published.
const headers = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com/tr/; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com https://www.facebook.com/tr/; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function withCommerceTracking(body,assets,owner=null,env={},scope=''){
 if(!assets.commerceProducts)return body;
 body=body.replace(/<script src="\/analytics.js(?:\?[^"\s]*)?" defer><\/script>/g,'');
 const products=JSON.stringify(assets.commerceProducts).replace(/</g,'\\u003c');
 if(typeof owner==='boolean')body=body.replace('</head>','<script>window.OPORTALS_OWNER='+JSON.stringify(owner)+';</script></head>');
 const metaConfig=JSON.stringify(metaPublicConfig(env));
 const option='<label style="display:flex;align-items:flex-start;gap:10px;margin:18px 0;font:14px/1.5 Arial,sans-serif"><input id="meta-marketing-consent" type="checkbox" style="width:20px;height:20px;flex:none;margin:1px 0 0"><span><strong>Allow Meta advertising measurement</strong><br>Optional. Share book views, checkout activity and verified purchases with Meta to measure our advertising. Meta may link this activity to your account. No payer details or payment credentials are shared. Leave unchecked to keep it off.</span></label>';
 if(body.includes('id="measurement-dialog"'))body=body.replace('<div class="hero-actions"><button class="secrets-buy" id="measurement-accept">',option+'<div class="hero-actions"><button class="secrets-buy" id="measurement-accept">');
 else body=body.replace('</body>','<button id="meta-privacy-settings" type="button" style="background:transparent;color:#36515b;text-decoration:underline;font-size:13px">Advertising &amp; analytics settings</button><dialog id="measurement-dialog" aria-label="Measurement settings"><h2>Your measurement choices</h2><p>Analytics uses the existing measurement setting. Meta advertising measurement is optional and off until you allow it.</p>'+option+'<button id="measurement-accept">Save and enable analytics</button> <button id="measurement-reject">Disable all measurement</button> <button id="meta-close-settings">Close</button></dialog></body>');
 return body.replace('</head>','<script id="cro-products" type="application/json">'+products+'</script><script id="meta-tracking-config" type="application/json">'+metaConfig+'</script><script src="'+scope+'/analytics.js?v=3" defer></script><script src="'+scope+'/meta-pixel.js?v=1" defer></script></head>');
}
function withArtworkRecovery(body, source) {
 if(!source)return body;
 return body.replace('</head>','<script src="/artwork-loading.js?v=1" defer></script></head>');
}
function htmlResponse(body, status = 200) { return new Response(body, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } }); }
const pageStyle = `body{background:white;color:#243944;font:16px/1.6 Arial,sans-serif;max-width:680px;margin:6vh auto;padding:25px}h1{font:700 36px/1.15 Arial,sans-serif}a,button{display:inline-block;background:#d4e9ee;color:#193b4d;padding:14px 22px;border:0;border-radius:4px;text-decoration:none;cursor:pointer;font:inherit}small{color:#68734b}input,select{box-sizing:border-box;padding:14px;width:100%;margin:12px 0;border:1px solid #aeb49b;background:#fffdf7;font:inherit}button{margin:10px 0}#download[hidden],form[hidden]{display:none}#message{white-space:pre-wrap}a.secondary{background:transparent;color:#262b21;padding:10px 0}`;
function page(title, content) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title} — O Portals</title><style>${pageStyle}</style></head><body><small>OPortals.com</small>${content}<p><a class="secondary" href="/">Back to the bookstore</a></p></body></html>`; }
const receiptPage = page('Your book', `<h1>Your book, ready to keep.</h1><p id="message" role="status" aria-live="polite">Verifying your PayPal payment…</p><a id="download" hidden>Download your book ↓</a><form id="receipt" hidden><label for="transaction">PayPal transaction ID from your receipt</label><input id="transaction" name="transaction" maxlength="32" autocomplete="off" required pattern="[A-Za-z0-9]{8,32}"><button>Verify my purchase</button></form><form id="book-choice" hidden><label for="selected-book">Which book did you purchase?</label><select id="selected-book" required></select><button>Get my book ↓</button></form><p><small>Already paid? Verify the transaction ID on your PayPal receipt or contact us. You do not need to pay again to retry verification.</small></p><p class="receipt-support"><a href="/info/contact">Need help with your purchase?</a></p><p><small>Download links last 24 hours. Save the PDF to your device. Keep your PayPal receipt so you can verify your purchase again later.</small></p><script>
const message=document.querySelector('#message'),form=document.querySelector('#receipt'),download=document.querySelector('#download'),input=document.querySelector('#transaction');
const choiceForm=document.querySelector('#book-choice'),choiceSelect=document.querySelector('#selected-book');let verifiedTransaction=null;
const params=new URLSearchParams(location.search),tx=params.get('tx');history.replaceState(null,'',location.pathname);
async function verify(transaction,book=null){download.hidden=true;form.hidden=true;message.textContent='Verifying your PayPal payment…';try{const r=await fetch('/api/paypal/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction,book,checkout:(()=>{try{return sessionStorage.getItem('oportals-book-checkout')}catch{return null}})()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');if(data.selectionRequired){verifiedTransaction=transaction;choiceSelect.innerHTML='';const empty=document.createElement('option');empty.value='';empty.textContent='Choose your purchased book';choiceSelect.append(empty);for(const item of data.choices){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;choiceSelect.append(option);}if(data.suggestedBook)choiceSelect.value=data.suggestedBook;choiceForm.hidden=false;form.hidden=true;message.textContent='Payment verified. Confirm the book you purchased to get its PDF.';return;}choiceForm.hidden=true;if(data.service){sessionStorage.setItem('oportals-mirror-payment',transaction);location.assign('/Testing/SocialMirror?payment=1');return;}if(data.purchase?.eligible){window.OPORTALS_VERIFIED_PURCHASE=data.purchase;window.oportalsTrackPurchase?.(data.purchase);}download.href=data.download;download.hidden=false;download.textContent='Download '+(data.title||'your book')+' ↓';message.textContent='Payment verified. '+(data.title||'Your purchased PDF')+' is ready.';try{sessionStorage.removeItem('oportals-book-checkout')}catch{}}catch(e){message.textContent=e.message;form.hidden=false;}}
form.addEventListener('submit',e=>{e.preventDefault();verify(input.value.trim().toUpperCase());});
choiceForm.addEventListener('submit',e=>{e.preventDefault();if(choiceSelect.value)verify(verifiedTransaction,choiceSelect.value);});
if(tx){input.value=tx;verify(tx);}else{message.textContent='Enter the transaction ID on your PayPal receipt to verify your purchase and unlock the book.';form.hidden=false;}
</script>`);
async function limitedBody(request, limit = 16384) {
  if (Number(request.headers.get('content-length')) > limit) throw new PaymentError('Request too large.', 413);
  if (!request.body) return '';
  const reader = request.body.getReader();let total=0;const chunks=[];
  while (true) { const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new PaymentError('Request too large.',413);}chunks.push(value); }
  const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return new TextDecoder().decode(bytes);
}
const downloadCatalogue=[{"id": "the-philosopher-manager", "title": "The Philosopher Manager"},{"id": "lead-without-the-noise", "title": "Lead Without the Noise"},{"id": "time-for-what-matters", "title": "Time for What Matters"},{"id": "stand-out-for-something", "title": "Stand Out for Something"},{id:'sneakpeak-ideas',title:'SneakPeak Ideas — free collection'},{id:'life-secrets',title:'Life Secrets'},{id:'art-of-attention',title:'The Art of Attention'},{id:'man-and-people-guide',title:'Man and People — illustrated companion'},...testingOnlyBooks.map(b=>({id:b.slug,title:b.title}))];
const trackedFiles=Object.fromEntries(downloadCatalogue.flatMap(b=>[[b.id+'.pdf',{bookId:b.id,kind:'full'}],[b.id+'-sample.pdf',{bookId:b.id,kind:'sample'}]]));
async function captureDownload(env,name){
 const item=trackedFiles[name];if(!item)return;
 if(!env.DB)throw new PaymentError('Download recording is temporarily unavailable. Please try again shortly.',503);
 await env.DB.prepare('INSERT INTO download_counts (book_id, kind, download_count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(book_id, kind) DO UPDATE SET download_count = download_counts.download_count + 1, updated_at = excluded.updated_at').bind(item.bookId,item.kind,new Date().toISOString()).run();
}
async function downloadReport(env){
 if(!env.DB)throw new PaymentError('Download reporting is not available yet.',503);
 const {results}=await env.DB.prepare('SELECT book_id, kind, download_count, updated_at FROM download_counts ORDER BY book_id, kind').all();
 return downloadCatalogue.map(b=>{const rows=results.filter(r=>r.book_id===b.id);return {...b,sample:rows.find(r=>r.kind==='sample')?.download_count||0,full:rows.find(r=>r.kind==='full')?.download_count||0,lastDownload:rows.map(r=>r.updated_at).sort().at(-1)||null}});
}
function reportPage(rows){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Book downloads — OPortals.com</title><style>body{font:15px/1.6 Arial,sans-serif;color:#141414;margin:40px auto;padding:0 6%;max-width:1000px}h1{font-size:42px;line-height:1.1;letter-spacing:-1.5px}a{color:#0766ff}table{border-collapse:collapse;width:100%;margin:30px 0}th,td{text-align:left;border-bottom:1px solid #e4e8ef;padding:14px 10px}th{font-size:12px;color:#626975}td:nth-child(n+2){font-variant-numeric:tabular-nums}small,p{color:#626975}.table{overflow:auto}.total{font-size:23px;font-weight:bold;color:#0766ff}@media(max-width:600px){body{margin-top:25px}h1{font-size:34px}th,td{font-size:12px;padding:12px 8px}}</style></head><body><a href="/Testing">← Back to the private bookstore</a><h1>Book downloads.</h1><p>Private owner report · Testing downloads only</p><div class="total">${rows.reduce((n,r)=>n+r.sample+r.full,0)} recorded download requests</div><div class="table"><table><thead><tr><th>Book</th><th>Free samples</th><th>Full books</th><th>Last recorded (UTC)</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.title}</td><td>${r.sample}</td><td>${r.full}</td><td>${r.lastDownload?r.lastDownload.replace('T',' ').slice(0,19):'—'}</td></tr>`).join('')}</tbody></table></div><p><small>Counts begin when recording is enabled. A count means the server served an explicit PDF download request; it does not prove that the file was saved, read, or downloaded by a unique person. Repeat downloads count again. Inline previews, HEAD requests, and recognised prefetches do not count. Owner test downloads count too. Public checkout and public sample routes are outside this private report.</small></p><p><small>No email addresses, IP addresses, or personal identifiers are stored in these counters. Other titles will appear here when downloadable editions are available.</small></p><a href="/Testing/downloads.json">View counts as JSON ↗</a></body></html>`;
}
export function createHandler(assets, fetcher = fetch) {
 return async function handler(request, env, ctx) {
  const url=new URL(request.url);let path=url.pathname;const live=assets.testing?.liveStorefront===true&&(path==='/'||/^\/(?:book|books|media|info|checkout)\//.test(path)||path.startsWith('/ideas/')||['/ideas','/api/free-book','/leads','/leads.csv','/api/events','/api/contact','/api/contact/deliver','/api/contact/delete','/metrics','/downloads','/downloads.json','/contact-inbox'].includes(path));if(live)path='/Testing'+(path==='/'?'':path);
  try {
   const publicSeoPath=url.pathname.replace(/\/$/,'')||'/';
   if((request.method==='GET'||request.method==='HEAD')&&assets.seo?.live?.pages?.[publicSeoPath]&&((url.pathname!==publicSeoPath)||(url.hostname==='www.oportals.com'))){return new Response(null,{status:308,headers:{...headers,Location:SEO_ORIGIN+publicSeoPath+url.search}});}
   if(path.startsWith('/fonts/')){
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers});
    const name=path.slice('/fonts/'.length),file=Object.hasOwn(assets.fonts||{},name)?assets.fonts[name]:null;
    if(!file)return new Response('Font not found.',{status:404,headers});
    return new Response(request.method==='HEAD'?null:fromBase64(file.data),{headers:{...headers,'Content-Type':file.type,'Cache-Control':'public, max-age=31536000, immutable'}});
   }
   if(path==='/seo-navigation.js')return new Response(request.method==='HEAD'?null:assets.seoNavigation||'',{status:['GET','HEAD'].includes(request.method)?200:405,headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
   if(path==='/sitemap.xml')return new Response(request.method==='HEAD'?null:seoSitemap(assets.seo?.live),{status:['GET','HEAD'].includes(request.method)?200:405,headers:{...headers,'Content-Type':'application/xml; charset=utf-8'}});
   if(path==='/favicon.ico')return new Response(null,{status:308,headers:{...headers,Location:'/favicon.svg'}});
   if(['/Testing/analytics.js','/Testing/meta-pixel.js'].includes(path)&&request.method==='GET')return new Response(path.endsWith('/analytics.js')?assets.analytics:assets.metaPixel,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','X-Robots-Tag':'noindex, nofollow'}});
   if(path==='/Testing/Meta'){
    const reviewHeaders={...headers,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow, noarchive',Vary:'Cookie'};
    if(!await visitsOwner(request,env))return new Response(request.method==='HEAD'?null:adminLoginPage('/Testing/Meta'),{status:401,headers:reviewHeaders});
    const status=await metaTrackingStatus(env),safe=JSON.stringify(status,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return new Response(request.method==='HEAD'?null:page('Meta tracking review','<h1>Meta tracking on Testing.</h1><p>The tracking and consent controls are published on the public site. This Testing view stays isolated from genuine Meta reporting.</p><p><strong>Dataset:</strong> OPortals Website · 4490808921236945<br><strong>Test code:</strong> TEST10333</p><p><strong>External events are not being sent from this review.</strong> Testing and owner visits do not load the Meta browser SDK. Actual server Test Events still need a securely configured token and an isolated sandbox payment setup. The live PayPal environment has not been changed.</p><p><a href="/Testing/book/art-of-attention">Review The Art of Attention →</a></p><p><a class="secondary" href="/Testing/info/privacy">Review privacy &amp; measurement details</a></p><p>Use the existing Privacy &amp; measurement footer control to see the separate Meta consent checkbox.</p><h2>Runtime status</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7f7;border:1px solid #d9e4e5;padding:18px;border-radius:6px">'+safe+'</pre><p>Automated tracking and regression checks passed before this deployment. Real Meta Test Events and GA4 DebugView receipts remain unverified; no real charges were made.</p>'),{headers:reviewHeaders});
   }
   if(path==='/artwork-loading.js'){
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed.',{status:405,headers});
    return new Response(request.method==='HEAD'?null:assets.artworkLoading||'',{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
   }
   if(['/api/meta/consent','/Testing/api/meta/consent'].includes(path)){
    const response=await metaConsent(request,env);
    if(response.status===200&&ctx?.waitUntil)ctx.waitUntil(deliverMetaPurchases(env,{fetcher,limit:3}).catch(()=>{}));
    return response;
   }
   if(['/Conversions/meta','/Conversions/meta/retry','/Testing/Conversions/meta','/Testing/Conversions/meta/retry'].includes(path)){
    if(!await visitsOwner(request,env))return json({error:'Sign in to open this owner report.'},401);
    if(path.endsWith('/retry')){
     if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'Origin or method not allowed.'},403);
     await deliverMetaPurchases(env,{fetcher});
    }else if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    const response=json(await metaTrackingStatus(env));response.headers.set('X-Robots-Tag','noindex, nofollow');return response;
   }
   if(['/api/conversion-event','/Testing/api/conversion-event'].includes(path))return recordConversionEvent(request,env);
   if(['/Conversions','/Conversions/','/Conversions/data','/Testing/Conversions','/Testing/Conversions/data'].includes(path)){
    const dashboardHeaders={...headers,'Referrer-Policy':'same-origin','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Type':'text/html; charset=utf-8'},dataRoute=path.endsWith('/data');
    if(!await visitsOwner(request,env)){if(dataRoute)return new Response(JSON.stringify({error:'Sign in to open this owner dashboard.'}),{status:401,headers:{...dashboardHeaders,'Content-Type':'application/json'}});return new Response(request.method==='HEAD'?null:adminLoginPage(url.pathname+url.search),{status:401,headers:dashboardHeaders});}
    if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
    if(dataRoute)return conversionReport(request,env);
    let dashboard=assets.conversionsDashboard||'';if(await adminSession(request,env))dashboard=dashboard.replace('</header>',adminSignOutControl()+'</header>');return new Response(request.method==='HEAD'?null:dashboard,{headers:dashboardHeaders});
   }
   if(path.startsWith('/admin/'))return adminAuthRoute(request,env);
   if(['/visits','/visits/','/sessions','/sessions/'].includes(path))return new Response(null,{status:308,headers:{...headers,Location:(path.startsWith('/sessions')?'/Sessions':'/Visits')+url.search}});
   const reportRoute=path.match(/^\/(?:Testing\/)?(Visits|Sessions)(\/.*)?$/);
   if(reportRoute){
    const dashboardHeaders={...headers,'Referrer-Policy':'same-origin','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow, noarchive'};
    const isSessions=reportRoute[1]==='Sessions',tail=(reportRoute[2]||'').replace(/\/$/,''),dataRoute=tail==='/data',statsRoute=isSessions&&tail.match(/^\/session\/([^/]+)\/stats$/),timelineRoute=isSessions&&tail.startsWith('/session/'),apiRoute=dataRoute||timelineRoute,hasIdentity=!!request.headers.get('oai-authenticated-user-id')&&!!request.headers.get('oai-authenticated-user-email');
    if(!await visitsOwner(request,env)){
     const status=hasIdentity?403:401;
     if(apiRoute)return new Response(JSON.stringify({error:hasIdentity?'This dashboard is restricted to the owner.':'Sign in with your owner account to open this dashboard.'}),{status,headers:{...dashboardHeaders,'Content-Type':'application/json'}});
     const body=adminLoginPage(url.pathname+url.search);
     return new Response(request.method==='HEAD'?null:body,{status,headers:{...dashboardHeaders,'Content-Type':'text/html; charset=utf-8'}});
    }
    if(statsRoute){const report=await setSessionStatsExclusion(request,env,statsRoute[1]);return new Response(report.body,{status:report.status,headers:{...dashboardHeaders,...Object.fromEntries(report.headers)}});}
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:dashboardHeaders});
    if(request.method==='HEAD')return new Response(null,{headers:dashboardHeaders});
    if(apiRoute){const report=timelineRoute?await siteSessionTimeline(request,env,tail.slice(9)):isSessions?await siteSessionsReport(request,env):await siteVisitsReport(request,env);return new Response(report.body,{status:report.status,headers:{...dashboardHeaders,...Object.fromEntries(report.headers)}});}
    if(tail)return new Response('Not found.',{status:404,headers:dashboardHeaders});
    const dashboard=isSessions?assets.sessionsDashboard:assets.visitsDashboard;
    if(!dashboard)return new Response('Dashboard unavailable.',{status:503,headers:dashboardHeaders});
    return new Response(await adminSession(request,env)?dashboard.replace('</header>','</header><div style="max-width:1200px;margin:auto;padding:0 20px">'+adminSignOutControl()+'</div>'):dashboard,{headers:{...dashboardHeaders,'Content-Type':'text/html; charset=utf-8'}});
   }
   if(['/api/visits-event','/Testing/api/visits-event'].includes(path))return recordSiteVisit(request,env);
   if(path.startsWith('/Testing/SocialMirror/api/')||path.startsWith('/SocialMirror/api/'))return socialMirrorApi(request,env,fetcher);
   if(['/Testing/SocialMirror','/Testing/SocialMirror/','/SocialMirror','/SocialMirror/'].includes(path)){const mirror=path.startsWith('/Testing/')?assets.socialMirror:assets.socialMirrorPublished;if(!mirror)return htmlResponse(page('Not found','Page not found.'),404);const mirrorTesting=path.startsWith('/Testing/'),privateLink=!!url.search;const mirrorOwner=await visitsOwner(request,env);let mirrorContent=applyPageSeo(mirror,(mirrorTesting?assets.seo?.testing:assets.seo?.live)?.pages?.['/SocialMirror'],{testing:mirrorTesting,privateLink});mirrorContent=mirrorContent.replace('</head>','<script>window.OPORTALS_OWNER='+JSON.stringify(mirrorOwner)+';</script></head>');return new Response(request.method==='HEAD'?null:withVisitsTracking(withArtworkRecovery(mirrorTesting||privateLink?mirrorContent:withCommerceTracking(mirrorContent,assets,null,env),assets.artworkLoading),assets.visitsTracking),{headers:{...headers,'Content-Security-Policy':headers['Content-Security-Policy']+"; font-src 'self' data:",'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':mirrorTesting||privateLink?'noindex, nofollow':'index, follow, max-image-preview:large'}});}
   if(live&&/^\/Testing\/checkout\/(?:life-secrets|art-of-attention|lead-without-the-noise|man-and-people)$/.test(path))return new Response(null,{status:303,headers:{...headers,Location:'/checkout?book='+path.split('/').pop()}});
   if(path==='/Testing' || path.startsWith('/Testing/')) {
    const privateHeaders={...headers,'Content-Security-Policy':headers['Content-Security-Policy'].replace("object-src 'none'","object-src 'self'")+"; frame-src 'self'; font-src 'self' data:",'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive',Vary:'Cookie'};
    // A draft expansion stays on Testing until its PDF/media snapshot is explicitly published.
    const expandedSlug=testingOnlyBookSlugs.find(slug=>path==='/Testing/book/'+slug||path==='/Testing/checkout/'+slug||path==='/Testing/books/'+slug+'.pdf'||path==='/Testing/books/'+slug+'-sample.pdf');
    if(live&&((expandedSlug&&!Object.hasOwn(assets.completedBooks||{},expandedSlug+'.pdf'))||(path.startsWith('/Testing/media/testing-collection-')&&!Object.hasOwn(assets.publishedMedia||{},path.slice('/Testing/media/'.length)))))return new Response('Not found.',{status:404,headers:privateHeaders});
    const privatePage=(body,status)=>new Response(body,{status,headers:{...privateHeaders,...(body.includes('action="/admin/login"')?{'Referrer-Policy':'same-origin'}:{}),'Content-Type':'text/html; charset=utf-8'}});
    if(request.method!=='GET' && request.method!=='HEAD' && !(['/Testing/api/events','/Testing/api/contact','/Testing/api/contact/deliver','/Testing/api/contact/delete','/Testing/api/free-book','/Testing/leads'].includes(path)&&request.method==='POST'))return new Response('Method not allowed.',{status:405,headers:privateHeaders});
    const previewKey=['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY'].includes(assets.testing?.keyEnv)?env[assets.testing.keyEnv]:env.PREVIEW_ENCRYPTION_KEY;
    if(!previewKey)return privatePage(page('Private preview','<h1>Private studio preview.</h1><p>This preview is not available yet.</p>'),503);
    const viewer=request.headers.get('oai-authenticated-user-email');
    const viewerId=request.headers.get('oai-authenticated-user-id');
    const isOwner=await visitsOwner(request,env);
    const gatedFreeBook=(!live||assets.publishedDraft)&&!!assets.testingDraft&&path==='/Testing/books/sneakpeak-ideas.pdf';const freeGrant=gatedFreeBook?await freeBookGrant(request,env):null;if(gatedFreeBook&&!freeGrant&&!isOwner)return new Response(null,{status:303,headers:{...privateHeaders,Location:(live?'':'/Testing')+'/book/sneakpeak-ideas?get=1'}});
    const publicFiles=new Set(["the-philosopher-manager-sample.pdf","lead-without-the-noise-sample.pdf","time-for-what-matters-sample.pdf","stand-out-for-something-sample.pdf",'sneakpeak-ideas.pdf','life-secrets-sample.pdf','art-of-attention-sample.pdf','man-and-people-guide-sample.pdf']);
    for(const slug of testingOnlyBookSlugs)if(!live||Object.hasOwn(assets.completedBooks||{},slug+'-sample.pdf'))publicFiles.add(slug+'-sample.pdf');
    if(assets.testing?.temporaryDownloads===true)for(const name of ['life-secrets.pdf','art-of-attention.pdf','man-and-people-guide.pdf','the-philosopher-manager.pdf','lead-without-the-noise.pdf','time-for-what-matters.pdf','stand-out-for-something.pdf'])publicFiles.add(name);
    const ownerOnly=assets.testing?.publicPreview!==true||['/Testing/leads','/Testing/leads.csv','/Testing/metrics','/Testing/downloads','/Testing/downloads.json','/Testing/contact-inbox','/Testing/api/contact/deliver','/Testing/api/contact/delete'].includes(path)||(path.startsWith('/Testing/books/')&&!publicFiles.has(path.slice('/Testing/books/'.length)));
    if(ownerOnly&&!isOwner){
     if(!viewer||!viewerId)return privatePage(adminLoginPage(url.pathname+url.search),401);
     return privatePage(page('Owner access','<h1>Owner access required.</h1><p><a href="/Testing">Back to the bookstore</a></p>'),403);
    }
    if((!live||assets.publishedDraft)&&assets.testingDraft&&path==='/Testing/api/free-book')return registerFreeBook(request,env);
    if((!live||assets.publishedDraft)&&assets.testingDraft&&['/Testing/leads','/Testing/leads.csv'].includes(path)){const response=await freeBookLeadReport(request,env);return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:{...privateHeaders,...Object.fromEntries(response.headers)}});}
    if(path==='/Testing/api/contact'||path==='/Testing/api/contact/deliver'||path==='/Testing/api/contact/delete'){
     if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:privateHeaders});
     const result=path.endsWith('/deliver')?await processContactQueue(request,env,fetcher):path.endsWith('/delete')?await deleteContact(request,env):await submitContact(request,env,fetcher);
     return new Response(result.body,{status:result.status,headers:{...privateHeaders,'Content-Type':'application/json'}});
    }
    if(path==='/Testing/contact-inbox'){
     const result=await contactInbox(env);return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
    }
    if(path==='/Testing/api/events'){
     if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:privateHeaders});
     const result=await recordPreviewEvent(request,env);return new Response(result.body,{status:result.status,headers:{...privateHeaders,'Content-Type':'application/json'}});
    }
    if(path==='/Testing/metrics'){
     const result=await previewMetrics(env);return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
    }
    if(path.startsWith('/Testing/media/')){
     const publishedName=path.slice('/Testing/media/'.length);if(live&&Object.hasOwn(assets.publishedMedia||{},publishedName))return new Response(request.method==='HEAD'?null:fromBase64(assets.publishedMedia[publishedName]),{headers:{...privateHeaders,'X-Robots-Tag':'index, follow, max-image-preview:large','Content-Type':'image/webp'}});
     const name=path.slice('/Testing/media/'.length);if((!live||assets.publishedDraft)&&Object.hasOwn(assets.draftMedia||{},name))return new Response(request.method==='HEAD'?null:fromBase64(assets.draftMedia[name]),{headers:{...privateHeaders,'Content-Type':'image/webp'}});const file=Object.hasOwn(assets.previewMedia||{},name)?assets.previewMedia[name]:null;
     if(!file)return new Response('Image not found',{status:404,headers:privateHeaders});
     const key=['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY'].includes(file.keyEnv)?env[file.keyEnv]:null;
     if(!key)return new Response('Image unavailable',{status:503,headers:privateHeaders});
     const bytes=request.method==='HEAD'?null:await decryptBook(file,key);
     return new Response(bytes,{headers:{...privateHeaders,...(live?{'X-Robots-Tag':'index, follow, max-image-preview:large'}:{}),'Content-Type':'image/webp'}});
    }
    if(path==='/Testing/downloads' || path==='/Testing/downloads.json'){
     if(request.method==='HEAD')return new Response(null,{headers:privateHeaders});
     const report=await downloadReport(env);
     return new Response(path.endsWith('.json')?JSON.stringify({scope:'private-testing',books:report}):reportPage(report),{headers:{...privateHeaders,'Content-Type':path.endsWith('.json')?'application/json':'text/html; charset=utf-8'}});
    }
    if(path.startsWith('/Testing/books/')) {
     const name=path.slice('/Testing/books/'.length);
     const isExisting=name==='life-secrets.pdf'&&!Object.hasOwn(assets.completedBooks||{},name);
     const editionFile=!live&&Object.hasOwn(assets.testingEditionBooks||{},name)?assets.testingEditionBooks[name]:null;
     const file=editionFile||(isExisting?assets.book:Object.hasOwn(assets.completedBooks||{},name)?assets.completedBooks[name]:null);
     if(!file)return new Response('Book not found.',{status:404,headers:privateHeaders});
     const bookKey=isExisting&&!editionFile?env.BOOK_ENCRYPTION_KEY:['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY','PREMIUM_EDITION_KEY','PREMIUM_POSTCARD_KEY','PREMIUM_GRAPH_KEY','PREMIUM_EIGHTY_KEY','PREMIUM_POSTER_KEY','PREMIUM_COLLECTION_KEY','TESTING_CATALOGUE_KEY','BOOK_SAMPLE_KEY','BLUE_GREY_EDITION_KEY','WHITE_PAPER_EDITION_KEY','CHARACTER_PREVIEW_KEY','CHARACTER_COLLECTION_KEY','ARTWORK_COLLECTION_KEY'].includes(file.keyEnv)?env[file.keyEnv]:env.PREVIEW_CONTENT_KEY;
     if(!bookKey)return privatePage(page('Book unavailable','<h1>This preview book is not available yet.</h1>'),503);
     const pdfHeaders={...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="${name}"`,'X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':privateHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")};
     if(request.method==='HEAD')return new Response(null,{headers:pdfHeaders});
     const bytes=await decryptBook(file,bookKey);
     const purpose=(request.headers.get('purpose')||'')+' '+(request.headers.get('sec-purpose')||'');
     if(url.searchParams.get('download')==='1' && !purpose.toLowerCase().includes('prefetch')){await captureDownload(env,name);if(gatedFreeBook)await noteFreeBookDownload(env,freeGrant);}
     return new Response(bytes,{headers:pdfHeaders});
    }
    const route=path.match(/^\/Testing\/(book|checkout)\/([a-z0-9-]+)$/);
    const isInfo=/^\/Testing\/info\/(about|privacy|terms|refunds|contact)$/.test(path);
    if(!['/Testing','/Testing/'].includes(path)&&!(/^\/Testing\/ideas(?:\/(?:attention|choices|leadership|meaning))?$/.test(path)&&(!live||assets.publishedDraft)&&assets.testingDraft)&&!isInfo&&!(route&&previewBookSlugs.includes(route[2])&&(route[1]!=='checkout'||['life-secrets','art-of-attention','man-and-people','lead-without-the-noise'].includes(route[2]))))return privatePage(page('Not found','<h1>Page not found.</h1><p><a href="/Testing">Return to the bookshelf</a></p>'),404);
    const bytes=(!live||assets.publishedDraft)&&assets.testingDraft?new TextEncoder().encode(live?(assets.liveDraft||assets.testingDraft):assets.testingDraft):await decryptBook(assets.testing,previewKey);
    let content=new TextDecoder().decode(bytes).replace('<script>','<script>window.OPORTALS_OWNER='+JSON.stringify(isOwner)+';window.OPORTALS_LIVE='+JSON.stringify(live)+';window.OPORTALS_FREE_DOWNLOADS='+JSON.stringify(assets.testing?.temporaryDownloads===true)+';');if(isOwner)content=content.replaceAll('data-owner-only hidden','data-owner-only');if(live){content=content.replaceAll('href="/Testing/checkout/life-secrets"','href="/checkout"').replaceAll('/Testing#','/#').replaceAll('\\/Testing','').replaceAll('/Testing','').replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">');content=content.replace('</head>','<script src="/analytics.js" defer></script><link rel="canonical" href="'+url.origin+url.pathname+'"></head>');}const documentHeaders={...privateHeaders,'Content-Type':'text/html; charset=utf-8'};if(live)delete documentHeaders['X-Robots-Tag'];if(isOwner){const passwordAdmin=await adminSession(request,env);if(passwordAdmin)documentHeaders['Referrer-Policy']='same-origin';content=content.replace('</footer>','<a href="/Visits">Visits &amp; clicks</a>'+(passwordAdmin?adminSignOutControl():'')+'</footer>');}const seoData=live?assets.seo?.live:assets.seo?.testing,seoKey=url.pathname.replace(/^\/Testing(?=\/|$)/,'').replace(/\/$/,'')||'/',seoMeta=seoData?.pages?.[seoKey];content=applyPageSeo(content,seoMeta,{testing:!live,client:seoData?.client});if(live&&seoData&&!seoMeta){documentHeaders['X-Robots-Tag']='noindex, nofollow';content=content.replace('content="index,follow"','content="noindex,nofollow"');}return new Response(request.method==='HEAD'?null:withVisitsTracking(withArtworkRecovery(withCommerceTracking(content,assets,null,env,live?'':'/Testing'),assets.artworkLoading),assets.visitsTracking),{headers:documentHeaders});
   }
   if(path==='/meta-pixel.js' && request.method==='GET')return new Response(assets.metaPixel||'',{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
   if(path==='/analytics.js' && request.method==='GET')return new Response(assets.analytics,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
   if(path==='/privacy' && ['GET','HEAD'].includes(request.method))return new Response(null,{status:308,headers:{...headers,Location:'/info/privacy'}});
   if(path==='/api/status' && request.method==='GET')return json({checkoutReady:ready(env),emailEnabled:emailReady(env)});
   if(path==='/api/paypal/ipn') {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'Unsupported content type.'},415);
    const raw=await limitedBody(request);const p=await verifyIPN(raw,env,fetcher);
    // Non-sale events are not authorizations. Refunds, reversals and pending payments never generate links.
    if(p.get('payment_status')!=='Completed'){await recordVerifiedRefund(p,env);return new Response('OK',{headers});}
    assertPayment(p,env);if(isNewSharedBookPayment(p,env)){const allocation=await bookPaymentAllocation(p,env);await recordVerifiedPurchase(p,allocation?.book_id||null,env);await recordMetaPurchase(p,allocation?.book_id||null,env,null,{fetcher,ctx});await emailReceipt(p,env,fetcher,allocation?.book_id||null);}else {await recordVerifiedPurchase(p,paymentBook(p,env),env);await recordMetaPurchase(p,paymentBook(p,env),env,null,{fetcher,ctx});await emailReceipt(p,env,fetcher);}
    return new Response('OK',{headers});
   }
   if(path==='/api/paypal/verify') {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(![SITE_URL,'https://life-secrets-guide.issawbanna.chatgpt.site'].includes(url.origin) || request.headers.get('origin')!==url.origin)return json({error:'Request origin not allowed.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Unsupported content type.'},415);
    let data;try{data=JSON.parse(await limitedBody(request,1024));}catch(e){if(e instanceof PaymentError)throw e;throw new PaymentError('Invalid request.');}
    if((data?.checkout!=null&&typeof data.checkout!=='string')||(data?.book!=null&&typeof data.book!=='string'))throw new PaymentError('Invalid book checkout selection.');
    const payment=await verifyPDT(data?.transaction,env,fetcher);
    if(paymentBook(payment,env)==='social-mirror-analysis')return json({service:true});
    let book;try{book=await resolveBookPayment(payment,env,request,data?.checkout||null,data?.book||null);}catch(error){if(error.selectionRequired)return json({selectionRequired:true,suggestedBook:error.suggestedBook||null,choices:Object.entries(BOOK_PRODUCTS).filter(([id,b])=>usesSharedBookCheckout(id)&&b.price==='7.99').map(([id,b])=>({id,title:b.title}))});throw error;}
    const token=await issueToken(payment.get('txn_id'),env,undefined,book);const purchase=await recordVerifiedPurchase(payment,book,env,request);await recordMetaPurchase(payment,book,env,request,{fetcher,ctx});
    if((data?.checkout||data?.book)&&emailReady(env)){try{await emailReceipt(payment,env,fetcher,book);}catch{}}
    return json({book,title:BOOK_PRODUCTS[book].title,...(purchase?{purchase}:{}),download:`/download?t=${encodeURIComponent(token)}`,expiresIn:86400});
   }
   if(path==='/download') {
    if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    const token=url.searchParams.get('t');const payload=await readToken(token,env);
    const verified=await verifyPDT(payload.tx,env,fetcher),book=await resolveBookPayment(verified,env);
    if(book!==(payload.book||'life-secrets'))throw new PaymentError('Payment product does not match this download.',403);
    const product=BOOK_PRODUCTS[book];const current=assets.testing?.liveStorefront===true?assets.completedBooks?.[product.file]:null;
    if(!current&&book!=='life-secrets')throw new PaymentError('Book download is temporarily unavailable.',503);
    const pdf=await decryptBook(current||assets.book,current?env[current.keyEnv]:env.BOOK_ENCRYPTION_KEY);
    return new Response(pdf,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+product.file+'"','X-Robots-Tag':'noindex, nofollow'}});
   }
   if(path==='/checkout') {
    if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
    if(!ready(env))return htmlResponse(page('Checkout being connected','<h1>A little more to come.</h1><p>Checkout is being connected. Please come back soon. No payment has been taken here.</p>'),503);
    let book=url.searchParams.get('book')||'life-secrets';
    if(request.method==='POST'){
     if(request.headers.get('origin')!==url.origin)return json({error:'Request origin not allowed.'},403);
     if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'Use the checkout form.'},415);
     book=new URLSearchParams(await limitedBody(request,2048)).get('book');
    }
    const product=Object.hasOwn(BOOK_PRODUCTS,book)?BOOK_PRODUCTS[book]:null;if(!product||product.service)return json({error:'This book is not available to purchase.'},404);
    if(product.shared&&env.SHARED_BOOK_SALES_ENABLED==='false')return json({error:'This book is not available for new purchases right now.'},503);
    if(product.shared&&!assets.completedBooks?.[product.file])return json({error:'This book is not available to purchase.'},404);
    if(assets.testing?.liveStorefront===true){
     const edition=assets.completedBooks?.[product.file]||(book==='life-secrets'?assets.book:null),key=edition?.keyEnv?env[edition.keyEnv]:env.BOOK_ENCRYPTION_KEY;
     if(!edition||!key)return htmlResponse(page('Book temporarily unavailable','<h1>This book is temporarily unavailable.</h1><p>Please try again later or contact us before paying. No payment has been taken here.</p><a href="/info/contact">Contact OPortals</a>'),503);
    }
    if(usesSharedBookCheckout(book)&&sharedBookCheckoutEnabled(env)){
     if(url.origin!==SITE_URL){if(request.method==='POST')return json({error:'Please open checkout on OPortals.com.'},403);return new Response(null,{status:303,headers:{...headers,Location:SITE_URL+'/checkout?book='+encodeURIComponent(book)}});}
     const checkoutHeaders={...headers,'Referrer-Policy':'same-origin','Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow',Vary:'Cookie'};
     if(request.method==='GET')return new Response(withCommerceTracking(sharedBookCheckoutPage(book),assets,await visitsOwner(request,env),env),{headers:checkoutHeaders});
     const order=await createBookOrder(request,env,book);await recordCheckoutAttribution(order,request,env);await recordMetaCheckout(request,env,book,order.id);return new Response(sharedBookRedirectPage(order),{headers:{...checkoutHeaders,'Set-Cookie':order.cookie}});
    }
    if(product.shared)return json({error:'Book checkout is temporarily unavailable.'},503);
    if(request.method==='POST')return json({error:'Start from the book page.'},405);
    await recordMetaCheckout(request,env,book);return new Response(null,{status:303,headers:{...headers,Location:product.link}});
   }
   if(request.method!=='GET' && request.method!=='HEAD')return json({error:'Method not allowed.'},405);
   if(path==='/paypal/return'){const body=(assets.socialMirrorPublished?receiptPage.replaceAll('/Testing/SocialMirror','/SocialMirror'):receiptPage).replace('O PORTALS / LIFE SECRETS','OPortals.com').replace('Back to Life Secrets','Back to the bookstore').replace('content="no-referrer"','content="same-origin"');return new Response(withCommerceTracking(body,assets,await visitsOwner(request,env),env),{headers:{...headers,'Referrer-Policy':'same-origin','Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow'}});}
   if(path==='/Life-Secrets-Sample.pdf')return new Response(request.method==='HEAD'?null:fromBase64(assets.sample),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Life-Secrets-Sample.pdf"'}});
   if(path==='/favicon.svg' || path==='/oportals-mark.svg')return new Response(assets.logo,{headers:{...headers,'Content-Type':'image/svg+xml'}});
   if(path==='/robots.txt')return new Response(request.method==='HEAD'?null:SEO_ROBOTS,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}})
   if(path==='/')return htmlResponse(assets.home);
   return htmlResponse(page('Page not found','<h1>Page not found.</h1><p>Follow the link below to return to the book.</p>'),404);
  } catch(e) {
   const status=e instanceof PaymentError?e.status:503;
   const error=e instanceof PaymentError?e.message:'This service is temporarily unavailable. Please try again shortly.';
   if(path==='/download')return htmlResponse(page('Download unavailable',`<h1>Download unavailable.</h1><p>${error}</p><p><a href="/paypal/return">Verify your purchase again</a></p>`),status);
   return json({error},status);
  }
 };
}
