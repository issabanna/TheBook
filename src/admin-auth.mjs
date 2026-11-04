// Admin form pages use same-origin referrers: no-referrer makes browser POST Origin null.
// Password access supplements the trusted Sites owner identity. Secrets stay server-side.
const adminCookieName='__Host-oportals-admin';
const adminLifetime=8*60*60;
const adminPrivateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const adminHex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const adminBytes=hex=>Uint8Array.from(hex.match(/../g)||[],v=>parseInt(v,16));
async function adminMac(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return adminHex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));}
function adminEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function adminPasswordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return adminHex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:adminBytes(salt),iterations:100000,hash:'SHA-256'},key,256));}
export async function adminSession(request,env){
 if(!env.ADMIN_SESSION_KEY)return false;
 const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(adminCookieName+'='))?.slice(adminCookieName.length+1)||'';
 if(token.length>200)return false;
 const parts=token.split('.');if(parts.length!==3||!/^\d{10}$/.test(parts[0])||!/^\w{32}$/.test(parts[1])||! /^[a-f0-9]{64}$/.test(parts[2]))return false;
 const expires=Number(parts[0]),now=Math.floor(Date.now()/1000);if(expires<=now||expires>now+adminLifetime)return false;
 return adminEqual(parts[2],await adminMac('admin.'+parts[0]+'.'+parts[1],env.ADMIN_SESSION_KEY));
}
export function adminReturnPath(value){return typeof value==='string'&&/^\/(?:Visits|Sessions|Conversions|Testing)(?:[/?]|$)/.test(value)&&!/[\\\u0000-\u0020<>"']/.test(value)&&value.length<=1024?value:'/Visits';}
const adminEscape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function adminLoginPage(next='/Visits',message=''){
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin sign in — OPortals.com</title><style>*{box-sizing:border-box}body{margin:0;background:#fafaf6;color:#252c25;font:16px/1.6 Arial,sans-serif}main{max-width:440px;margin:8vh auto;padding:28px}.logo{font-size:27px;font-weight:800;letter-spacing:-1px;color:#242824;text-decoration:none}.logo span{color:#78814e}h1{font:38px/1.15 Georgia,serif;margin:32px 0 12px}p{color:#636b61}form{padding:24px;background:white;border:1px solid #dbe0d2;border-radius:12px}label{display:block;font-weight:600;margin-bottom:5px}input{width:100%;font:inherit;border:1px solid #bec8b2;border-radius:6px;padding:12px;margin-bottom:18px}input:focus{outline:2px solid #82965e;outline-offset:2px}button{width:100%;font:600 16px Arial,sans-serif;padding:15px;background:#ccdcbb;color:#253222;border:1px solid #b5c89e;border-radius:7px;cursor:pointer}a{color:#52603e}.error{color:#90452f}.links{display:flex;gap:20px;flex-wrap:wrap;font-size:14px}</style></head><body><main><a class="logo" href="/"><span>O</span>Portals.com</a><h1>Your website dashboard.</h1><p>Sign in to view Visits, Sessions and your Testing website.</p>'+(message?'<p class="error" role="alert">'+adminEscape(message)+'</p>':'')+'<form method="post" action="/admin/login"><input type="hidden" name="next" value="'+adminEscape(adminReturnPath(next))+'"><label for="username">Username</label><input id="username" name="username" value="admin" autocomplete="username" required maxlength="64"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Sign in →</button></form><p>Stay signed in for up to 8 hours on this browser.</p><div class="links"><a href="/signin-with-chatgpt" target="_top">Sign in with ChatGPT</a><a href="/">Back to the bookstore</a></div></main></body></html>';
}
export function adminSignOutControl(){return '<form method="post" action="/admin/logout" style="margin:12px 0;text-align:right"><button type="submit" style="font:inherit;cursor:pointer;background:#f3f5ee;color:#37452d;border:1px solid #ccd5c0;padding:9px 15px;border-radius:6px">Sign out of admin</button></form>';}
export async function adminAuthRoute(request,env){
 const url=new URL(request.url),next=adminReturnPath(url.searchParams.get('next'));
 const response=(body,status=200,extra={})=>new Response(request.method==='HEAD'?null:body,{status,headers:{...adminPrivateHeaders,...extra}});
 if(url.pathname==='/admin/login'&&['GET','HEAD'].includes(request.method))return response(adminLoginPage(next));
 if(!['/admin/login','/admin/logout'].includes(url.pathname))return response('Not found.',404);
 if(request.method!=='POST')return response('Method not allowed.',405,{Allow:url.pathname==='/admin/login'?'GET, HEAD, POST':'POST'});
 if(request.headers.get('origin')!==url.origin)return response(adminLoginPage(next,'Please reload this sign-in page and try again.'),403);
 if(url.pathname==='/admin/logout')return response(null,303,{Location:'/admin/login','Set-Cookie':adminCookieName+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
 if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_SESSION_KEY||!env.DB)return response(adminLoginPage(next,'Admin sign-in is temporarily unavailable.'),503);
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return response('Use the sign-in form.',415);
 try{
  if(Number(request.headers.get('content-length'))>2048)return response('Request too large.',413);
  const reader=request.body?.getReader();if(!reader)return response('Invalid request.',400);let raw='',size=0;const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2048){await reader.cancel();return response('Request too large.',413);}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();
  const form=new URLSearchParams(raw),target=adminReturnPath(form.get('next'));
  const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/900)*900;
  // Hash the platform-provided IP; never store the address or use a client-supplied forwarding header.
  const key='admin:'+await adminMac(request.headers.get('cf-connecting-ip')||'unknown',env.ADMIN_SESSION_KEY);
  await env.DB.prepare('DELETE FROM contact_limits WHERE limit_key LIKE ? AND window_start < ?').bind('admin:%',now-1800).run();
  const attempts=await env.DB.prepare('INSERT INTO contact_limits (limit_key,window_start,request_count) VALUES (?,?,1) ON CONFLICT(limit_key,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count').bind(key,windowStart).all();
  if(attempts.results[0].request_count>10)return response(adminLoginPage(target,'Too many attempts. Please try again in 15 minutes.'),429,{'Retry-After':'900'});
  const [salt,expected]=env.ADMIN_PASSWORD_HASH.split('.');if(!/^[a-f0-9]{32}$/.test(salt)||! /^[a-f0-9]{64}$/.test(expected))return response('Admin sign-in is temporarily unavailable.',503);
  const password=form.get('password')||'';if(password.length>256)return response(adminLoginPage(target,'Username or password is incorrect.'),401);
  const actual=await adminPasswordHash(password,salt);
  if(!adminEqual(actual,expected)||form.get('username')!=='admin')return response(adminLoginPage(target,'Username or password is incorrect.'),401);
  const payload=(now+adminLifetime)+'.'+adminHex(crypto.getRandomValues(new Uint8Array(16))),signature=await adminMac('admin.'+payload,env.ADMIN_SESSION_KEY);
  return response(null,303,{Location:target,'Set-Cookie':adminCookieName+'='+payload+'.'+signature+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+adminLifetime});
 }catch{return response(adminLoginPage(next,'Admin sign-in is temporarily unavailable. Please try again.'),503);}
}
