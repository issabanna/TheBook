(() => {
 'use strict';
 if(window.__oportalsCommerceLoaded)return;window.__oportalsCommerceLoaded=true;
 const ID='G-H7Z99E31L4',KEY='oportals-analytics-consent-v1',MAX_AGE=180*86400000;
 let enabled=false,loaded=false,lastPage=null,memorySession=null;const sentPurchases=new Set();
 const banner=document.getElementById('analytics-consent');
 let products={};try{products=JSON.parse(document.getElementById('cro-products')?.textContent||'{}');}catch{}
 const current=()=>new URL(location.href),testing=()=>/^\/Testing(?:\/|$)/.test(current().pathname);
 const path=()=>current().pathname.replace(/^\/Testing(?=\/|$)/,'').replace(/\/$/,'')||'/';
 const privateMirror=()=>path()==='/SocialMirror'&&(current().search||current().hash);
 function preference(){try{const p=JSON.parse(localStorage.getItem(KEY));return p&&Date.now()-p.at<MAX_AGE&&['accepted','rejected'].includes(p.choice)?p.choice:null;}catch{return null;}}
 function save(choice){try{localStorage.setItem(KEY,JSON.stringify({choice,at:Date.now()}));}catch{}}
 function cleanLocation(){const u=current(),safe=new URL(u.origin+u.pathname);for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=u.searchParams.get(key);if(value&&/^[A-Za-z0-9_. -]{1,150}$/.test(value))safe.searchParams.set(key,value);}return safe.href;}
 function cleanReferrer(){if(path()==='/paypal/return')return '';try{const r=new URL(document.referrer);return r.origin+r.pathname;}catch{return '';}}
 function campaignParams(){
  let saved;try{saved=JSON.parse(sessionStorage.getItem('oportals-campaign-v1')||'null');}catch{}
  const now=Date.now(),keys={utm_source:'campaign_source',utm_medium:'campaign_medium',utm_campaign:'campaign_name',utm_content:'campaign_content',utm_term:'campaign_term'};
  if(!saved||saved.at>now||now-saved.at>=7*86400000){const utm={};for(const key of Object.keys(keys)){const value=current().searchParams.get(key);if(value&&/^[A-Za-z0-9_. -]{1,150}$/.test(value))utm[key]=value;}saved={at:now,utm};try{sessionStorage.setItem('oportals-campaign-v1',JSON.stringify(saved));}catch{}}
  const out={};for(const [key,name] of Object.entries(keys)){const value=saved.utm?.[key];if(typeof value==='string'&&/^[A-Za-z0-9_. -]{1,150}$/.test(value))out[name]=value;}return out;
 }
 function allowed(){if(window.OPORTALS_OWNER||privateMirror()||(typeof navigator!=='undefined'&&(navigator.webdriver||/bot|spider|crawler|headless|lighthouse|pagespeed/i.test(navigator.userAgent||''))))return false;try{if(localStorage.getItem('oportals-testing-measurement')==='deny')return false;}catch{}return preference()!=='rejected';}
 function source(){const s=(current().searchParams.get('utm_source')||'').toLowerCase();if(['instagram','ig'].includes(s))return 'instagram';if(['facebook','fb'].includes(s))return 'facebook';if(['google','bing','search'].includes(s))return s==='google'?'google':'search';if(['email','newsletter'].includes(s))return 'email';if(['whatsapp','wa'].includes(s))return 'whatsapp';if(s)return 'campaign';try{const h=new URL(document.referrer).hostname.toLowerCase();if(h===current().hostname||h==='oportals.com'||h.endsWith('.oportals.com'))return 'internal';if(h==='instagram.com'||h.endsWith('.instagram.com'))return 'instagram';if(h==='facebook.com'||h.endsWith('.facebook.com'))return 'facebook';if(h==='google.com'||h.endsWith('.google.com'))return 'google';if(h.includes('bing.com')||h.includes('duckduckgo.com'))return 'search';return 'other';}catch{return current().searchParams.has('fbclid')?'campaign':'direct';}}
 function uuid(){try{if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const h=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}catch{return null;}}
 function session(){let saved;try{saved=JSON.parse(sessionStorage.getItem('oportals-visit-session-'+(testing()?'testing':'live'))||'null');}catch{}if(saved?.id&&Date.now()-saved.last<1800000)return {id:saved.id,source:saved.source};if(!memorySession)memorySession={id:uuid(),source:source()};return memorySession;}
 function firstParty(event,book=''){
  if(!enabled||!allowed()||typeof fetch!=='function'||path()==='/paypal/return')return;
  const s=session(),id=uuid();if(!id||!s?.id)return;
  fetch((testing()?'/Testing':'')+'/api/conversion-event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event,eventId:id,session:s.id,page:path(),book,source:s.source,consent:true})}).catch(()=>{});
 }
 function ga(event,data){if(enabled&&allowed()&&loaded&&!testing()&&window.gtag)window.gtag('event',event,{...campaignParams(),...data});}
 function item(book){const b=products[book];return b?{item_id:book,item_name:b.title,price:Number(b.price),quantity:1}:null;}
 function ecommerce(event,book){const product=item(book);if(!product)return;firstParty(event,book);ga(event,{currency:'USD',value:product.price,items:[product]});window.oportalsMetaEvent?.(event,book);}
 function trackPage(){
  if(!enabled||!allowed())return;const p=path();if(p===lastPage)return;lastPage=p;
  ga('page_view',{page_location:cleanLocation(),page_referrer:cleanReferrer(),page_title:document.title});window.oportalsMetaPage?.();
  const book=p.startsWith('/book/')?p.slice(6):'';
  firstParty('page_view',products[book]?book:'');if(products[book])ecommerce('view_item',book);
  if(p==='/checkout'){
   const selected=current().searchParams.get('book')||'life-secrets';let recent=false;
   try{const prior=JSON.parse(sessionStorage.getItem('oportals-checkout-measurement')||'null');recent=prior?.book===selected&&Date.now()-prior.at<20000;}catch{}
   if(!recent)ecommerce('begin_checkout',selected);
  }
 }
 window.oportalsTrackPage=trackPage;
 window.oportalsTrackPurchase=purchase=>{
  if(!purchase?.eligible||!enabled||!allowed()||testing()||!loaded||!/^OP-[a-f0-9]{24}$/.test(purchase.transaction_id)||purchase.currency!=='USD'||!Number.isFinite(purchase.value)||purchase.value<=0||!Array.isArray(purchase.items)||purchase.items.length!==1||!products[purchase.items[0].item_id])return;
  const key='oportals-purchase-measured-'+purchase.transaction_id;if(sentPurchases.has(key))return;try{if(localStorage.getItem(key))return;}catch{}
  // The response is issued only after server verification. A stable opaque
  // transaction_id provides GA4's transaction deduplication across receipts.
  ga('purchase',{transaction_id:purchase.transaction_id,currency:purchase.currency,value:purchase.value,items:purchase.items});sentPurchases.add(key);try{localStorage.setItem(key,String(Date.now()));}catch{}
 };
 function enable(withCookies=true){
  enabled=true;if(!allowed())return;
  if(testing()){trackPage();return;}
  window['ga-disable-'+ID]=false;
  if(!loaded){
   loaded=true;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
   window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   if(withCookies)window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('js',new Date());window.gtag('config',ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:cleanLocation(),page_referrer:cleanReferrer(),ignore_referrer:path()==='/paypal/return'});
   const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ID;document.head.appendChild(script);
  }else if(withCookies)window.gtag('consent','update',{analytics_storage:'granted'});
  trackPage();if(window.OPORTALS_VERIFIED_PURCHASE)window.oportalsTrackPurchase(window.OPORTALS_VERIFIED_PURCHASE);
 }
 function clearCookies(){const domains=['',location.hostname,'.'+location.hostname];for(const part of (document.cookie||'').split(';')){const name=part.trim().split('=')[0];if(/^_ga(?:_|$)/.test(name))for(const domain of domains)document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}}
 function removeAttribution(){if(typeof fetch==='function')fetch((testing()?'/Testing':'')+'/api/conversion-event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:'{"consent":false}'}).catch(()=>{});}
 function choose(choice){
  save(choice);if(banner)banner.hidden=true;
  if(choice==='accepted'){try{if(localStorage.getItem('oportals-testing-measurement')==='deny')localStorage.setItem('oportals-testing-measurement','allow');}catch{}lastPage=null;enable(true);}else{enabled=false;window['ga-disable-'+ID]=true;clearCookies();removeAttribution();if(loaded)location.reload();}
 }
 for(const id of ['measurement-accept','analytics-accept'])document.getElementById(id)?.addEventListener('click',()=>choose('accepted'));
 for(const id of ['measurement-reject','analytics-reject'])document.getElementById(id)?.addEventListener('click',()=>choose('rejected'));
 document.getElementById('analytics-settings')?.addEventListener('click',()=>{if(banner){banner.hidden=false;document.getElementById('analytics-reject')?.focus();}});
 let bookOff=false;try{bookOff=localStorage.getItem('oportals-testing-measurement')==='deny';}catch{}
 if(bookOff||preference()==='rejected'){window['ga-disable-'+ID]=true;clearCookies();removeAttribution();}else enable(true);
 if(banner)banner.hidden=true;
 if(typeof history!=='undefined')for(const name of ['pushState','replaceState']){const original=history[name];if(typeof original==='function')history[name]=function(...args){const result=original.apply(this,args);Promise.resolve().then(trackPage);return result;};}
 window.addEventListener?.('popstate',()=>Promise.resolve().then(trackPage));
 document.addEventListener?.('click',event=>{
  const el=event.target.closest?.('a,button');if(!el||!enabled||!allowed())return;
  const preview=el.dataset?.sample;if(products[preview]){ecommerce('preview_opened',preview);return;}
  let url;try{url=new URL(el.getAttribute('href')||'',current().origin);}catch{return;}
  if(url.origin!==current().origin)return;
  const p=url.pathname.replace(/^\/Testing(?=\/|$)/,''),selected=el.dataset?.purchase||(p==='/checkout'?url.searchParams.get('book')||'life-secrets':null);
  if(products[selected]){ecommerce('begin_checkout',selected);try{sessionStorage.setItem('oportals-checkout-measurement',JSON.stringify({book:selected,at:Date.now()}));}catch{}return;}
  const match=p.match(/^\/book\/([a-z0-9-]+)$/);if(match&&products[match[1]])ecommerce('select_item',match[1]);
 },{capture:true,passive:true});
})();
