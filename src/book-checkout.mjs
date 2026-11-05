import {BOOK_PRODUCTS,PAYPAL_LINK,PaymentError,paymentBook,fromBase64} from './payment.mjs';
const bookSessionCookie='__Host-oportals-book-session',bookOrderWindow=86400;
const bookEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bookB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function bookOrderKey(env){return crypto.subtle.importKey('raw',fromBase64(env.DOWNLOAD_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function signBookValue(value,env){return bookB64(await crypto.subtle.sign('HMAC',await bookOrderKey(env),new TextEncoder().encode('oportals-book-checkout-v1:'+value)));}
async function checkBookValue(value,sig,env){try{return await crypto.subtle.verify('HMAC',await bookOrderKey(env),fromBase64(sig),new TextEncoder().encode('oportals-book-checkout-v1:'+value));}catch{return false;}}
export const usesSharedBookCheckout=book=>book==='life-secrets'||BOOK_PRODUCTS[book]?.shared===true;
export function sharedBookCheckoutEnabled(env){return !!env.DB&&Number.isFinite(Date.parse(env.SHARED_BOOK_CHECKOUT_FROM||''));}
export function isNewSharedBookPayment(payment,env){return paymentBook(payment,env)==='life-secrets'&&payment.get('mc_gross')==='7.99'&&Number.isFinite(Date.parse(env.SHARED_BOOK_CHECKOUT_FROM||''))&&Date.parse(payment.get('payment_date')||'')>=Date.parse(env.SHARED_BOOK_CHECKOUT_FROM);}
async function bookBrowserSession(request,env){
 const value=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(bookSessionCookie+'='))?.slice(bookSessionCookie.length+1)||'';
 if(value.length>200)return null;const [id,sig,extra]=value.split('.');if(extra||!sig||! /^[a-f0-9-]{36}$/.test(id)||!await checkBookValue('session:'+id,sig,env))return null;return id;
}
export async function createBookOrder(request,env,book){
 if(!sharedBookCheckoutEnabled(env))throw new PaymentError('Book checkout is temporarily unavailable.',503);
 if(!usesSharedBookCheckout(book)||BOOK_PRODUCTS[book]?.price!=='7.99')throw new PaymentError('This book does not use the shared checkout.',400);
 const session=await bookBrowserSession(request,env)||crypto.randomUUID(),ip=request.headers.get('cf-connecting-ip');
 const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/900)*900,limitKey='book-checkout:'+await signBookValue('rate:'+(ip?'ip:'+ip:'session:'+session),env);
 await env.DB.prepare('DELETE FROM contact_limits WHERE limit_key LIKE ? AND window_start < ?').bind('book-checkout:%',now-1800).run();
 const limit=await env.DB.prepare('INSERT INTO contact_limits (limit_key,window_start,request_count) VALUES (?,?,1) ON CONFLICT(limit_key,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count').bind(limitKey,windowStart).all();if(limit.results[0].request_count>30)throw new PaymentError('Too many checkout attempts. Please try again in 15 minutes.',429);
 const id=crypto.randomUUID(),exp=now+bookOrderWindow;
 await env.DB.prepare('INSERT INTO book_checkout_orders(id,book_id,session_id,created_at,expires_at) VALUES(?,?,?,?,?)').bind(id,book,session,now,exp).run();
 const payload=bookB64(new TextEncoder().encode(JSON.stringify({v:1,id,book,iat:now,exp}))),token=payload+'.'+await signBookValue('order:'+payload,env);
 return {token,book,id,cookie:bookSessionCookie+'='+session+'.'+await signBookValue('session:'+session,env)+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000'};
}
async function readBookOrder(token,env){
 if(typeof token!=='string'||token.length>1000)throw new PaymentError('Your selected-book checkout could not be verified. Please start again from the book page.',403);
 try{
  const [payload,sig,extra]=token.split('.');if(extra||!sig||!await checkBookValue('order:'+payload,sig,env))throw Error();
  const d=JSON.parse(new TextDecoder().decode(fromBase64(payload)));if(d.v!==1||! /^[a-f0-9-]{36}$/.test(d.id)||!usesSharedBookCheckout(d.book)||!Number.isSafeInteger(d.iat)||d.exp!==d.iat+bookOrderWindow)throw Error();
  const order=(await env.DB.prepare('SELECT * FROM book_checkout_orders WHERE id=?').bind(d.id).all()).results[0];if(!order||order.book_id!==d.book||order.created_at!==d.iat||order.expires_at!==d.exp)throw Error();return order;
 }catch(e){if(e instanceof PaymentError)throw e;throw new PaymentError('Your selected-book checkout could not be verified. Please start again from the book page.',403);}
}
export async function bookPaymentAllocation(payment,env){
 if(!env.DB)return null;return (await env.DB.prepare('SELECT * FROM book_payment_allocations WHERE transaction_id=?').bind(payment.get('txn_id')).all()).results[0]||null;
}
export async function resolveBookPayment(payment,env,request=null,orderToken=null,choice=null){
 const source=paymentBook(payment,env);if(source!=='life-secrets')return source;
 const existing=await bookPaymentAllocation(payment,env);
 if(existing){if(choice&&choice!==existing.book_id)throw new PaymentError('This payment is already linked to '+BOOK_PRODUCTS[existing.book_id].title+'.',409);if(existing.book_id!=='life-secrets'&&payment.get('mc_gross')!=='7.99')throw new PaymentError('Payment amount does not match this book.',403);if(orderToken){const order=await readBookOrder(orderToken,env);if(order.book_id!==existing.book_id)throw new PaymentError('This payment is already linked to '+BOOK_PRODUCTS[existing.book_id].title+'. Please use a new payment for another book.',409);}return existing.book_id;}
 if(payment.get('mc_gross')!=='7.99'){if(orderToken)throw new PaymentError('This payment amount does not match the selected $7.99 checkout.',403);return 'life-secrets';}
 const paidAt=Math.floor(Date.parse(payment.get('payment_date')||'')/1000);let order=null,suggestedBook=null;
 if(orderToken){order=await readBookOrder(orderToken,env);if(choice&&choice!==order.book_id)throw new PaymentError('The confirmed checkout belongs to a different book.',409);}
 else if(request&&isNewSharedBookPayment(payment,env)){
  const session=await bookBrowserSession(request,env);
  if(session){
   const rows=(await env.DB.prepare('SELECT o.* FROM book_checkout_orders o LEFT JOIN book_payment_allocations p ON p.order_id=o.id WHERE o.session_id=? AND o.created_at<=? AND o.expires_at>=? AND p.transaction_id IS NULL ORDER BY o.created_at DESC,o.id DESC LIMIT 50').bind(session,paidAt+120,paidAt).all()).results;
   if(rows.length&&new Set(rows.map(r=>r.book_id)).size===1)suggestedBook=rows[0].book_id;
  }
 }
 if(order){const cutover=Date.parse(env.SHARED_BOOK_CHECKOUT_FROM||'')/1000;if(Number.isFinite(cutover)&&paidAt<cutover)throw new PaymentError('This receipt predates the selected-book checkout. It remains valid for its original book.',403);if(!Number.isFinite(paidAt)||paidAt<order.created_at-120||paidAt>order.expires_at)throw new PaymentError('This payment does not match the selected book checkout. Use the payment made after selecting this book.',403);}
 else if(isNewSharedBookPayment(payment,env)){
  if(choice&&(!usesSharedBookCheckout(choice)||BOOK_PRODUCTS[choice]?.price!=='7.99'))throw new PaymentError('Choose an available $7.99 book for this payment.',400);
  if(!choice){const error=new PaymentError('Choose the book you purchased to finish your download.',409);error.selectionRequired=true;error.suggestedBook=suggestedBook;throw error;}
 }
 if(choice&&!isNewSharedBookPayment(payment,env)&&choice!=='life-secrets')throw new PaymentError('This receipt remains valid for its original book.',403);
 const book=order?.book_id||(isNewSharedBookPayment(payment,env)&&choice?choice:'life-secrets');
 if(!env.DB){if(book!=='life-secrets')throw new PaymentError('Purchase delivery is temporarily unavailable.',503);return book;}
 if(!Number.isFinite(paidAt))throw new PaymentError('The payment date could not be verified.',503);
 await env.DB.prepare('INSERT OR IGNORE INTO book_payment_allocations(transaction_id,book_id,order_id,paid_at,created_at) VALUES(?,?,?,?,?)').bind(payment.get('txn_id'),book,order?.id||null,paidAt,Math.floor(Date.now()/1000)).run();
 const bound=await bookPaymentAllocation(payment,env);if(!bound)throw new PaymentError('This checkout was already used. Start a new checkout for another purchase.',409);
 if(bound.book_id!==book)throw new PaymentError('This payment is already linked to a different book.',409);return bound.book_id;
}
function sharedCheckoutShell(title,content){return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+bookEscape(title)+' — OPortals.com</title><style>*{box-sizing:border-box}body{margin:0;background:white;color:#243944;font:16px/1.65 Arial,sans-serif}main{max-width:600px;margin:6vh auto;padding:25px}.brand{font-size:27px;font-weight:800;text-decoration:none;color:#252d27}.brand b{color:#68734b}h1{font:700 34px/1.18 Arial,sans-serif;margin:28px 0 14px}h2{font-size:21px;line-height:1.35;margin-top:0}.box{border:1px solid #dce3d2;border-radius:10px;background:white;padding:24px;margin:24px 0}.price{font-size:27px;font-weight:700;margin-bottom:12px}.note{color:#65735b;font-size:14px}button,.button{display:block;width:100%;padding:15px;font:700 16px Arial;color:#193b4d;background:#d4e9ee;border:1px solid #abc8d1;border-radius:7px;cursor:pointer;text-align:center;text-decoration:none}a{color:#566b40}small{font-size:13px}.link{display:inline-block;margin-top:10px}button:focus-visible,a:focus-visible{outline:3px solid #7c965b;outline-offset:3px}</style></head><body><main><a class="brand" href="/"><b>O</b>Portals.com</a>'+content+'</main></body></html>';}
export function sharedBookCheckoutPage(book){const product=BOOK_PRODUCTS[book];return sharedCheckoutShell('Your book','<h1>Get '+bookEscape(product.title)+'.</h1><div class="box"><h2>'+bookEscape(product.title)+'</h2><p>Complete illustrated book · English · Digital PDF</p><p class="price">$7.99 USD</p><form action="/checkout" method="post"><input type="hidden" name="book" value="'+bookEscape(book)+'"><button type="submit">Pay with PayPal · $7.99 ↗</button></form><p class="note">Complete payment on PayPal, then return to OPortals to download your PDF. Keep your PayPal receipt.</p></div><a class="link" href="/book/'+bookEscape(book)+'">← Back to the book</a>');}
export function sharedBookRedirectPage(order){return sharedCheckoutShell('Continue to PayPal','<h1>Opening PayPal.</h1><p id="checkout-message">Your selected book: <strong>'+bookEscape(BOOK_PRODUCTS[order.book].title)+'</strong>.</p><p class="note">$7.99 USD · Return after payment to get this book.</p><script>try{sessionStorage.setItem("oportals-book-checkout",'+JSON.stringify(order.token)+');}catch{}location.replace('+JSON.stringify(PAYPAL_LINK)+');</script><noscript><p>Please enable JavaScript or open OPortals in a browser that supports it before continuing to payment.</p></noscript><a class="link" href="/book/'+bookEscape(order.book)+'">← Back to the book</a>');}
