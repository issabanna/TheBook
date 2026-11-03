"""Integrate the approved, verified blue-grey PDFs and render their website previews."""
from pathlib import Path
import json,shutil,re,fitz
from PIL import Image
R=Path(__file__).resolve().parents[1];OUT=R/'private/blue-grey-editions';MEDIA=R/'public/editorial-media'
s=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(s.split('const actualPages=',1)[1])[0]
baseline=json.loads((R/'private/checkpoints/before-blue-grey/manifest.json').read_text());jobs=[];images=0
oldfour={'life-secrets','art-of-attention','lead-without-the-noise','man-and-people'}
oldthree={'the-philosopher-manager','time-for-what-matters','stand-out-for-something'}
for b in baseline:
 slug=b['slug'];name=b['file'];full=OUT/name;doc=fitz.open(full);folder=R/('private/publishing-preview' if slug in oldfour else 'private/books' if slug in oldthree else 'private/catalogue-expansion/pdf')
 shutil.copy2(full,folder/name);sample=fitz.open()
 for info in actual[slug]:sample.insert_pdf(doc,from_page=info['page']-1,to_page=info['page']-1,links=False)
 assert len(sample)==3
 sample_name=name[:-4]+'-sample.pdf';sample_path=OUT/sample_name
 sample.set_metadata({'title':doc.metadata.get('title',b['title'])+' — Three-page sample','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});sample.subset_fonts();sample.save(sample_path,garbage=4,clean=True,deflate=True)
 shutil.copy2(sample_path,folder/sample_name)
 legacy=R/'private/books'/sample_name
 if legacy.exists() and legacy.parent!=folder:shutil.copy2(sample_path,legacy)
 if slug=='life-secrets':shutil.copy2(sample_path,R/'public/Life-Secrets-Sample.pdf')
 # Keep cover image files unchanged. Refresh every existing numbered interior asset,
 # plus the exact currently published gallery URLs (some older assets are encrypted).
 candidates={MEDIA/info['src'].split('/')[-1]:info['page'] for info in actual[slug] if info['page']>1}
 stems={slug,name[:-4]}
 for p in MEDIA.glob('*.webp'):
  for stem in stems:
   m=re.fullmatch(r'(?:editorial-|testing-collection-)?'+re.escape(stem)+r'-page-(\d+)\.webp',p.name)
   if m and 1<int(m[1])<=len(doc):candidates[p]=int(m[1])
 for path,n in candidates.items():
  width=Image.open(path).width if path.exists() else 630
  pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(width/doc[n-1].rect.width,width/doc[n-1].rect.width),alpha=False)
  Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(path,'WEBP',quality=88,method=6);images+=1
 jobs.extend([{'name':name,'path':str(full.relative_to(R))},{'name':sample_name,'path':str(sample_path.relative_to(R)),'pageCount':3}])
(OUT/'encryption-jobs.json').write_text(json.dumps(jobs,indent=2));print(json.dumps({'fullBooks':len(baseline),'samples':len(jobs)//2,'previewImages':images,'coversPreserved':True}))
