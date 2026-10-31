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
  'quiz-next':'mirror_next','quiz-submit':'mirror_submit','create-own':'mirror_create_own'
 };
 function allowed(){
  if(window.OPORTALS_OWNER)return false;
  try{
   if(localStorage.getItem('oportals-testing-measurement')==='deny')return false;
   const p=JSON.parse(localStorage.getItem('oportals-analytics-consent-v1'));
   if(p?.choice==='rejected'&&Date.now()-p.at<180*86400000)return false;
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
 function send(event,target=''){
  const p=page();if(!p||!allowed())return;
  // Only approved page paths and action labels. No names, answers, tokens or emails.
  fetch((site==='testing'?'/Testing':'')+'/api/visits-event',{
   method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({event,page:p,target,source:acquisition,consent:true})
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
  if(ids[el.id])return send('click',ids[el.id]);
  if(el.matches('[data-filter]')&&['all','original','inspired'].includes(el.dataset.filter))return send('click','filter:'+el.dataset.filter);
  if(el.matches('[data-week]'))return send('click','week_selection');
  if(el.closest('.card-example-picker'))return send('click','mirror_example');
  if(el.matches('[data-sample]')&&slugs.includes(el.dataset.sample))return send('click','preview:'+el.dataset.sample);
  if(el.tagName!=='A')return;
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
