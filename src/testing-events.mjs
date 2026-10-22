// Storefront-preview measurements are aggregates, never payment records or personal profiles.
export const previewBookSlugs=['life-secrets','art-of-attention','man-and-people','sneakpeak-ideas','the-space-you-keep','the-unfinished-path','meditations','the-enchiridion','the-republic','beyond-good-and-evil'];
export const previewEventNames=['home_view','catalog_view','book_view','sample_open','sample_page','purchase_click','checkout_preview'];
export async function recordPreviewEvent(request,env){
 if(!env.DB)return new Response(JSON.stringify({error:'Measurement is unavailable.'}),{status:503});
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Unsupported content type',{status:415});
 if(Number(request.headers.get('content-length'))>512)return new Response('Request too large',{status:413});
 const reader=request.body?.getReader();if(!reader)return new Response('Invalid event',{status:400});let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return new Response('Request too large',{status:413})}chunks.push(value)}
 let data;try{const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length}data=JSON.parse(new TextDecoder().decode(bytes))}catch{return new Response('Invalid event',{status:400})}
 if(!data||Object.keys(data).some(k=>!['event','book','consent'].includes(k))||data.consent!==true||!previewEventNames.includes(data.event)||!(data.book===''||previewBookSlugs.includes(data.book)))return new Response('Invalid event',{status:400});
 if(!['home_view','catalog_view'].includes(data.event)&&!data.book)return new Response('Book required',{status:400});
 const country=/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'ZZ';
 await env.DB.prepare('INSERT INTO testing_events (event_name, book_id, country, event_count, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(event_name, book_id, country) DO UPDATE SET event_count = testing_events.event_count + 1, updated_at = excluded.updated_at').bind(data.event,data.book,country,new Date().toISOString()).run();
 return new Response(null,{status:204});
}
export async function previewMetrics(env){
 if(!env.DB)return new Response('Measurement is unavailable',{status:503});
 const {results}=await env.DB.prepare('SELECT event_name, book_id, country, event_count, updated_at FROM testing_events ORDER BY event_count DESC').all();
 const total=name=>results.filter(r=>r.event_name===name).reduce((sum,r)=>sum+r.event_count,0);
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Testing measurements — OPortals</title><style>body{font:15px/1.7 Arial,sans-serif;margin:40px auto;padding:0 24px;max-width:980px;color:#303030}h1{font:40px Georgia,serif}table{width:100%;border-collapse:collapse}th,td{padding:12px 8px;text-align:left;border-bottom:1px solid #ddd}.table{overflow:auto}a{color:#52613d}.note{background:#f6f7f3;padding:20px}small{color:#626975}</style><a href="/Testing">← Testing bookstore</a><h1>Discovery, before sales.</h1><p class="note">Testing storefront events only, from readers who opt in. Counts are interactions, not unique visitors. Owner tests are included. This report is separate from the live website’s Google Analytics.</p><p>Home views: ${total('home_view')} · Catalog views: ${total('catalog_view')} · Book views: ${total('book_view')} · Sample opens: ${total('sample_open')} · Buy clicks: ${total('purchase_click')} · Checkout previews: ${total('checkout_preview')}</p><p><strong>Completed purchases, conversion rate and revenue: unavailable.</strong> No purchases can complete on this preview. Purchase and revenue reporting must come from verified payment records after the new checkout is connected. Newsletter reporting is also not active.</p><div class="table"><table><thead><tr><th>Event</th><th>Book</th><th>Country</th><th>Count</th></tr></thead><tbody>${results.map(r=>`<tr><td>${r.event_name}</td><td>${r.book_id||'—'}</td><td>${r.country==='ZZ'?'Unknown':r.country}</td><td>${r.event_count}</td></tr>`).join('')}</tbody></table></div><p><small>Country comes from the hosting platform where available. No IP, email, transaction ID, query string, message, or reader identifier is stored. Aggregates cannot establish unique-user conversion rates.</small></p><a href="/Testing/downloads">Book download counts ↗</a></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
}
