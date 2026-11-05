import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

for(const file of ['public/testing-next.html','public/published-storefront.html']){
 test(file+': related-book navigation resets scroll after rendering; preview and catalog anchors keep their destination',()=>{
  const html=readFileSync(file,'utf8'),{document}=parseHTML(html),frames=[],scrolls=[];
  const location={origin:'https://oportals.com',pathname:'/Testing/book/life-secrets',hash:''};
  const ctx={document,location,URL,bookReview:document.querySelector('#book-review'),window:{scrollTo:o=>scrolls.push(['top',o.top,o.behavior]),addEventListener:()=>{}},history:{scrollRestoration:'auto',pushState(_s,_t,url){Object.assign(location,{pathname:new URL(url,location.origin).pathname,hash:new URL(url,location.origin).hash})}},requestAnimationFrame:f=>frames.push(f),findEdition:slug=>({slug}),renderBook:()=>{document.querySelector('#book-detail').innerHTML='<h1>Selected book</h1><section id="inside-book">Preview</section>';},equalizeReadyCards:()=>{},trackPreview:()=>{},bookReturnPath:'',infoContent:{},paidReadySlugs:new Set()};
  for(const el of document.querySelectorAll('*')){el.focus=()=>{};el.scrollIntoView=o=>scrolls.push(['anchor',el.id,o.behavior]);}
  vm.createContext(ctx);
  const start=html.indexOf('function routeView()'),end=html.indexOf('// New-tab PDF links',start);
  vm.runInContext(html.slice(start,end),ctx);
  function click(href){const a=document.createElement('a');a.href=href;document.body.append(a);let prevented=false;const e=new document.defaultView.Event('click',{bubbles:true});Object.defineProperty(e,'button',{value:0});e.preventDefault=()=>{prevented=true};a.dispatchEvent(e);assert.ok(prevented);}
  click('/Testing/book/meditations-reimagined');assert.equal(scrolls.length,0,'wait for rendered layout');frames.shift()();assert.deepEqual(scrolls.pop(),['top',0,'smooth']);assert.equal(location.pathname,'/Testing/book/meditations-reimagined');assert.equal(ctx.history.scrollRestoration,'manual');
  // renderBook creates a fresh preview node; attach the DOM scrolling spy after render.
  click('/Testing/book/art-of-attention#inside-book');document.getElementById('inside-book').scrollIntoView=o=>scrolls.push(['anchor','inside-book',o.behavior]);frames.shift()();assert.deepEqual(scrolls.pop(),['anchor','inside-book','smooth']);
  click('/Testing#books');frames.shift()();assert.deepEqual(scrolls.pop(),['anchor','books','smooth']);
  click('/Testing/book/life-secrets#missing');frames.shift()();assert.deepEqual(scrolls.pop(),['top',0,'smooth']);
  ctx.window.matchMedia=()=>({matches:true});click('/Testing/book/life-secrets');frames.shift()();assert.deepEqual(scrolls.pop(),['top',0,'instant']);
 });
}

for(const file of ['public/social-mirror.html','public/social-mirror-published.html','public/social-mirror-shell.html']){
 test(file+': create-card and question actions reveal the active panel, while passive updates preserve scroll',()=>{
  const html=readFileSync(file,'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],frames=[],scrolls=[],panels={};
  for(const id of ['landing','instructions','quiz','dashboard','friend-done','results'])panels[id]={hidden:true,setAttribute(){},focus(){},scrollIntoView(o){scrolls.push([id,o.behavior])}};
  const ctx={passiveRender:false,$:id=>panels[id],requestAnimationFrame:f=>frames.push(f),setTimeout:()=>{},scheduleExamples:()=>{},window:{}};vm.createContext(ctx);
  vm.runInContext(script.split('\n').find(l=>l.startsWith('function view(')),ctx);
  // Create-card hides a long landing page before the quiz content is populated.
  vm.runInContext("view('quiz')",ctx);assert.equal(scrolls.length,0);assert.equal(panels.landing.hidden,true);frames.shift()();assert.deepEqual(scrolls,[['quiz','smooth']]);
  vm.runInContext("view('dashboard');view('results')",ctx);while(frames.length)frames.shift()();assert.deepEqual(scrolls,[['quiz','smooth'],['results','smooth']],'ignore a screen replaced before the frame');
  ctx.window.matchMedia=()=>({matches:true});vm.runInContext("view('quiz')",ctx);frames.shift()();assert.deepEqual(scrolls.at(-1),['quiz','instant']);
  ctx.passiveRender=true;vm.runInContext("view('results')",ctx);assert.equal(frames.length,0,'polling never scrolls');
  // Verify both real question handlers invoke the same reveal behavior.
  assert.match(script,/step\+\+;renderQuestion\(\);view\('quiz'\);return/);
  assert.match(script,/step--;renderQuestion\(\);view\('quiz'\)/);
 });
}
