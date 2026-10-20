import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/analytics.js',import.meta.url),'utf8');
function browser(saved){
 const handlers={},nodes={};let cookie='_ga=old; _ga_ABC=old',reloads=0;
 const scripts=[],store=new Map();if(saved)store.set('oportals-analytics-consent-v1',JSON.stringify({choice:saved,at:Date.now()}));
 for(const id of ['analytics-consent','analytics-accept','analytics-reject','analytics-settings'])nodes[id]={hidden:true,focus(){},addEventListener(type,fn){handlers[id]=fn;}};
 const document={referrer:'https://example.com/search?private=data',title:'OPortals.com',getElementById:id=>nodes[id],querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
 Object.defineProperty(document,'cookie',{get:()=>cookie,set:v=>{cookie=v;}});
 const window={};const location={href:'https://oportals.com/?tx=SECRET&email=PRIVATE&utm_source=instagram',hostname:'oportals.com',reload(){reloads++},assign(){}};
 vm.runInNewContext(source,{document,window,location,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},URL,Date,JSON,setTimeout});
 return {window,nodes,scripts,handlers,get reloads(){return reloads;}};
}
test('no automatic privacy popup or Google request before opt-in',()=>{const b=browser();assert.equal(b.scripts.length,0);assert.equal(b.nodes['analytics-consent'].hidden,true);b.handlers['analytics-settings']();assert.equal(b.nodes['analytics-consent'].hidden,false);});
test('accept loads the provided GA ID; rejects PII URL parameters and strips referrer queries',()=>{const b=browser();b.handlers['analytics-accept']();assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-H7Z99E31L4');const commands=b.window.dataLayer.map(x=>Array.from(x));const view=commands.find(x=>x[0]==='event'&&x[1]==='page_view');assert.equal(view[2].page_location,'https://oportals.com/?utm_source=instagram');assert.equal(view[2].page_referrer,'https://example.com/search');});
test('reject never loads Google; saved acceptance loads once; withdrawal disables and reloads',()=>{const b=browser();b.handlers['analytics-reject']();assert.equal(b.scripts.length,0);const accepted=browser('accepted');assert.equal(accepted.scripts.length,1);accepted.handlers['analytics-reject']();assert.equal(accepted.window['ga-disable-G-H7Z99E31L4'],true);assert.equal(accepted.reloads,1);assert.equal(browser('rejected').scripts.length,0);});
