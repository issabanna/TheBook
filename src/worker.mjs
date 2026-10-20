import { SITE_URL, PAYPAL_LINK, PaymentError, ready, emailReady, verifyPDT, verifyIPN, assertPayment, issueToken, readToken, decryptBook, fromBase64, emailReceipt } from './payment.mjs';
// Build injects the public assets and encrypted paid book. No plaintext paid PDF is published.
const headers = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function htmlResponse(body, status = 200) { return new Response(body, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } }); }
const pageStyle = `body{background:#f1eee5;color:#262b21;font:18px/1.7 Arial,sans-serif;max-width:650px;margin:10vh auto;padding:25px}h1{font:800 64px/1 Arial,sans-serif;letter-spacing:-3px}a,button{display:inline-block;background:#262b21;color:#f1eee5;padding:14px 22px;border:0;border-radius:0;text-decoration:none;cursor:pointer;font:inherit}small{color:#68734b}input{box-sizing:border-box;padding:14px;width:100%;margin:12px 0;border:1px solid #aeb49b;background:#fffdf7;font:inherit}button{margin:10px 0}#download[hidden],form[hidden]{display:none}#message{white-space:pre-wrap}a.secondary{background:transparent;color:#262b21;padding:10px 0}`;
function page(title, content) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title} — O Portals</title><style>${pageStyle}</style></head><body><small>O PORTALS / LIFE SECRETS</small>${content}<p><a class="secondary" href="/">Back to Life Secrets</a></p></body></html>`; }
const receiptPage = page('Your book', `<h1>Your next perspective.</h1><p id="message" role="status" aria-live="polite">Verifying your PayPal payment…</p><a id="download" hidden>Download your book ↓</a><form id="receipt" hidden><label for="transaction">PayPal transaction ID from your receipt</label><input id="transaction" name="transaction" maxlength="32" autocomplete="off" required pattern="[A-Za-z0-9]{8,32}"><button>Verify my purchase</button></form><p><small>Download links last 24 hours. Save the PDF to your device. Keep your PayPal receipt so you can verify your purchase again later.</small></p><script>
const message=document.querySelector('#message'),form=document.querySelector('#receipt'),download=document.querySelector('#download'),input=document.querySelector('#transaction');
const params=new URLSearchParams(location.search),tx=params.get('tx');history.replaceState(null,'',location.pathname);
async function verify(transaction){download.hidden=true;form.hidden=true;message.textContent='Verifying your PayPal payment…';try{const r=await fetch('/api/paypal/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');download.href=data.download;download.hidden=false;message.textContent='Payment verified. Your 30-page Life Secrets PDF is ready.';}catch(e){message.textContent=e.message;form.hidden=false;}}
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
export function createHandler(assets, fetcher = fetch) {
 return async function handler(request, env) {
  const url=new URL(request.url),path=url.pathname;
  try {
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
    const pdf=await decryptBook(assets.book,env.BOOK_ENCRYPTION_KEY);
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
   if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /download\nDisallow: /paypal/\nDisallow: /api/\n',{headers:{...headers,'Content-Type':'text/plain'}});
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
