const SEO_ORIGIN='https://oportals.com';
const SEO_ROBOTS='User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /Testing\nDisallow: /testing\nDisallow: /Visits\nDisallow: /visits\nDisallow: /Sessions\nDisallow: /sessions\nDisallow: /download\nDisallow: /downloads\nDisallow: /metrics\nDisallow: /leads\nDisallow: /contact-inbox\nDisallow: /checkout\nDisallow: /paypal/\nDisallow: /api/\nDisallow: /SocialMirror?ref=\nDisallow: /SocialMirror?manage=\nDisallow: /SocialMirror?payment=\nSitemap: https://oportals.com/sitemap.xml\n';
function seoEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function seoJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function seoFragment(html,id,value){const regex=new RegExp('(<([a-z]+)\\b[^>]*\\bid="'+id+'"[^>]*>)\\s*(<\\/\\2>)','i');return html.replace(regex,(_m,start,_tag,end)=>start+value+end);}
function seoVisibility(html,id,visible){return html.replace(new RegExp('<([a-z]+)\\b([^>]*\\bid="'+id+'"[^>]*)>','i'),(_m,tag,attrs)=>'<'+tag+attrs.replace(/\s+hidden(?:="[^"]*")?/g,'')+(visible?'':' hidden')+'>');}
function applyPageSeo(html,meta,{testing=false,privateLink=false,client=null}={}){
 if(!meta)return html;
 let end=html.indexOf('</head>');if(end<0)return html;
 let head=html.slice(0,end),body=html.slice(end);
 head=head.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/gi,'').replace(/<link\b[^>]*rel="canonical"[^>]*>/gi,'').replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'');
 const noindex=testing||privateLink,robots=noindex?'noindex,nofollow,noarchive':'index,follow,max-image-preview:large';
 head+='<title>'+seoEscape(meta.title)+'</title><meta name="description" content="'+seoEscape(meta.description)+'"><meta name="robots" content="'+robots+'"><link rel="canonical" href="'+seoEscape(meta.canonical)+'"><link rel="icon" type="image/svg+xml" href="/favicon.svg">';
 for(const [property,value] of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:type':meta.view==='book'?'book':'website','og:url':meta.canonical,'og:site_name':'OPortals','og:locale':'en_US','og:image':meta.image,'og:image:width':'1200','og:image:height':'630','og:image:alt':meta.imageAlt}))head+='<meta property="'+property+'" content="'+seoEscape(value)+'">';
 for(const [name,value] of Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt}))head+='<meta name="'+name+'" content="'+seoEscape(value)+'">';
 head+='<script type="application/ld+json" id="seo-structured-data">'+seoJson(meta.graph)+'</script>';
 if(client)head+='<script type="application/json" id="seo-route-data">'+seoJson(client)+'</script><script src="/seo-navigation.js?v=1" defer></script>';
 for(const [id,value] of Object.entries(meta.fragments||{}))body=seoFragment(body,id,value);
 if(meta.view==='book'||meta.view==='info'||meta.view==='ideas'){
  body=seoVisibility(body,'home-content',false);body=body.replace(/<section class="hero\b([^>]*)>/,'<section class="hero$1 hidden>');
  if(meta.view==='book'){body=seoVisibility(body,'book-detail',true);body=body.replace('<dialog id="book-review"','<dialog id="book-review" open data-prerendered');}
  if(meta.view==='info')body=seoVisibility(body,'info-view',true);
  if(meta.view==='ideas'){body=seoVisibility(body,'ideas-view',true);body=body.replace(/(<h1\b[^>]*id="journal-title"[^>]*>)[\s\S]*?(<\/h1>)/,(_m,a,b)=>a+seoEscape(meta.heading)+b);}
 }
 return head+body;
}
function seoSitemap(seo){return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+Object.values(seo?.pages||{}).map(p=>'<url><loc>'+seoEscape(p.canonical)+'</loc></url>').join('')+'</urlset>\n';}
export {SEO_ORIGIN,SEO_ROBOTS,applyPageSeo,seoSitemap};
