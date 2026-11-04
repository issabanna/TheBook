import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{parseHTML}=require('linkedom');
const site='https://oportals.com',organization={'@type':'Organization','@id':site+'/#organization',name:'OPortals',url:site+'/',logo:site+'/oportals-mark.svg'};
const description='Explore illustrated philosophy books for everyday life. Read three-page samples, discover practical ideas, and get your free Social Mirror results card.';
const absolute=value=>new URL(value.replace(/^\/Testing(?=\/|$)/,''),site).href;
const shorten=text=>text.length<=165?text:text.slice(0,162).replace(/\s+\S*$/,'')+'…';
function contextFor(html){
 const {window,document}=parseHTML(html);let current=new URL(site+'/Testing');
 const location={get pathname(){return current.pathname},get hash(){return current.hash},get origin(){return current.origin},get href(){return current.href},get search(){return current.search},assign(value){throw Error('Unexpected SEO build redirect: '+value)}};
 const history={pushState(_a,_b,url){current=new URL(url,current)},replaceState(_a,_b,url){current=new URL(url,current)}};
 window.HTMLElement.prototype.getBoundingClientRect=()=>({height:0,width:200});window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.focus=()=>{};
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 window.scrollTo=()=>{};window.location=location;
 const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 const context=vm.createContext({window,document,location,history,URL,URLSearchParams,console,localStorage:storage,sessionStorage:storage,fetch:async()=>({ok:false}),requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout:()=>{},crypto:{randomUUID:()=>''}});
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=|application\/ld\+json|application\/json/.test(match[1]))vm.runInContext(match[2],context,{timeout:5000});
 const run=code=>vm.runInContext(code,context,{timeout:5000});
 return {document,run,navigate(path){current=new URL(site+'/Testing'+(path==='/'?'':path));run('routeView()');},fragment(id){const node=document.getElementById(id);for(const card of node.querySelectorAll('.product'))card.style.removeProperty('min-height');return node.innerHTML;}};
}
function crumbs(path,name,parent){const list=[{name:'OPortals',item:site+'/'}];if(parent)list.push({name:parent.name,item:site+parent.path});if(path!=='/')list.push({name,item:site+path});return {'@type':'BreadcrumbList',itemListElement:list.map((x,i)=>({'@type':'ListItem',position:i+1,...x}))};}
function page(path,title,desc,image,graph,extra={}){return {path,title,description:shorten(desc),canonical:site+path,image:site+'/media/'+image,imageAlt:title,graph:{'@context':'https://schema.org','@graph':[organization,...graph]},...extra};}
export function buildSeoPages(html,{live=false}={}){
 const app=contextFor(html),pages={},editions=app.run('editions.filter(b=>!b.alwaysFree&&bookPrices[b.slug])'),covers=app.run('completedCovers'),prices=app.run('bookPrices'),weeks=app.run('weeklyEdition.weeks');
 const bookList=editions.map((b,i)=>({'@type':'ListItem',position:i+1,name:b.title,url:site+'/book/'+b.slug}));
 pages['/']=page('/','Illustrated Philosophy Books & Tools | OPortals',description,'seo-home.webp',[{'@type':'WebSite','@id':site+'/#website',name:'OPortals',url:site+'/',publisher:{'@id':organization['@id']}},{'@type':'CollectionPage',name:'Illustrated philosophy books',url:site+'/',mainEntity:{'@type':'ItemList',itemListElement:bookList}}],{view:'home',fragments:{bookshelf:app.fragment('bookshelf')}});
 for(const b of editions){
  const path='/book/'+b.slug,image='seo-'+b.slug+'.webp';app.navigate(path);
  const book={'@type':['Book','Product'],'@id':site+path+'#book',name:b.title,description:b.description,url:site+path,image:absolute(covers[b.id]),inLanguage:'en',bookFormat:'https://schema.org/EBook',numberOfPages:b.type==='inspired'?(b.pageCount||44):b.pages,author:{'@id':organization['@id']},publisher:{'@id':organization['@id']},brand:{'@id':organization['@id']},sku:b.slug,offers:{'@type':'Offer',url:site+path,price:Number(prices[b.slug]).toFixed(2),priceCurrency:'USD',availability:'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition'}};
  if(b.type==='inspired')book.isBasedOn={'@type':'Book',name:b.sourceTitle||b.title,author:{'@type':'Person',name:b.author}};
  pages[path]=page(path,b.title+' — Illustrated Book | OPortals',b.description,image,[book,crumbs(path,b.title)],{view:'book',fragments:{'book-detail':app.fragment('book-detail')}});
 }
 for(const key of ['about','privacy','terms','refunds','contact']){
  const path='/info/'+key;app.navigate(path);const info=app.run('infoContent['+JSON.stringify(key)+']'),desc={about:'Learn about OPortals: illustrated philosophy books, practical reflection questions and visual tools for thinking clearly about everyday life.',contact:'Contact OPortals about illustrated philosophy books, digital downloads, purchases or Social Mirror. Send a question using our website contact form.',privacy:'Read how OPortals handles website visits, analytics, contact messages, purchases and Social Mirror feedback, and how to manage your privacy choices.',terms:'Read the terms for using OPortals, buying and downloading digital philosophy books, and using our reflection tools and website.',refunds:'Read the OPortals refund policy for digital book purchases, including how to contact us about a download problem or a purchase that needs attention.'}[key];
  pages[path]=page(path,info.title+' | OPortals',desc,'seo-home.webp',[{'@type':key==='about'?'AboutPage':key==='contact'?'ContactPage':'WebPage',name:info.title,url:site+path},crumbs(path,info.title)],{view:'info',fragments:{'info-view':app.fragment('info-view')}});
 }
 for(const week of [null,...weeks]){
  const path=week?'/ideas/'+week.id:'/ideas';app.navigate(path);const current=week||weeks[0];app.run('renderWeekly('+JSON.stringify(current.id)+')');
  const title=week?week.label+' Ideas for Everyday Life | OPortals':'Philosophy Ideas for Everyday Life | OPortals';
  const articles=current.ideas.map((idea,i)=>({'@type':'Article','@id':site+path+'#idea-'+(i+1),headline:idea.title,description:idea.lead,articleBody:idea.body.join('\n\n'),inLanguage:'en',author:{'@id':organization['@id']},publisher:{'@id':organization['@id']},image:absolute('/media/'+current.art)}));
  pages[path]=page(path,title,week?week.intro:'Read illustrated philosophy about attention, choices, leadership and meaning. Explore twelve short reflections and practical questions for everyday life.','seo-ideas-'+current.id+'.webp',[{'@type':'CollectionPage',name:week?week.title:'OPortals journal',url:site+path,hasPart:articles},crumbs(path,week?week.label:'Ideas',week?{name:'Ideas',path:'/ideas'}:null)],{view:'ideas',fragments:{'weekly-content':app.fragment('weekly-content')},heading:week?week.title:'Ideas for the week you have.'});
 }
 const mirrorPath='/SocialMirror';pages[mirrorPath]=page(mirrorPath,'Social Mirror — Free Friend Feedback Card | OPortals','Invite friends to answer six questions anonymously. After at least five responses, unlock your free Social Mirror results card. Share it only if you choose.','seo-social-mirror.webp',[{'@type':'WebApplication',name:'Social Mirror',url:site+mirrorPath,applicationCategory:'LifestyleApplication',operatingSystem:'Any web browser',description:'A free reflection tool based on anonymous feedback from at least five friends.',offers:{'@type':'Offer',price:'0.00',priceCurrency:'USD'},publisher:{'@id':organization['@id']}},crumbs(mirrorPath,'Social Mirror')],{view:'mirror',fragments:{}});
 if(live)for(const meta of Object.values(pages))for(const [id,value] of Object.entries(meta.fragments))meta.fragments[id]=value.replaceAll('/Testing','');
 return {pages,client:Object.fromEntries(Object.entries(pages).map(([path,{fragments,...meta}])=>[path,meta]))};
}
