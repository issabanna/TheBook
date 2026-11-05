(() => {
 'use strict';
 if(window.__oportalsMetaLoaded)return;window.__oportalsMetaLoaded=true;
 let config={};try{config=JSON.parse(document.getElementById('meta-tracking-config')?.textContent||'{}');}catch{}
 const ID='4490808921236945',KEY='oportals-meta-consent-v1',AGE=180*86400000;
 const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
 let initialized=false,sdkGranted=false,lastPage=null,lastBook=null,contextReady=false,syncing=null,consentGeneration=0;
 const page=()=>location.pathname.replace(/\/$/,'')||'/';
 function choice(){try{const p=JSON.parse(localStorage.getItem(KEY)||'null');return p&&p.at<=Date.now()&&Date.now()-p.at<AGE&&p.choice==='accepted';}catch{return false;}}
 function selectedPreference(){
  if(!analyticsAllowed())return false;
  try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p?.choice==='rejected')return false;}catch{}
  // Suggest the selection for new visitors; only Save creates a consent grant.
  return true;
 }
 function analyticsAllowed(){try{const p=JSON.parse(localStorage.getItem('oportals-analytics-consent-v1')||'null');return localStorage.getItem('oportals-testing-measurement')!=='deny'&&!(p?.choice==='rejected'&&Date.now()-p.at<AGE);}catch{return true;}}
 function safePage(){return page()==='/'||page()==='/ideas'||/^\/(?:book\/[a-z0-9-]+|ideas\/(?:attention|choices|leadership|meaning)|info\/(?:about|privacy|terms|refunds|contact))$/.test(page())||page()==='/checkout'||page()==='/SocialMirror'&&!location.search&&!location.hash;}
 function allowed(){return config.enabled===true&&config.testMode!==true&&config.pixelId===ID&&location.hostname==='oportals.com'&&!window.OPORTALS_OWNER&&!/^\/Testing(?:\/|$)/.test(page())&&safePage()&&choice()&&analyticsAllowed()&&!(typeof navigator!=='undefined'&&(navigator.webdriver||/bot|spider|crawler|headless|lighthouse|pagespeed/i.test(navigator.userAgent||'')));}
 let products={};try{products=JSON.parse(document.getElementById('cro-products')?.textContent||'{}');}catch{}
 function campaign(){
  const now=Date.now();let saved;try{saved=JSON.parse(sessionStorage.getItem('oportals-campaign-v1')||'null');}catch{}
  if(saved&&now-saved.at<7*86400000&&saved.at<=now)return saved.utm||{};
  const utm={},u=new URL(location.href);for(const key of utmKeys){const v=u.searchParams.get(key);if(v&&/^[A-Za-z0-9_. -]{1,150}$/.test(v))utm[key]=v;}
  try{sessionStorage.setItem('oportals-campaign-v1',JSON.stringify({at:now,utm}));}catch{}return utm;
 }
 function cookie(name){return (document.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||null;}
 function clearCookies(){for(const name of ['_fbp','_fbc'])for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Path=/; Secure; SameSite=Lax; Max-Age=0'+(domain?'; Domain='+domain:'');}
 function context(){
  const u=new URL(location.href),click=u.searchParams.get('fbclid');let fbc=cookie('_fbc'),fbp=cookie('_fbp'),session=null;
  if(click&&/^[A-Za-z0-9_-]{1,500}$/.test(click)&&(!fbc||fbc.split('.').slice(3).join('.')!==click)){fbc='fb.1.'+Date.now()+'.'+click;document.cookie='_fbc='+fbc+'; Path=/; Secure; SameSite=Lax; Max-Age=604800';}
  try{session=JSON.parse(sessionStorage.getItem('oportals-visit-session-live')||'null')?.id||null;}catch{}
  let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
  if(!/^[a-f0-9-]{36}$/i.test(saved.context||'')||!saved.contextAt||Date.now()-saved.contextAt>=7*86400000){saved={...saved,context:crypto.randomUUID(),contextAt:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{}}
  return {consent:true,context:saved.context,session,utm:campaign(),...(fbp?{fbp}:{}),...(fbc?{fbc}:{})};
 }
 function revokeServer(id){if(typeof fetch==='function')return fetch('/api/meta/consent',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:false,...(id?{context:id}:{})})}).catch(()=>{});return Promise.resolve();}
 function sync(){
  if(!allowed()||typeof fetch!=='function')return Promise.resolve();if(syncing)return syncing;
  const data=context(),generation=consentGeneration;
  syncing=fetch('/api/meta/consent',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>{
   if(generation!==consentGeneration||!choice()||!analyticsAllowed()){contextReady=false;if(!choice()||!analyticsAllowed())return revokeServer(data.context);}
   else contextReady=r.ok;
  }).catch(()=>{}).finally(()=>{syncing=null;if(generation!==consentGeneration&&allowed())sync();});return syncing;
 }
 function sanitizeAddress(){
  // The SDK reads the browser address itself. Keep approved campaign/click
  // parameters only; never initialise it on receipts, downloads or private links.
  const u=new URL(location.href),safe=new URL(u.origin+u.pathname);for(const key of utmKeys){const v=u.searchParams.get(key);if(v&&/^[A-Za-z0-9_. -]{1,150}$/.test(v))safe.searchParams.set(key,v);}
  const selected=u.searchParams.get('book');if(page()==='/checkout'&&products[selected])safe.searchParams.set('book',selected);
  const click=u.searchParams.get('fbclid');if(click&&/^[A-Za-z0-9_-]{1,500}$/.test(click))safe.searchParams.set('fbclid',click);if(['#books','#approach','#inside-book'].includes(u.hash))safe.hash=u.hash;
  if(safe.href!==u.href)history.replaceState(history.state,'',safe.href);
 }
 function init(){
  if(!allowed())return false;sanitizeAddress();if(initialized){if(!sdkGranted){window.fbq('consent','grant');sdkGranted=true;}return true;}initialized=true;
  if(!window.fbq){const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};fbq.push=fbq;fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;if(!window._fbq)window._fbq=fbq;}
  const fbq=window.fbq;fbq.disablePushState=true;
  fbq('consent','grant');sdkGranted=true;fbq('set','autoConfig',false,ID);fbq('init',ID);
  const script=document.createElement('script');script.async=true;script.id='oportals-meta-sdk';script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script);
  sync();return true;
 }
 function trackPage(){
  if(!init()||lastPage===page())return;lastPage=page();window.fbq('trackSingle',ID,'PageView');
 }
 function event(name,book){
  if(!['view_item','begin_checkout'].includes(name)||!products[book]||!init())return;
  if(name==='view_item'){const key=page()+':'+book;if(lastBook===key)return;lastBook=key;}
  else{
   let prior;try{prior=JSON.parse(sessionStorage.getItem('oportals-meta-checkout-v1')||'null');}catch{}
   if(prior?.book===book&&Date.now()-prior.at<20000)return;
   try{sessionStorage.setItem('oportals-meta-checkout-v1',JSON.stringify({book,at:Date.now()}));}catch{}
  }
  const b=products[book],value=Number(b.price);if(!Number.isFinite(value)||value<=0)return;
  window.fbq('trackSingle',ID,name==='view_item'?'ViewContent':'InitiateCheckout',{content_type:'product',content_ids:[book],content_name:b.title,contents:[{id:book,quantity:1,item_price:value}],num_items:1,value,currency:'USD'});
 }
 window.oportalsMetaPage=trackPage;window.oportalsMetaEvent=event;
 function refresh(){
  const checkbox=document.getElementById('meta-marketing-consent');if(checkbox)checkbox.checked=selectedPreference();
  if(!allowed())return;trackPage();const book=page().startsWith('/book/')?page().slice(6):null;if(book)event('view_item',book);
  if(page()==='/checkout')event('begin_checkout',new URL(location.href).searchParams.get('book')||'life-secrets');
 }
 function revoke(persist=true){
  consentGeneration++;contextReady=false;let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(persist!==false)localStorage.setItem(KEY,JSON.stringify({...saved,choice:'rejected',at:Date.now()}));}catch{}
  if(initialized)window.fbq('consent','revoke');sdkGranted=false;clearCookies();revokeServer(saved.context);
 }
 function save(){
  const checkbox=document.getElementById('meta-marketing-consent');if(!checkbox?.checked){revoke();return;}
  consentGeneration++;let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(!choice()){delete saved.context;delete saved.contextAt;}localStorage.setItem(KEY,JSON.stringify({...saved,choice:'accepted',at:Date.now()}));}catch{}refresh();sync();
 }
 for(const id of ['measurement-accept','analytics-accept'])document.getElementById(id)?.addEventListener('click',save);
 for(const id of ['measurement-reject','analytics-reject'])document.getElementById(id)?.addEventListener('click',revoke,{capture:true});
 for(const id of ['privacy-settings','analytics-settings'])document.getElementById(id)?.addEventListener('click',()=>{const box=document.getElementById('meta-marketing-consent');if(box)box.checked=selectedPreference();});
 document.getElementById('meta-privacy-settings')?.addEventListener('click',()=>{document.getElementById('meta-marketing-consent').checked=selectedPreference();document.getElementById('measurement-dialog').showModal();});
 if(document.getElementById('meta-privacy-settings'))for(const id of ['measurement-accept','measurement-reject','meta-close-settings'])document.getElementById(id)?.addEventListener('click',()=>document.getElementById('measurement-dialog').close());
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a||e.button>0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.target==='_blank'||!allowed())return;
  let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{return;}
  if(u.origin!==location.origin||u.pathname!=='/checkout')return;
  // Let a first consent/cookie write complete before the PayPal handoff. A
  // bounded failure cannot block payment; already-synchronised visits continue.
  if(!contextReady||syncing){e.preventDefault();Promise.race([sync(),new Promise(resolve=>setTimeout(resolve,1200))]).finally(()=>location.assign(u.href));}
  else sync();
 },{capture:true});
 window.addEventListener?.('storage',e=>{if([KEY,'oportals-analytics-consent-v1','oportals-testing-measurement'].includes(e.key)&&(!choice()||!analyticsAllowed()))revoke(false);});
 refresh();if(!choice()||!analyticsAllowed()){try{if(localStorage.getItem(KEY))revoke();}catch{}}
 // Purchase is server-only. There is deliberately no browser Purchase event.
})();
