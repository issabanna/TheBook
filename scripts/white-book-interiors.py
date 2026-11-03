"""Remove full-page paper tints and edge rails, preserving book content and diagrams."""
from pathlib import Path
from collections import Counter
from hashlib import sha256
from io import BytesIO
import fitz,json,re,shutil
from pypdf import PdfReader
from pypdf.generic import FloatObject
from PIL import Image
R=Path(__file__).resolve().parents[1];PREVIOUS=R/'private/blue-grey-editions';BASE=R/'private/checkpoints/before-white-interiors';OUT=R/'private/white-interiors';BASE.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
manifest=json.loads((R/'private/checkpoints/before-blue-grey/manifest.json').read_text());expected={b['file']:b for b in json.loads((PREVIOUS/'verification-report.json').read_text())}
s=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(s.split('const actualPages=',1)[1])[0]
words=lambda p:Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
reports=[];jobs=[];changed_pages=0;image_count=0
for b in manifest:
 name=b['file'];slug=b['slug'];sample_name=name[:-4]+'-sample.pdf'
 for filename in [name,sample_name]:
  source=PREVIOUS/filename;assert sha256(source.read_bytes()).hexdigest()==expected[name]['sampleSha256' if filename==sample_name else 'sha256']
  if not (BASE/filename).exists():shutil.copy2(source,BASE/filename)
  assert (BASE/filename).read_bytes()==source.read_bytes(),'Rollback baseline differs'
 before=fitz.open(BASE/name);doc=fitz.open(BASE/name);reader=PdfReader(BASE/name);changed=[]
 for n,p in enumerate(doc):
  if n==0:continue
  # Only full-page paper rectangles and narrow, page-edge rails. Small panels,
  # diagram fills, cover art and all text keep their existing colours.
  width,height=p.rect.width,p.rect.height
  backgrounds=[d for d in p.get_drawings() if d.get('fill') and min(d['fill'])<.99 and d['rect'].width>=width*.95 and d['rect'].height>=height*.95]
  if not backgrounds:continue
  stream=reader.pages[n].get_contents();ops=stream.operations;out=[];i=0;edits=0
  while i<len(ops):
   args,op=ops[i]
   if op==b're' and i+1<len(ops) and ops[i+1][1] in [b'f',b'f*']:
    x,y,w,h=map(float,args)
    full=abs(x)<.1 and abs(y)<.1 and abs(w-width)<.1 and abs(h-height)<.1
    vertical=0<=x<=15 and abs(y)<.1 and 0<w<=15 and abs(h-height)<.1
    horizontal=abs(x)<.1 and (abs(y)<.1 or abs(y+h-height)<.1) and abs(w-width)<.1 and 0<h<=15
    if full or vertical or horizontal:
     out.extend([([],b'q'),([FloatObject(1)]*3,b'rg'),ops[i],ops[i+1],([],b'Q')]);i+=2;edits+=1;continue
   out.append(ops[i]);i+=1
  assert edits>=len(backgrounds),(slug,n+1,'Unmatched background')
  stream.operations=out;contents=stream.get_data();xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,contents);p.set_contents(xref)
  assert words(p)==words(before[n]),(slug,n+1,'Text changed')
  # Page edges and blank paper positions must now be white, including old rails.
  pix=p.get_pixmap(alpha=False)
  for x,y in [(1,1),(10,10),(20,45),(int(width)-20,45),(20,int(height)-45)]:assert min(pix.pixel(x,y)[:3])>=253,(slug,n+1,'Paper is not white',x,y)
  changed.append(n+1)
 if changed:
  doc.save(OUT/name,garbage=4,deflate=True)
 else:shutil.copy2(BASE/name,OUT/name)
 result=fitz.open(OUT/name);assert len(result)==len(before)==b['pages'];assert all(words(a)==words(c) for a,c in zip(before,result));assert before[0].get_pixmap().samples==result[0].get_pixmap().samples
 assert sum(len(p.get_links()) for p in before)==sum(len(p.get_links()) for p in result)
 if changed:
  sample=fitz.open()
  for info in actual[slug]:sample.insert_pdf(result,from_page=info['page']-1,to_page=info['page']-1,links=False)
  sample.set_metadata({'title':result.metadata.get('title',b['title'])+' — Three-page sample','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});sample.subset_fonts();sample.save(OUT/sample_name,garbage=4,deflate=True)
  folder=R/'private/books'
  for filename in [name,sample_name]:shutil.copy2(OUT/filename,folder/filename)
  candidates={R/'public/editorial-media'/p['src'].split('/')[-1]:p['page'] for p in actual[slug] if p['page']>1}
  for image in (R/'public/editorial-media').glob('*.webp'):
   m=re.fullmatch(r'(?:editorial-|testing-collection-)?'+re.escape(slug)+r'-page-(\d+)\.webp',image.name)
   if m and 1<int(m[1])<=len(result):candidates[image]=int(m[1])
  for path,n in candidates.items():
   w=Image.open(path).width if path.exists() else 630;p=result[n-1];pix=p.get_pixmap(matrix=fitz.Matrix(w/p.rect.width,w/p.rect.width),alpha=False);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(path,'WEBP',quality=88,method=6);image_count+=1
  jobs.extend([{'name':name,'path':str((OUT/name).relative_to(R))},{'name':sample_name,'path':str((OUT/sample_name).relative_to(R)),'pageCount':3}])
 else:shutil.copy2(BASE/sample_name,OUT/sample_name)
 sample=fitz.open(OUT/sample_name);assert len(sample)==3
 for i,info in enumerate(actual[slug]):assert sample[i].get_pixmap().samples==result[info['page']-1].get_pixmap().samples
 changed_pages+=len(changed)
 reports.append({'slug':slug,'file':name,'pages':len(result),'changedPages':changed,'sha256':sha256((OUT/name).read_bytes()).hexdigest(),'sampleSha256':sha256((OUT/sample_name).read_bytes()).hexdigest()})
(BASE/'manifest.json').write_text(json.dumps(expected,indent=2));(OUT/'encryption-jobs.json').write_text(json.dumps(jobs,indent=2));(OUT/'verification-report.json').write_text(json.dumps(reports,indent=2))
print(json.dumps({'booksChecked':len(reports),'interiorPagesChecked':sum(x['pages']-1 for x in reports),'whitePagesUpdated':changed_pages,'booksAlreadyWhite':sum(not x['changedPages'] for x in reports),'previewImagesUpdated':image_count,'coversTextLinksPreserved':True,'threePageSamplesMatch':True}))
