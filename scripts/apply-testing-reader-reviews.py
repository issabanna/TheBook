"""Place supplied reader quotes on Testing without editing the live snapshot."""
from pathlib import Path
import json,html,re
R=Path(__file__).resolve().parents[1];p=R/'public/testing-next.html';s=p.read_text();reviews=json.loads((R/'src/reader-reviews.json').read_text())
e=lambda value:html.escape(value,quote=True)
cards=''.join('<article class="reader-review"><h3><a href="/Testing/book/'+e(r['slug'])+'">'+e(r['title'])+' ↗</a></h3><blockquote><p>'+e(r['quote'])+'</p></blockquote><p class="reader-credit">— Reader of '+e(r['title'])+'</p></article>' for r in reviews)
section='<section class="reader-feedback" id="reader-reviews" aria-labelledby="reader-reviews-title"><span class="eyebrow">Reader reviews</span><h2 id="reader-reviews-title">From our readers.</h2><div class="reader-feedback-grid">'+cards+'</div></section>'
start=s.index('<section class="reader-feedback"');end=s.index('</section>',start)+len('</section>');s=s[:start]+section+s[end:]
js='''/* Supplied reader reviews */
const readerReviews=REVIEWS;
function renderBookReview(slug){const review=readerReviews.find(r=>r.slug===slug);return review?`<section class="book-reader-review" aria-label="Reader review"><span class="eyebrow">Reader review</span><blockquote><p>${esc(review.quote)}</p></blockquote><p class="reader-credit">— Reader of ${esc(review.title)}</p></section>`:'';}
/* End supplied reader reviews */
'''.replace('REVIEWS',json.dumps(reviews,ensure_ascii=False,separators=(',',':')))
s=re.sub(r'/\* Supplied reader reviews \*/.*?/\* End supplied reader reviews \*/\n','',s,flags=re.S)
s=s.replace('function renderBook(b){',js+'function renderBook(b){',1)
if '${renderBookReview(b.slug)}' not in s:
 old="${b.type==='inspired'?' · Source credited':''}</p></div></div>"
 assert old in s
 s=s.replace(old,"${b.type==='inspired'?' · Source credited':''}</p>${renderBookReview(b.slug)}</div></div>",1)
css='''/* Testing reader reviews */
.reader-feedback{padding:24px 0;margin-top:12px}.reader-feedback h2{margin-bottom:16px}
.reader-feedback-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.reader-feedback-grid .reader-review{padding:18px;border:1px solid #dfe5d8;border-radius:8px;background:#fbfcf8;min-width:0}
.reader-feedback-grid .reader-review h3{font:700 16px/1.35 Arial,Helvetica,sans-serif;margin:0 0 11px;color:#50623d}
.reader-review h3 a:hover{text-decoration:underline;text-underline-offset:4px}
.reader-review blockquote,.book-reader-review blockquote{margin:0}
.reader-review blockquote p,.book-reader-review blockquote p{font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#35423a;margin:0}
.reader-review blockquote p:before,.book-reader-review blockquote p:before{content:'“'}
.reader-review blockquote p:after,.book-reader-review blockquote p:after{content:'”'}
.reader-feedback-grid .reader-credit,.book-reader-review .reader-credit{font:400 11px/1.5 Arial,Helvetica,sans-serif;color:#69745f;margin:12px 0 0}
.book-reader-review{padding:15px 17px;margin:20px 0 0;border:1px solid #dfe5d8;border-radius:7px;background:#f8faf4}
.book-reader-review .eyebrow{display:block;font-size:9px;color:#68734b;margin-bottom:8px}
.book-reader-review blockquote p{font-size:14px}
@media(max-width:600px){.reader-feedback-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:0 0 12px;overscroll-behavior-x:contain}.reader-feedback-grid .reader-review{flex:0 0 88%;scroll-snap-align:start;padding:16px}.reader-feedback-grid .reader-review h3{font-size:16px}.book-reader-review{padding:14px;margin-top:17px}}
/* End Testing reader reviews */'''
s=re.sub(r'/\* Testing reader reviews \*/.*?/\* End Testing reader reviews \*/','',s,flags=re.S);s=s.replace('</style>',css+'\n</style>',1);p.write_text(s)
print('Four exact supplied quotes added to the Testing homepage and matching book pages.')
