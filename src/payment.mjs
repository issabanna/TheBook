const encoder = new TextEncoder();
export class PaymentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const SITE_URL = 'https://oportals.com';
export const PAYPAL_LINK = 'https://www.paypal.com/ncp/payment/CS8XK9B6XLU64';
export const BOOK_PRODUCTS = {
 'social-mirror-analysis':{title:'Social Mirror — Detailed Analysis',price:'4.00',sku:'SOCIAL-MIRROR-ANALYSIS',service:true,link:'https://www.paypal.com/ncp/payment/ET3BZ9GVKS3PS'},
 'life-secrets':{title:'Life Secrets',price:'7.99',sku:'LIFE-SECRETS',file:'life-secrets.pdf',link:PAYPAL_LINK},
 'art-of-attention':{title:'The Art of Attention',price:'8.99',sku:'ART-OF-ATTENTION',file:'art-of-attention.pdf',link:'https://www.paypal.com/ncp/payment/QE8P2E2FZBCEL'},
 'lead-without-the-noise':{title:'Lead Without the Noise',price:'8.99',sku:'LEAD-WITHOUT-THE-NOISE',file:'lead-without-the-noise.pdf',link:'https://www.paypal.com/ncp/payment/ZX77G6ENKZTGN'},
 'man-and-people':{title:'Man and People',price:'9.99',sku:'MAN-AND-PEOPLE',file:'man-and-people-guide.pdf',link:'https://www.paypal.com/ncp/payment/ZR4GFQB5AAV7G'}
};
export function paymentBook(p,env){
 const name=p.get('item_name'),sku=p.get('item_number');
 if(['Social Mirror - Detailed Analysis','Social Mirror Detailed Analysis'].includes(name))return 'social-mirror-analysis';
 const named=Object.entries(BOOK_PRODUCTS).find(([id,b])=>name===b.title);
 if(named)return named[0];
 if(env.PAYPAL_ITEM_NAME&&name===env.PAYPAL_ITEM_NAME)return 'life-secrets';
 if(name)throw new PaymentError('Payment product does not match.',403);
 const bySku=Object.entries(BOOK_PRODUCTS).find(([id,b])=>sku===b.sku);
 if(bySku)return bySku[0];
 if(sku===(env.PAYPAL_ITEM_NUMBER||'LIFE-SECRETS'))return 'life-secrets';
 throw new PaymentError('Payment product does not match.',403);
}
export function ready(env) {
  return Boolean(env.PAYPAL_PDT_TOKEN && env.PAYPAL_RECEIVER_EMAIL && env.BOOK_ENCRYPTION_KEY && env.DOWNLOAD_SIGNING_KEY);
}
export function emailReady(env) { return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM); }
export function paramsUnique(raw, separator = '&') {
  const params = new URLSearchParams(raw.split(separator).join('&'));
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new PaymentError('Ambiguous payment response.');
  return params;
}
export function validTransaction(tx) { return typeof tx === 'string' && /^[A-Z0-9]{8,32}$/.test(tx); }
export function assertPayment(p, env, tx) {
  if (!env.PAYPAL_RECEIVER_EMAIL) throw new PaymentError('Checkout is not ready yet.', 503);
  if (p.get('payment_status') !== 'Completed') throw new PaymentError('Payment is not completed.', 403);
  const book=paymentBook(p,env),expected=BOOK_PRODUCTS[book].price;
  if (p.get('mc_currency') !== 'USD' || !(p.get('mc_gross')===expected || book==='life-secrets'&&/^15(?:\.00)?$/.test(p.get('mc_gross')||''))) throw new PaymentError('Payment does not match this book.', 403);
  if ((p.get('receiver_email') || '').toLowerCase() !== env.PAYPAL_RECEIVER_EMAIL.trim().toLowerCase()) throw new PaymentError('Payment recipient does not match.', 403);
  if (!validTransaction(p.get('txn_id')) || (tx && tx !== p.get('txn_id'))) throw new PaymentError('Transaction does not match.', 403);
  if (env.PAYPAL_ENV !== 'sandbox' && p.get('test_ipn') === '1') throw new PaymentError('Test payments are not accepted here.', 403);
  return p;
}
function paypalUrl(env, ipn = false) {
  return `https://${ipn ? 'ipnpb.' : 'www.'}${env.PAYPAL_ENV === 'sandbox' ? 'sandbox.' : ''}paypal.com/cgi-bin/webscr`;
}
async function remoteText(url, body, fetcher) {
  let response;
  try { response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10000) }); }
  catch { throw new PaymentError('PayPal verification is temporarily unavailable. Please try again.', 503); }
  if (!response.ok) throw new PaymentError('PayPal verification is temporarily unavailable. Please try again.', 503);
  const text = await response.text();
  if (text.length > 32768) throw new PaymentError('Invalid payment response.', 502);
  return text;
}
export async function verifyPDT(tx, env, fetcher = fetch) {
  if (!ready(env)) throw new PaymentError('Checkout is not ready yet.', 503);
  if (!validTransaction(tx)) throw new PaymentError('A valid PayPal transaction ID is required.');
  const body = new URLSearchParams({ cmd: '_notify-synch', tx, at: env.PAYPAL_PDT_TOKEN });
  const text = await remoteText(paypalUrl(env), body.toString(), fetcher);
  const lines = text.trim().split(/\r?\n/);
  if (lines.shift() !== 'SUCCESS') throw new PaymentError('We could not verify this payment. Check your PayPal receipt or try again shortly.', 403);
  return assertPayment(paramsUnique(lines.join('&')), env, tx);
}
export async function verifyIPN(raw, env, fetcher = fetch) {
  if (!ready(env)) throw new PaymentError('Checkout is not ready yet.', 503);
  if (raw.length > 16384) throw new PaymentError('Request too large.', 413);
  const p = paramsUnique(raw);
  const answer = await remoteText(paypalUrl(env, true), `cmd=_notify-validate&${raw}`, fetcher);
  if (answer.trim() !== 'VERIFIED') throw new PaymentError('Invalid payment notification.', 403);
  return p;
}
export function fromBase64(s) {
  const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(fixed), c => c.charCodeAt(0));
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signingKey(secret) {
  if (!secret) throw new PaymentError('Downloads are temporarily unavailable.', 503);
  return crypto.subtle.importKey('raw', fromBase64(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function issueToken(tx, env, expires = Math.floor(Date.now() / 1000) + 86400, book='life-secrets') {
  if (!validTransaction(tx)) throw new PaymentError('Invalid transaction.');
  const payload = base64url(encoder.encode(JSON.stringify({ v: 1, tx, exp: expires, book })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.DOWNLOAD_SIGNING_KEY), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}
export async function readToken(token, env, now = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof token !== 'string' || token.length > 1024) throw new Error();
    const [payload, sig, extra] = token.split('.');
    if (!payload || !sig || extra) throw new Error();
    if (!await crypto.subtle.verify('HMAC', await signingKey(env.DOWNLOAD_SIGNING_KEY), fromBase64(sig), encoder.encode(payload))) throw new Error();
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64(payload)));
    if (decoded.v !== 1 || !validTransaction(decoded.tx) || !Number.isSafeInteger(decoded.exp) || decoded.exp <= now) throw new Error();
    if(decoded.book&&!Object.hasOwn(BOOK_PRODUCTS,decoded.book))throw new Error();
    return decoded;
  } catch { throw new PaymentError('This download link is invalid or expired. Return to your purchase confirmation to get a new link.', 403); }
}
export async function decryptBook(asset, secret) {
  if (!secret) throw new PaymentError('Downloads are temporarily unavailable.', 503);
  const key = await crypto.subtle.importKey('raw', fromBase64(secret), 'AES-GCM', false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(asset.iv) }, key, fromBase64(asset.data));
}
export async function emailReceipt(payment, env, fetcher = fetch) {
  if(paymentBook(payment,env)==='social-mirror-analysis')return {enabled:false};
  if (!emailReady(env)) return { enabled: false };
  const email = payment.get('payer_email');
  if (!email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new PaymentError('Receipt email unavailable.', 503);
  const paidAt = Date.parse(payment.get('payment_date') || '');
  if (!Number.isFinite(paidAt)) throw new PaymentError('Payment date could not be verified.', 503);
  const exp = Math.floor(paidAt / 1000) + 7 * 86400;
  if (exp <= Date.now() / 1000) return { enabled: true, expired: true };
  const tx = payment.get('txn_id');
  const book=paymentBook(payment,env),product=BOOK_PRODUCTS[book];
  const token = await issueToken(tx, env, exp,book);
  const link = `${SITE_URL}/download?t=${encodeURIComponent(token)}`;
  let response;
  try { response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `life-secrets-${tx}` },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: `Your ${product.title} book — OPortals`,
      text: `Thank you for purchasing ${product.title} for $${payment.get('mc_gross')} USD.\n\nDownload your PDF:\n${link}\n\nThis private link expires seven days after purchase. Keep your PayPal receipt. You can return to ${SITE_URL}/paypal/return and use the transaction ID on your receipt to verify your purchase again.\n\n${product.title}` }), signal: AbortSignal.timeout(10000)
  }); } catch { throw new PaymentError('Receipt email is temporarily unavailable.', 503); }
  if (!response.ok) throw new PaymentError('Receipt email is temporarily unavailable.', 503);
  return { enabled: true, sent: true };
}
