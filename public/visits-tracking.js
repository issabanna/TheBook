(() => {
 'use strict';
 if(window.__oportalsVisitsLoaded)return;
 window.__oportalsVisitsLoaded=true;
 const slugs=['life-secrets','art-of-attention','lead-without-the-noise','man-and-people','sneakpeak-ideas','the-philosopher-manager','time-for-what-matters','stand-out-for-something'];
 const ids={
  'sample-start':'mirror_start','instructions-continue':'mirror_continue','results-button':'mirror_results',
  'share-result':'mirror_share_card','download-card':'mirror_save_card','paid-analysis':'mirror_paid_offer',
  'pay-mirror':'mirror_payment','copy-invite':'mirror_copy_link','copy-invitation':'mirror_copy_link','share-invitation':'mirror_share_link',
  'refresh-results':'mirror_refresh','back-dashboard':'mirror_back','close-reflection':'mirror_close_toggle',
  'quiz-next':'mirror_next','quiz-submit':'mirror_submit','create-own':'mirror_create_own',
  'quiz-back':'mirror_back','instructions-back':'mirror_back','return-dashboard':'mirror_back',
  'close-paid':'mirror_paid_close','close-book-review':'preview_close','pause-examples':'mirror_pause_examples'
 };
 function allowed(){
  if(window.OPORTALS_OWNER){clearSession();return false;}
  try{
   if(localStorage.getItem('oportals-testing-measurement')==='deny'){clearSession();return false;}
   const p=JSON.parse(localStorage.getItem('oportals-analytics-consent-v1'));
   if(p?.choice==='rejected'&&Date.now()-p.at<180*86400000){clearSession();return false;}
  }catch{}
  return true;
 }
 function page(){
  let p=location.pathname.replace(/^\/Testing(?=\/|$)/,'')||'/';p=p.replace(/\/$/,'')||'/';
  if(['/','/ideas','/SocialMirror'].includes(p))return p;
  if(/^\/info\/(about|contact|privacy|terms|refunds)$/.test(p))return p;
  if(p.startsWith('/book/')&&slugs.includes(p.slice(6)))return p;
  return null;
 }
 function source(){
  const u=new URL(location.href),s=(u.searchParams.get('utm_source')||'').toLowerCase();
  if(['instagram','ig'].includes(s))return 'instagram';if(['facebook','fb'].includes(s))return 'facebook';
  if(['google','bing','search'].includes(s))return s==='google'?'google':'search';
  if(['email','newsletter'].includes(s))return 'email';if(['whatsapp','wa'].includes(s))return 'whatsapp';
  if(s)return 'campaign';
  try{const h=new URL(document.referrer).hostname.toLowerCase();
   if(h===location.hostname||h==='oportals.com'||h.endsWith('.oportals.com'))return 'internal';
   if(h==='instagram.com'||h.endsWith('.instagram.com'))return 'instagram';
   if(h==='facebook.com'||h.endsWith('.facebook.com'))return 'facebook';
   if(h==='google.com'||h.endsWith('.google.com'))return 'google';
   if(h.includes('bing.com')||h.includes('duckduckgo.com'))return 'search';
   if(h==='whatsapp.com'||h.endsWith('.whatsapp.com'))return 'whatsapp';
   return 'other';
  }catch{return 'direct';}
 }
 const acquisition=source(),site=/^\/Testing(?:\/|$)/.test(location.pathname)?'testing':'live';
 const sessionKey='oportals-visit-session-'+site;let memorySession=null;
 function clearSession(){memorySession=null;try{sessionStorage.removeItem(sessionKey);}catch{}}
 function newId(){
  if(typeof crypto==='undefined')return null;
  if(crypto.randomUUID)return crypto.randomUUID();
  const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const h=[...a].map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 }
 function session(){
  const now=Date.now();let s=memorySession;try{s=JSON.parse(sessionStorage.getItem(sessionKey))||s;}catch{}
  if(!s||typeof s.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s.id)||!Number.isFinite(s.last)||now-s.last>=30*60*1000||now<s.last||!Number.isInteger(s.sequence)||s.sequence<0||s.sequence>=10000||!['direct','internal','instagram','facebook','google','search','email','whatsapp','campaign','other'].includes(s.source)){
   const id=newId();if(!id)return null;s={id,last:now,sequence:0,source:acquisition};
  }
  s.last=now;s.sequence++;memorySession=s;try{sessionStorage.setItem(sessionKey,JSON.stringify(s));}catch{}
  let timezone='';try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch{}
  const eventId=newId();return {session:s.id,sequence:s.sequence,...(eventId?{eventId}:{}),source:s.source,...(timezone?{timezone}:{})};
 }
 function send(event,target=''){
  const p=page();if(!p||!allowed())return;
  const identity=session();
  // Only approved pages/actions plus a short anonymous session. Never private URLs.
  fetch((site==='testing'?'/Testing':'')+'/api/visits-event',{
   method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({event,page:p,target,source:acquisition,consent:true,...(identity||{})})
  }).catch(()=>{});
 }
 let lastPage=null;
 function view(){const p=page();if(p&&p!==lastPage){lastPage=p;send('page_view');}}
 for(const name of ['pushState','replaceState']){
  const original=history[name];history[name]=function(...args){const result=original.apply(this,args);Promise.resolve().then(view);return result;};
 }
 window.addEventListener('popstate',view);view();
 document.addEventListener('click',event=>{
  const el=event.target.closest?.('a,button');if(!el)return;
  if(['privacy-settings','measurement-accept','measurement-reject','analytics-settings','analytics-accept','analytics-reject'].includes(el.id)||el.classList.contains('close-measurement'))return;
  if(ids[el.id])return send('click',ids[el.id]);
  if(el.matches('[data-filter]')&&['all','original','inspired'].includes(el.dataset.filter))return send('click','filter:'+el.dataset.filter);
  if(el.matches('[data-week]'))return send('click','week_selection');
  if(el.matches('[data-page]'))return send('click','preview_page');
  if(el.closest('.card-example-picker'))return send('click','mirror_example');
  if(el.matches('[data-sample]')&&slugs.includes(el.dataset.sample))return send('click','preview:'+el.dataset.sample);
  if(el.tagName!=='A')return send('click','button_click');
  let u;try{u=new URL(el.getAttribute('href')||'',location.origin);}catch{return;}
  if(u.origin!==location.origin){
   if(u.hostname==='www.paypal.com'||u.hostname==='paypal.com')return send('click','paypal_checkout');
   return send('click','external_link');
  }
  const p=u.pathname.replace(/^\/Testing(?=\/|$)/,'')||'/';
  if(p==='/checkout'){
   const book=u.searchParams.get('book')||'life-secrets';
   if(slugs.includes(book))return send('click','buy:'+book);
   if(book==='social-mirror-analysis')return send('click','mirror_payment');
  }
  if(/^\/checkout\//.test(p)&&slugs.includes(p.split('/').pop()))return send('click','buy:'+p.split('/').pop());
  if(p.startsWith('/book/')&&slugs.includes(p.slice(6)))return send('click','book:'+p.slice(6));
  const sample=p.match(/^\/books\/([a-z0-9-]+)-sample\.pdf$/);
  if(sample&&slugs.includes(sample[1]==='man-and-people-guide'?'man-and-people':sample[1]))return send('click','preview:'+(sample[1]==='man-and-people-guide'?'man-and-people':sample[1]));
  if(p==='/ideas')return send('click','ideas');if(p==='/SocialMirror')return send('click','social_mirror');
  if(p==='/'&&u.hash==='#books')return send('click','explore_books');
  if(p==='/'&&u.hash==='#approach')return send('click','our_approach');
  if(p==='/')return send('click','home');
  if(/^\/info\/(about|contact|privacy|terms|refunds)$/.test(p))return send('click','info:'+p.split('/').pop());
 },{capture:true,passive:true});
})();
