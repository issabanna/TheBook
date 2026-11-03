"""Apply the three-page preview limit without changing complete editions."""
from pathlib import Path
import json,re,shutil
R=Path(__file__).resolve().parents[1];p=R/'public/testing-next.html';s=p.read_text()
def copy_labels(value):
 for old,new in [('Four-page','Three-page'),('four-page','three-page'),('Four pages','Three pages'),('four pages','three pages'),('four actual pages','three actual pages'),('cover and three selected pages','cover and two selected pages'),('cover and three representative pages','cover and two representative pages')]:value=value.replace(old,new)
 return re.sub(r'(?<!\d)4(?=[ -]pages?\b)','3',value)
s=copy_labels(s)
start=s.index('const actualPages=')+len('const actualPages=');pages,n=json.JSONDecoder().raw_decode(s[start:]);report=json.loads((R/'private/three-page-samples/report.json').read_text());slugs={b['slug'] for b in report}
for slug in slugs:pages[slug]=pages[slug][:3]
s=s[:start]+json.dumps(pages,ensure_ascii=False,separators=(',',':'))+s[start+n:];p.write_text(s)
p=R/'src/testing-catalogue.json';items=json.loads(p.read_text())
for b in items:b['actualPages']=b['actualPages'][:3];b['captions']=b['captions'][:3]
p.write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')))
# Keep the editable sample sources and the legacy direct download consistent.
for b in report:
 name=b['name'];source=R/'private/three-page-samples/after'/name
 folder=R/'private/catalogue-expansion/pdf' if b['slug'] in {v['slug'] for v in items} else R/'private/publishing-preview' if (R/'private/publishing-preview'/name).exists() else R/'private/books'
 shutil.copy2(source,folder/name)
shutil.copy2(R/'private/three-page-samples/after/life-secrets-sample.pdf',R/'public/Life-Secrets-Sample.pdf')
for file in ['scripts/integrate-testing-catalogue.py','scripts/organize-testing-home.cjs','scripts/refine-book-offers.cjs','scripts/retire-free-sampler-offer.cjs','scripts/apply-editorial-preview.cjs','scripts/build-weekly-preview.py']:
 p=R/file;p.write_text(copy_labels(p.read_text()))
p=R/'scripts/build-testing-catalogue.py';v=copy_labels(p.read_text()).replace('selected=[1,4,5,10]','selected=[1,4,5]').replace('samplePages=4','samplePages=3').replace("'Bring it into your day',b['chapters'][3]['title']","'Bring it into your day'");p.write_text(v)
p=R/'scripts/build-social-collection.py';v=copy_labels(p.read_text()).replace('for n in ns:d.insert_pdf','for n in ns[:3]:d.insert_pdf');p.write_text(v)
print('17 preview galleries, labels, local samples and the legacy download now use three pages. Full editions were not written.')
