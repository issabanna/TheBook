"""Add only the approved Testing catalogue records and compact shelf styles."""
from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1];P=R/'public/testing-next.html';s=P.read_text();new=json.loads((R/'src/testing-catalogue.json').read_text());slugs={b['slug'] for b in new}
def get(name):
 start=s.index('const '+name+'=')+len('const '+name+'=');return json.JSONDecoder().raw_decode(s[start:])[0]
def put(name,value):
 global s
 start=s.index('const '+name+'=')+len('const '+name+'=');_,n=json.JSONDecoder().raw_decode(s[start:]);s=s[:start]+json.dumps(value,ensure_ascii=False,separators=(',',':'))+s[start+n:]
originals=[b for b in get('books') if b['slug'] not in slugs];companions=[b for b in get('summaries') if b['slug'] not in slugs]
topics=['BOUNDARIES & RESPONSIBILITY','BELIEFS & JUDGMENT','ENOUGH & COMPARISON','CHANGE & IDENTITY','JUDGMENT & DAILY LIFE','CHOICE & FREEDOM','PLEASURE & FRIENDSHIP','QUESTIONS & VALUES','HABITS & FLOURISHING','TIME & ATTENTION']
for b,topic in zip(new,topics):
 item={k:b[k] for k in ['id','slug','title','completed','checkoutPending','price','pageCount','pdf','samplePdf']};item.update(topic=topic,color='cream',art='path',reviewOnly=False)
 if b['category']=='original':item.update(subtitle=b['subtitle'],pages=b['pageCount']);originals.append(item)
 else:item.update(author=b['author'],why=b['subtitle'],source=b['source'],sourceLabel=b['sourceTitle'],sourceTitle=b['sourceTitle'],pages=[]);companions.append(item)
put('books',originals);put('summaries',companions)
covers=get('completedCovers');covers.update({b['id']:b['cover'] for b in new});put('completedCovers',covers)
pages=get('actualPages');pages.update({b['slug']:b['actualPages'] for b in new});put('actualPages',pages)
# Existing purchase links stay unchanged. The new editions have a planned price,
# real samples and owner-review PDFs, with no misleading checkout action.
s=s.replace("b.completed&&!b.reviewOnly?`<a class=\"buy\"", "b.completed&&!b.reviewOnly&&!b.checkoutPending?`<a class=\"buy\"")
s=s.replace("'<span class=\"not-ready\">In development</span>'", "b.checkoutPending?'<span class=\"not-ready\">Checkout coming soon</span>':'<span class=\"not-ready\">In development</span>'")
s=s.replace("${b.completed?'44-page PDF':'3-page overview · In development'}", "${b.completed?(b.pageCount||44)+'-page PDF':'3-page overview · In development'}")
s=s.replace("${b.id==='sneakpeak'?760:","${b.pageCount?720:b.id==='sneakpeak'?760:")
s=s.replace("if(b.checkoutPending)return '<button class=\"secrets-buy\" type=\"button\" disabled>Checkout coming soon · $7.99</button>';",'')
s=s.replace("if(!b.completed||b.reviewOnly||!bookPrices[b.slug])return", "if(b.checkoutPending)return '<button class=\"secrets-buy\" type=\"button\" disabled>Checkout coming soon · $7.99</button>';if(!b.completed||b.reviewOnly||!bookPrices[b.slug])return")
s=s.replace("b.type==='inspired'?44:b.pages", "b.type==='inspired'?(b.pageCount||44):b.pages")
s=s.replace("${esc(b.author)}’s ${esc(b.title)}", "${esc(b.author)}’s ${esc(b.sourceTitle||b.title)}")
s=s.replace("name:b.title,author:{'@type':'Person',name:b.author}", "name:b.sourceTitle||b.title,author:{'@type':'Person',name:b.author}")
s=s.replace("||'SneakPeak Ideas · page '+p.page", "||b.title+' · page '+p.page")
s=s.replace("'life-secrets','art-of-attention','lead-without-the-noise','man-and-people','sneakpeak-ideas'].includes(b.slug)","'life-secrets','art-of-attention','lead-without-the-noise','man-and-people','sneakpeak-ideas',"+','.join(json.dumps(b['slug']) for b in new)+"].includes(b.slug)")
s=s.replace('${b.checkoutPending?\'<aside class="development-review"><strong>Read before you choose.</strong><p>The complete illustrated edition is ready to review. Read the three-page sample; purchases will open when checkout is available.</p></aside>\':\'\'}','')
s=s.replace("${!b.completed||b.reviewOnly?`<aside", "${b.checkoutPending?'<aside class=\"development-review\"><strong>Read before you choose.</strong><p>The complete illustrated edition is ready to review. Read the three-page sample; purchases will open when checkout is available.</p></aside>':''}${!b.completed||b.reviewOnly?`<aside")
s=s.replace("${b.alwaysFree?'Free to read':b.completed&&!b.reviewOnly?'Complete illustrated edition'", "${b.alwaysFree?'Free to read':b.checkoutPending?'Complete edition · checkout coming soon':b.completed&&!b.reviewOnly?'Complete illustrated edition'")
s=s.replace("b.alwaysFree?'Read or download without payment.':'Paid downloads require", "b.alwaysFree?'Read or download without payment.':b.checkoutPending?'Free three-page sample. Complete PDF available for signed-in owner review; purchases are not open yet.':'Paid downloads require")
# Merge facts/captions before the relevant functions run.
s=re.sub(r'/\* Testing catalogue facts \*/.*?/\* End Testing catalogue facts \*/\n','',s,flags=re.S)
s=s.replace('const actualPages=', '/* Testing catalogue facts */\nObject.assign(bookFacts,'+json.dumps({b['id']:b['facts'] for b in new},ensure_ascii=False,separators=(',',':'))+');\n/* End Testing catalogue facts */\nconst actualPages=')
s=re.sub(r'/\* Testing catalogue captions \*/.*?/\* End Testing catalogue captions \*/\n','',s,flags=re.S)
s=s.replace(' const futurePages=', ' /* Testing catalogue captions */\n Object.assign(pageCaptions,'+json.dumps({b['slug']:b['captions'] for b in new},ensure_ascii=False,separators=(',',':'))+');\n /* End Testing catalogue captions */\n const futurePages=')
s=s.replace('data-filter="original" aria-pressed="false">Originals</button>','data-filter="original" aria-pressed="false">Originals <span>10</span></button>').replace('data-filter="inspired" aria-pressed="false">Reimagined</button>','data-filter="inspired" aria-pressed="false">Reimagined <span>7</span></button>')
s=s.replace('<span>Paid books · $7.99–$9.99 USD</span>','<span>17 illustrated titles · New editions $7.99 USD</span>')
css='''/* Testing catalogue compact shelf */
.books{grid-template-columns:repeat(6,minmax(0,1fr));gap:16px 12px;align-items:stretch}
.books .product,.books .product.in-development{width:100%;padding:9px;min-width:0;border:1px solid #dfe4da;border-radius:8px;justify-self:stretch;background:#fff}
.books .product .cover-shelf{height:auto;aspect-ratio:1/1;padding:0;overflow:hidden;border-radius:5px;background:#f6f7f2}
.books .product .completed-cover{display:block;width:100%;max-width:none;height:100%;object-fit:cover;object-position:50% 12%;margin:0}
.books .product h3,.books .product:not(.in-development) h3{font-size:18px;line-height:1.12;min-height:40px;margin:10px 0 5px}
.books .product>p{font-size:12px;line-height:1.45;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:35px;margin:7px 0}
.books .product .source-author{font-size:10px;line-height:1.35;min-height:27px}
.books .product .label{font-size:8px;letter-spacing:.6px;min-height:0;margin:8px 0 0}
.books .product .book-theme{display:none}.books .product .format{font-size:10px;line-height:1.4;margin:4px 0 9px}
.books .product .price{font-size:19px;margin:8px 0 0}.books .product .price small{font-size:10px}
.books .product .product-actions{margin-top:auto;gap:6px}.books .product .sample-btn,.books .product .buy,.books .product .not-ready{font-size:11px;line-height:1.25;min-height:40px;padding:10px 6px;border-radius:5px;text-align:center}
.books .product .not-ready{color:#627052;background:#f2f5ed;border:1px solid #dfe5d6;display:flex;justify-content:center;align-items:center}
.book-filters button span{font-size:11px;opacity:.7;margin-left:4px}.detail-actions button:disabled{cursor:default;background:#edf2e6;color:#58644b;border:1px solid #d5dfc9;box-shadow:none}
@media(max-width:1150px){.books{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:950px){.books{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:690px){.books{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 9px}.books .product h3{font-size:17px}}
@media(max-width:540px){.books{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px 10px}.books .product,.books .product.in-development{padding:8px}.books .product h3,.books .product:not(.in-development) h3{font-size:19px;min-height:42px}.books .product .sample-btn,.books .product .buy{min-height:44px}.books .product>p{font-size:12px;min-height:35px}.book-filters{gap:6px}.book-filters button{padding:9px 10px}}
/* End Testing catalogue compact shelf */'''
s=re.sub(r'/\* Testing catalogue compact shelf \*/.*?/\* End Testing catalogue compact shelf \*/','',s,flags=re.S);s=s.replace('</style>',css+'\n</style>',1)
P.write_text(s)
print('Testing: '+str(sum(not b.get('alwaysFree') for b in originals))+' Originals / '+str(len(companions))+' Reimagined. Live snapshots untouched.')
