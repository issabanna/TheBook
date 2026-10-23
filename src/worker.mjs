import {registerFreeBook,freeBookGrant,noteFreeBookDownload,freeBookLeadReport} from './free-book-leads.mjs';
import {submitContact,contactInbox,processContactQueue,deleteContact} from './contact.mjs';
import {previewBookSlugs,recordPreviewEvent,previewMetrics} from './testing-events.mjs';
import { SITE_URL, PAYPAL_LINK, PaymentError, ready, emailReady, verifyPDT, verifyIPN, assertPayment, issueToken, readToken, decryptBook, fromBase64, emailReceipt } from './payment.mjs';
// Build injects the public assets and encrypted paid book. No plaintext paid PDF is published.
const headers = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function htmlResponse(body, status = 200) { return new Response(body, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } }); }
const pageStyle = `body{background:#f1eee5;color:#262b21;font:16px/1.7 Arial,sans-serif;max-width:650px;margin:10vh auto;padding:25px}h1{font:52px/1.1 Georgia,serif}a,button{display:inline-block;background:#262b21;color:#f1eee5;padding:14px 22px;border:0;border-radius:4px;text-decoration:none;cursor:pointer;font:inherit}small{color:#68734b}input{box-sizing:border-box;padding:14px;width:100%;margin:12px 0;border:1px solid #aeb49b;background:#fffdf7;font:inherit}button{margin:10px 0}#download[hidden],form[hidden]{display:none}#message{white-space:pre-wrap}a.secondary{background:transparent;color:#262b21;padding:10px 0}`;
function page(title, content) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title} — O Portals</title><style>${pageStyle}</style></head><body><small>O PORTALS / LIFE SECRETS</small>${content}<p><a class="secondary" href="/">Back to Life Secrets</a></p></body></html>`; }
const receiptPage = page('Your book', `<h1>Your next perspective.</h1><p id="message" role="status" aria-live="polite">Verifying your PayPal payment…</p><a id="download" hidden>Download your book ↓</a><form id="receipt" hidden><label for="transaction">PayPal transaction ID from your receipt</label><input id="transaction" name="transaction" maxlength="32" autocomplete="off" required pattern="[A-Za-z0-9]{8,32}"><button>Verify my purchase</button></form><p><small>Download links last 24 hours. Save the PDF to your device. Keep your PayPal receipt so you can verify your purchase again later.</small></p><script>
const message=document.querySelector('#message'),form=document.querySelector('#receipt'),download=document.querySelector('#download'),input=document.querySelector('#transaction');
const params=new URLSearchParams(location.search),tx=params.get('tx');history.replaceState(null,'',location.pathname);
async function verify(transaction){download.hidden=true;form.hidden=true;message.textContent='Verifying your PayPal payment…';try{const r=await fetch('/api/paypal/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');download.href=data.download;download.hidden=false;message.textContent='Payment verified. Your Life Secrets PDF is ready.';}catch(e){message.textContent=e.message;form.hidden=false;}}
form.addEventListener('submit',e=>{e.preventDefault();verify(input.value.trim().toUpperCase());});
if(tx){input.value=tx;verify(tx);}else{message.textContent='Enter the transaction ID on your PayPal receipt to verify your purchase and unlock the book.';form.hidden=false;}
</script>`);
async function limitedBody(request, limit = 16384) {
  if (Number(request.headers.get('content-length')) > limit) throw new PaymentError('Request too large.', 413);
  if (!request.body) return '';
  const reader = request.body.getReader();let total=0;const chunks=[];
  while (true) { const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new PaymentError('Request too large.',413);}chunks.push(value); }
  const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return new TextDecoder().decode(bytes);
}
const downloadCatalogue=[{"id": "the-philosopher-manager", "title": "The Philosopher Manager"},{"id": "lead-without-the-noise", "title": "Lead Without the Noise"},{"id": "time-for-what-matters", "title": "Time for What Matters"},{"id": "stand-out-for-something", "title": "Stand Out for Something"},{id:'sneakpeak-ideas',title:'SneakPeak Ideas — free collection'},{id:'life-secrets',title:'Life Secrets'},{id:'art-of-attention',title:'The Art of Attention'},{id:'man-and-people-guide',title:'Man and People — illustrated companion'}];
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
 return async function handler(request, env) {
  const url=new URL(request.url);let path=url.pathname;const live=assets.testing?.liveStorefront===true&&(path==='/'||/^\/(?:book|books|media|info|checkout)\//.test(path)||['/api/events','/api/contact','/api/contact/deliver','/api/contact/delete','/metrics','/downloads','/downloads.json','/contact-inbox'].includes(path));if(live)path='/Testing'+(path==='/'?'':path);
  try {
   if(live&&path==='/Testing/checkout/life-secrets')return new Response(null,{status:303,headers:{...headers,Location:'/checkout'}});
   if(path==='/Testing' || path.startsWith('/Testing/')) {
    const privateHeaders={...headers,'Content-Security-Policy':headers['Content-Security-Policy'].replace("object-src 'none'","object-src 'self'")+"; frame-src 'self'; font-src 'self' data:",'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive',Vary:'Cookie'};
    const privatePage=(body,status)=>new Response(body,{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
    if(request.method!=='GET' && request.method!=='HEAD' && !(['/Testing/api/events','/Testing/api/contact','/Testing/api/contact/deliver','/Testing/api/contact/delete','/Testing/api/free-book','/Testing/leads'].includes(path)&&request.method==='POST'))return new Response('Method not allowed.',{status:405,headers:privateHeaders});
    const previewKey=['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY'].includes(assets.testing?.keyEnv)?env[assets.testing.keyEnv]:env.PREVIEW_ENCRYPTION_KEY;
    if(!previewKey)return privatePage(page('Private preview','<h1>Private studio preview.</h1><p>This preview is not available yet.</p>'),503);
    const viewer=request.headers.get('oai-authenticated-user-email');
    const viewerId=request.headers.get('oai-authenticated-user-id');
    const isOwner=!!viewerId&&!!viewer&&!!env.PREVIEW_OWNER_EMAIL&&viewer.trim().toLowerCase()===env.PREVIEW_OWNER_EMAIL.trim().toLowerCase();
    const gatedFreeBook=!live&&!!assets.testingDraft&&path==='/Testing/books/sneakpeak-ideas.pdf';const freeGrant=gatedFreeBook?await freeBookGrant(request,env):null;if(gatedFreeBook&&!freeGrant&&!isOwner)return new Response(null,{status:303,headers:{...privateHeaders,Location:'/Testing/book/sneakpeak-ideas?get=1'}});
    const publicFiles=new Set(["the-philosopher-manager-sample.pdf","lead-without-the-noise-sample.pdf","time-for-what-matters-sample.pdf","stand-out-for-something-sample.pdf",'sneakpeak-ideas.pdf','life-secrets-sample.pdf','art-of-attention-sample.pdf','man-and-people-guide-sample.pdf']);
    if(assets.testing?.temporaryDownloads===true)for(const name of ['life-secrets.pdf','art-of-attention.pdf','man-and-people-guide.pdf','the-philosopher-manager.pdf','lead-without-the-noise.pdf','time-for-what-matters.pdf','stand-out-for-something.pdf'])publicFiles.add(name);
    const ownerOnly=assets.testing?.publicPreview!==true||['/Testing/leads','/Testing/leads.csv','/Testing/metrics','/Testing/downloads','/Testing/downloads.json','/Testing/contact-inbox','/Testing/api/contact/deliver','/Testing/api/contact/delete'].includes(path)||(path.startsWith('/Testing/books/')&&!publicFiles.has(path.slice('/Testing/books/'.length)));
    if(ownerOnly&&!isOwner){
     if(!viewer||!viewerId)return privatePage(page('Owner access','<h1>Owner access required.</h1><p>The storefront and free samples are open to everyone. Reports and full paid-book review files require the owner account.</p><p><a href="/signin-with-chatgpt" target="_top">Sign in with ChatGPT</a></p><p><a href="/Testing">Back to the bookstore</a></p>'),401);
     return privatePage(page('Owner access','<h1>Owner access required.</h1><p><a href="/Testing">Back to the bookstore</a></p>'),403);
    }
    if(!live&&assets.testingDraft&&path==='/Testing/api/free-book')return registerFreeBook(request,env);
    if(!live&&assets.testingDraft&&['/Testing/leads','/Testing/leads.csv'].includes(path)){const response=await freeBookLeadReport(request,env);return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:{...privateHeaders,...Object.fromEntries(response.headers)}});}
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
     const name=path.slice('/Testing/media/'.length);if(!live&&Object.hasOwn(assets.draftMedia||{},name))return new Response(request.method==='HEAD'?null:fromBase64(assets.draftMedia[name]),{headers:{...privateHeaders,'Content-Type':'image/webp'}});const file=Object.hasOwn(assets.previewMedia||{},name)?assets.previewMedia[name]:null;
     if(!file)return new Response('Image not found',{status:404,headers:privateHeaders});
     const key=['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY'].includes(file.keyEnv)?env[file.keyEnv]:null;
     if(!key)return new Response('Image unavailable',{status:503,headers:privateHeaders});
     const bytes=request.method==='HEAD'?null:await decryptBook(file,key);
     return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'image/webp'}});
    }
    if(path==='/Testing/downloads' || path==='/Testing/downloads.json'){
     if(request.method==='HEAD')return new Response(null,{headers:privateHeaders});
     const report=await downloadReport(env);
     return new Response(path.endsWith('.json')?JSON.stringify({scope:'private-testing',books:report}):reportPage(report),{headers:{...privateHeaders,'Content-Type':path.endsWith('.json')?'application/json':'text/html; charset=utf-8'}});
    }
    if(path.startsWith('/Testing/books/')) {
     const name=path.slice('/Testing/books/'.length);
     const isExisting=name==='life-secrets.pdf'&&!Object.hasOwn(assets.completedBooks||{},name);
     const file=isExisting?assets.book:Object.hasOwn(assets.completedBooks||{},name)?assets.completedBooks[name]:null;
     if(!file)return new Response('Book not found.',{status:404,headers:privateHeaders});
     const bookKey=isExisting?env.BOOK_ENCRYPTION_KEY:['PREVIEW_CONTENT_KEY','PREVIEW_V3_KEY','PREVIEW_V4_KEY','PREVIEW_V5_KEY'].includes(file.keyEnv)?env[file.keyEnv]:env.PREVIEW_CONTENT_KEY;
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
    if(!['/Testing','/Testing/'].includes(path)&&!(path==='/Testing/ideas'&&!live&&assets.testingDraft)&&!isInfo&&!(route&&previewBookSlugs.includes(route[2])&&(route[1]!=='checkout'||['life-secrets','art-of-attention','man-and-people','lead-without-the-noise'].includes(route[2]))))return privatePage(page('Not found','<h1>Page not found.</h1><p><a href="/Testing">Return to the bookshelf</a></p>'),404);
    if(request.method==='HEAD')return new Response(null,{headers:privateHeaders});
    const bytes=!live&&assets.testingDraft?new TextEncoder().encode(assets.testingDraft):await decryptBook(assets.testing,previewKey);
    let content=new TextDecoder().decode(bytes).replace('<script>','<script>window.OPORTALS_OWNER='+JSON.stringify(isOwner)+';window.OPORTALS_LIVE='+JSON.stringify(live)+';window.OPORTALS_FREE_DOWNLOADS='+JSON.stringify(assets.testing?.temporaryDownloads===true)+';');if(isOwner)content=content.replaceAll('data-owner-only hidden','data-owner-only');if(live){content=content.replaceAll('href="/Testing/checkout/life-secrets"','href="/checkout"').replaceAll('\\/Testing','').replaceAll('/Testing','').replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">');content=content.replace('</head>','<script src="/analytics.js" defer></script><link rel="canonical" href="'+url.origin+url.pathname+'"></head>');}const documentHeaders={...privateHeaders,'Content-Type':'text/html; charset=utf-8'};if(live)delete documentHeaders['X-Robots-Tag'];return new Response(content,{headers:documentHeaders});
   }
   if(path==='/analytics.js' && request.method==='GET')return new Response(assets.analytics,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
   if(path==='/privacy' && request.method==='GET')return htmlResponse(page('Privacy', '<h1>Privacy &amp; analytics.</h1><p>OPortals.com uses essential payment and download functions to provide the book. PayPal processes payments. Our contact form opens your email app; it does not send your question to Google Analytics.</p><h2>Optional analytics</h2><p>Google Analytics 4 measures visits and clicks and uses analytics cookies by default, unless you reject tracking in Privacy settings. It can collect identifiers, device/browser information and approximate location. Google processes this data on our behalf; processing may occur outside your country. We do not send your contact message, email address, PayPal transaction ID or download token in the analytics events we implement. Analytics is not loaded on payment-return or download pages.</p><p>We keep your analytics choice on this device for up to 180 days. Google Analytics cookies can last up to two years; their lifetimes can be renewed by visits. Advertising storage, Google signals and advertising personalization are disabled in our tag configuration. Your Analytics property settings may also affect data retention.</p><h2>Your choice</h2><p>Analytics is enabled by default. You can reject tracking entirely or keep analytics enabled. To change your choice or withdraw consent, use Privacy settings in the homepage footer. Rejecting clears analytics cookies this site can access and reloads the page if needed. This does not delete analytics data already received by Google.</p><p><a class="secondary" href="https://policies.google.com/privacy" rel="noopener noreferrer">Google privacy information</a></p><p>For privacy questions or requests, use our <a class="secondary" href="/#contact">contact form</a>.</p>'));
   if(path==='/api/status' && request.method==='GET')return json({checkoutReady:ready(env),emailEnabled:emailReady(env)});
   if(path==='/api/paypal/ipn') {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'Unsupported content type.'},415);
    const raw=await limitedBody(request);const p=await verifyIPN(raw,env,fetcher);
    // Non-sale events are not authorizations. Refunds, reversals and pending payments never generate links.
    if(p.get('payment_status')!=='Completed')return new Response('OK',{headers});
    assertPayment(p,env);await emailReceipt(p,env,fetcher);
    return new Response('OK',{headers});
   }
   if(path==='/api/paypal/verify') {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(![SITE_URL,'https://life-secrets-guide.issawbanna.chatgpt.site'].includes(url.origin) || request.headers.get('origin')!==url.origin)return json({error:'Request origin not allowed.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Unsupported content type.'},415);
    let data;try{data=JSON.parse(await limitedBody(request,1024));}catch(e){if(e instanceof PaymentError)throw e;throw new PaymentError('Invalid request.');}
    const payment=await verifyPDT(data?.transaction,env,fetcher);
    const token=await issueToken(payment.get('txn_id'),env);
    return json({download:`/download?t=${encodeURIComponent(token)}`,expiresIn:86400});
   }
   if(path==='/download') {
    if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    const token=url.searchParams.get('t');const payload=await readToken(token,env);
    await verifyPDT(payload.tx,env,fetcher);
    const current=assets.testing?.liveStorefront===true?assets.completedBooks?.['life-secrets.pdf']:null;const pdf=await decryptBook(current||assets.book,current?env[current.keyEnv]:env.BOOK_ENCRYPTION_KEY);
    return new Response(pdf,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Life-Secrets.pdf"','X-Robots-Tag':'noindex, nofollow'}});
   }
   if(path==='/checkout') {
    if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    if(!ready(env))return htmlResponse(page('Checkout being connected','<h1>A little more to come.</h1><p>Checkout is being connected. Please come back soon. No payment has been taken here.</p>'),503);
    return new Response(null,{status:303,headers:{...headers,Location:PAYPAL_LINK}});
   }
   if(request.method!=='GET' && request.method!=='HEAD')return json({error:'Method not allowed.'},405);
   if(path==='/paypal/return')return htmlResponse(receiptPage);
   if(path==='/Life-Secrets-Sample.pdf')return new Response(request.method==='HEAD'?null:fromBase64(assets.sample),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Life-Secrets-Sample.pdf"'}});
   if(path==='/favicon.svg' || path==='/oportals-mark.svg')return new Response(assets.logo,{headers:{...headers,'Content-Type':'image/svg+xml'}});
   if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /Testing\nDisallow: /testing\nDisallow: /download\nDisallow: /paypal/\nDisallow: /api/\n',{headers:{...headers,'Content-Type':'text/plain'}});
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
