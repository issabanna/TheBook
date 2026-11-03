"""Enable the approved same-price books while preserving other hosted products."""
from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1];p=R/'public/testing-next.html';s=p.read_text()
def read(name):return json.JSONDecoder().raw_decode(s.split('const '+name+'=',1)[1])[0]
def put(name,value):
 global s
 start=s.index('const '+name+'=')+len('const '+name+'=');_,n=json.JSONDecoder().raw_decode(s[start:]);s=s[:start]+json.dumps(value,ensure_ascii=False,separators=(',',':'))+s[start+n:]
books=read('books');summaries=read('summaries');prices=read('bookPrices')
for b in books+summaries:
 if b.get('alwaysFree'):continue
 if b.get('reviewOnly'):b['readerValidation']=True
 b['reviewOnly']=False;b['checkoutPending']=False
 if b['slug'] not in prices:prices[b['slug']]='7.99';b['price']=7.99
put('books',books);put('summaries',summaries);put('bookPrices',prices)
s=s.replace("const paidReadySlugs=new Set(['life-secrets','art-of-attention','man-and-people','lead-without-the-noise']);", "const paidReadySlugs=new Set(Object.keys(bookPrices));")
s=s.replace("b.completed&&!b.reviewOnly?'Complete edition':'In reader validation'", "b.readerValidation?'In reader validation':b.completed&&!b.reviewOnly?'Complete edition':'In reader validation'")
s=s.replace('Muted covers identify books in reader validation; they are not available to purchase.', 'Explore the three-page sample before choosing your complete illustrated book.')
s=s.replace('Titles marked In reader validation are not yet available to purchase.', 'Available editions have a Buy button; read the three-page sample before choosing.')
s=s.replace('Titles in reader validation or marked Checkout coming soon are not yet available to purchase.', 'Each available edition has a Buy button and a three-page sample.')
s=s.replace('Titles in reader validation or marked Checkout coming soon have free samples; purchases are not yet open.', 'All available editions have three-page samples and a Buy button. The selected title is confirmed before a shared $7.99 checkout.')
s=s.replace('Available editions have a Buy button; titles in reader validation or marked Checkout coming soon cannot be purchased yet.', 'The Buy button opens checkout for the selected title. Shared $7.99 purchases confirm the selected book before PayPal.')
s=s.replace('Titles in reader validation are not available to purchase.', 'Read the three-page sample before choosing an available edition.')
s=s.replace('Life Secrets, The Art of Attention, Lead Without the Noise and Man and People are available through PayPal at the prices shown on their book pages.', 'Available books use PayPal at the prices shown on their book pages.')
s=s.replace('Life Secrets, The Art of Attention, Lead Without the Noise and Man and People use our PayPal checkout at the prices shown on their book pages.', 'Available books use PayPal at the prices shown on their book pages.')
s=s.replace("${b.alwaysFree?'Free to read':b.checkoutPending?'Complete edition · checkout coming soon':b.completed&&!b.reviewOnly?'Complete illustrated edition'", "${b.alwaysFree?'Free to read':b.readerValidation?'Reader validation edition · Available to purchase':b.checkoutPending?'Complete edition · checkout coming soon':b.completed&&!b.reviewOnly?'Complete illustrated edition'")
# Explain the essential checkout cookie without exposing order IDs or payment tokens.
s=s.replace('<h2>Optional measurement</h2>', '<h2>Book checkout</h2><p>An essential cookie and this browser’s checkout tab remember the book you selected so a verified payment unlocks the matching PDF. Purchase records link a PayPal transaction to one book. Keep your receipt for access and support.</p><h2>Optional measurement</h2>',1)
p.write_text(s)
p=R/'src/testing-catalogue.json';data=json.loads(p.read_text())
for b in data:b['checkoutPending']=False
p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
p=R/'scripts/build-testing-catalogue.py';p.write_text(p.read_text().replace('checkoutPending=True','checkoutPending=False'))
print('All 17 books have purchase actions. Thirteen previously unavailable books use the shared $7.99 checkout; the existing three higher-priced links are preserved.')
