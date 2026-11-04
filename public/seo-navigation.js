(() => {
  const node=document.getElementById('seo-route-data');if(!node)return;
  let pages;try{pages=JSON.parse(node.textContent);}catch{return;}
  window.oportalsSeo=path=>{
    const testing=path.startsWith('/Testing'),key=path.replace(/^\/Testing(?=\/|$)/,'').replace(/\/$/,'')||'/',meta=pages[key];if(!meta)return;
    document.title=meta.title;
    function tag(name,content,property=false){let el=document.head.querySelector(`meta[${property?'property':'name'}="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.append(el);}el.content=content;}
    tag('description',meta.description);tag('robots',testing?'noindex,nofollow,noarchive':'index,follow,max-image-preview:large');
    for(const [name,value] of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:type':meta.view==='book'?'book':'website','og:url':meta.canonical,'og:image':meta.image,'og:image:width':'1200','og:image:height':'630','og:image:alt':meta.imageAlt}))tag(name,value,true);
    for(const [name,value] of Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt}))tag(name,value);
    let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=meta.canonical;
    document.getElementById('book-structured-data')?.remove();let schema=document.getElementById('seo-structured-data');if(schema)schema.textContent=JSON.stringify(meta.graph);
  };
  window.oportalsSeo(location.pathname);
})();
