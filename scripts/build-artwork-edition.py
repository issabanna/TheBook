"""Approved varied artwork edition: full books, true samples and page previews.

The pre-character white editions supply authoritative text / covers; chapter
manuscripts supply the ten newer books. No public promotion or encryption here.
"""
from pathlib import Path
from collections import Counter,defaultdict
from io import BytesIO
import fitz,json,re,sys,hashlib,importlib.util
from PIL import Image
R=Path(__file__).resolve().parents[1];OUT=R/'private/artwork-edition';OUT.mkdir(exist_ok=True)
BASE=R/'private/checkpoints/before-character-collection';CURRENT=R/'private/checkpoints/before-artwork-edition';MEDIA=R/'public/editorial-media'
manifest=json.loads((CURRENT/'manifest.json').read_text());site=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(site.split('const actualPages=',1)[1])[0]
regions={b['slug']:{p['page']:p['regions'][0] for p in b['details']} for b in json.loads((R/'private/blue-grey-editions/quality-report.json').read_text())}
chapters={b['slug']:b for name in ['originals','reimagined'] for b in json.loads((R/f'private/catalogue-expansion/{name}.json').read_text())}
spec=importlib.util.spec_from_file_location('char',R/'scripts/build-character-collection.py');C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
study_spec=importlib.util.spec_from_file_location('study',R/'private/artwork-diagram-study/build-examples.py');S=importlib.util.module_from_spec(study_spec);study_spec.loader.exec_module(S)
words=lambda p:Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]

# Each quarter of the generated art sheets is a separate composition. PDF clips
# place them independently without altering or cropping the generated masters.
ART={};DOCS={};MASTER={}
def register(name,file,cell=None):
 file=str(file)
 if file not in DOCS:
  im=Image.open(file).convert('RGB');w,h=im.size;buf=BytesIO();im.save(buf,'JPEG',quality=82,optimize=True)
  d=fitz.open();p=d.new_page(width=w,height=h);p.insert_image(p.rect,stream=buf.getvalue());DOCS[file]=d
 d=DOCS[file];w,h=d[0].rect.width,d[0].rect.height
 clip=fitz.Rect(0,0,w,h) if cell is None else fitz.Rect((cell%2)*w/2,(cell//2)*h/2,(cell%2+1)*w/2,(cell//2+1)*h/2)
 # Export the PDF viewport at the digital edition's existing 600px artwork
 # width. A quarter-sheet must not embed three unused full-resolution scenes.
 framed=fitz.open();frame=framed.new_page(width=600,height=600*clip.height/clip.width);frame.show_pdf_page(frame.rect,d,0,clip=clip)
 jpeg=frame.get_pixmap(alpha=False).tobytes('jpeg',jpg_quality=80)
 placed=fitz.open();page=placed.new_page(width=frame.rect.width,height=frame.rect.height);page.insert_image(page.rect,stream=jpeg)
 ART[name]=(placed,page.rect);MASTER[name]={'file':str(Path(file).relative_to(R)),'quadrant':cell}
for board,names in {'agency':['compass','cooperation','acceptance','gate'],'thinking':['detail','shadow','clear-mirror','perspectives'],'work':['priority','handover','next-step','rest'],'living':['burden','listening','roots','choice']}.items():
 for i,name in enumerate(names):register(name,R/f'brand/artwork-edition/{board}.png',i)
for name in ['pause','purpose','judgment']:register(name,R/f'brand/artwork-edition/{name}.png')
for name,file in json.loads((R/'brand/character-scenes/manifest.json').read_text()).items():register(name,R/file)

TERMS={
 'compass':'direction value purpose meaningful aim priority choose intention',
 'cooperation':'cooperate cooperation shared mutual support interdependence together',
 'acceptance':'control uncontrolled uncontrollable outcome acceptance rain influence outside',
 'gate':'boundary boundaries limit permission refuse refusal no available agreement',
 'detail':'attention notice detail focus see visible evidence observe investigate',
 'shadow':'impression assumption fear anxious imagine judgment story inference',
 'clear-mirror':'revise revision verdict description belief wrong evidence mistaken identity',
 'perspectives':'perspective question examine inquiry disagreement understanding interpret reason',
 'priority':'priority select choose energy important urgent urgency signal compare',
 'handover':'delegate responsibility handover escalation manager authority team decision trust',
 'next-step':'action step next experiment practical attempt begin start investigation',
 'rest':'rest enough enjoy pleasure present ordinary moment pause leisure stop',
 'burden':'burden cost maintenance release excess more quantity promise demand obligation',
 'listening':'listen conversation greeting person people connection friendship relationship reply',
 'roots':'habit character practice repeat repetition patient grow foundation virtue',
 'choice':'choice alternative tradeoff opportunity option finite time limited',
 'pause':'pause yes answer promise request consider before',
 'purpose':'purpose enough need quantity growth want sufficient desire',
 'judgment':'friction difficult conduct morning day prepare resentment',
 **C.KEYWORDS}
def choose(p,slug,n,used):
 if n==4 and slug in {'meditations-reimagined','the-space-before-yes','the-quiet-art-of-enough'}:return {'meditations-reimagined':'judgment','the-space-before-yes':'pause','the-quiet-art-of-enough':'purpose'}[slug]
 heading=C.title(p).lower();body=p.get_text().lower();scores={}
 for key,terms in TERMS.items():
  scores[key]=sum((5 if re.search(r'\b'+re.escape(t)+r'\w*\b',heading) else 0)+(.35 if re.search(r'\b'+re.escape(t)+r'\w*\b',body) else 0) for t in terms.split())-used[key]*4
  if key in ['compass','cooperation','acceptance','gate','detail','shadow','clear-mirror','perspectives','priority','handover','next-step','rest','burden','listening','roots','choice','pause','purpose','judgment']:scores[key]+=1.5
  if key==C.OWN[slug]:scores[key]+=.5
 return max(scores,key=scores.get)
def put_art(p,key,rect):
 d,clip=ART[key];p.show_pdf_page(rect,d,0,clip=clip,keep_proportion=True)

def new_reading(book,c,n,key):
 d=fitz.open();p=d.new_page(width=420,height=1000)
 for k,path in S.fonts.items():p.insert_font(fontname='Study'+k,fontfile=str(path))
 size=12;p.insert_text((30,28),'O',fontname='Studylogo',fontsize=size,color=S.rgb('#68734b'));p.insert_text((30+S.ff['logo'].text_length('O',fontsize=size),28),'Portals.com',fontname='Studylogo',fontsize=size,color=S.rgb('#171b1e'))
 p.insert_text((315,26),f'IDEA {(n-2)//2:02} / READ',fontname='Studybold',fontsize=6.5,color=S.rgb(S.MUTED));p.draw_line((30,41),(390,41),color=S.rgb(S.LINE),width=.45)
 y=S.text(p,'ONE IDEA FOR AN ORDINARY DAY',30,56,360,7.5,'bold',S.SAGE)+9
 y=S.text(p,c['title'],30,y,360,31,'display',S.INK,36)+16
 art_h=180 if key=='judgment' else 204
 put_art(p,key,fitz.Rect(30,y,390,y+art_h));y+=art_h+12
 caption={'pause':'Make room to understand before you promise.','purpose':'Let the purpose tell you when there is enough.'}.get(key)
 if caption:y=S.text(p,caption,30,y,360,9.1,'italic',S.SAGE,12)+23
 else:
  # Label relationships remain selectable without recreating a boxed flowchart.
  y=S.text(p,' · '.join(c['labels']),30,y,360,9.1,'bold',S.SAGE,12)+23
 main_end=S.text(p,c['body'],30,y,276,11.2,'body',S.INK,15.6)
 z=S.text(p,'A DISTINCTION TO KEEP',322,y+1,68,7.1,'bold',S.SAGE,10)+8;z=S.text(p,c['note'],322,z,68,9.6,'italic',S.NAVY,13.6)
 if c['ref']:z=S.text(p,'READ ALONG',322,z+18,68,7.1,'bold',S.MUTED,10)+7;z=S.text(p,c['ref'],322,z,68,8.6,'body',S.MUTED,12)
 y=max(main_end,z)+30;y=S.text(p,'TAKE THIS INTO YOUR DAY',30,y,360,7.6,'bold',S.SAGE,11)+8;y=S.text(p,c['question'],30,y,350,16.5,'display',S.NAVY,22)
 H=max(630,y+65);assert H<1000;p.set_cropbox(fitz.Rect(0,0,420,H));p.insert_text((30,H-19),book['title'],fontname='Studybody',fontsize=7,color=S.rgb(S.MUTED));p.insert_text((378,H-19),f'{n:02}',fontname='Studybold',fontsize=8,color=S.rgb(S.SAGE))
 assert not any(any(i[0]=='re' for i in x['items']) for x in p.get_drawings())
 for value in [c['body'],c['note'],c['question'],c['ref']]:assert not(Counter(re.findall(r'\w+',value))-words(p)),(book['slug'],n,'Manuscript text lost')
 return d

def header_slot(p):
 ss=spans(p);heads=[s for s in ss if 'Anton' in s['font'] and s['size']>=17 and 45<s['bbox'][1]<240]
 if not heads:return None
 end=max(s['bbox'][3] for s in heads)
 subs=[s for s in ss if 11.7<=s['size']<17 and s['bbox'][0]<42 and end<s['bbox'][1]<245]
 if subs:end=max(end,max(s['bbox'][3] for s in subs))
 body=[s for s in ss if 10.5<=s['size']<=11.3 and s['bbox'][0]<42 and s['bbox'][1]>end+2 and s['bbox'][3]<p.rect.height-35]
 if not body:return None
 stop=min(s['bbox'][1] for s in body)-5
 if stop-end<68:return None
 region=fitz.Rect(29,end+6,391,stop)
 if any(fitz.Rect(s['bbox']).intersects(region) and not region.contains(fitz.Rect(s['bbox'])) for s in ss):return None
 return region

def replace_figure(source,n,region,key):
 d=fitz.open();d.insert_pdf(source,from_page=n,to_page=n,links=False);p=d[0];before=words(p)
 saved=[s for s in spans(p) if region.intersects(fitz.Rect(s['bbox']))]
 assert all((region+(-.3,-.3,.3,.3)).contains(fitz.Rect(s['bbox'])) for s in saved),(n,'Partial figure text')
 # Source extraction preserves each original label's semantic reading order;
 # sorting spans geometrically interleaves a parent with unrelated branches.
 labels=' '.join(s['text'] for s in saved)
 label_h=len(S.wrap(labels,region.width,8.8,'body'))*12+10 if labels else 0
 target=max(region.height,170+label_h);gap=target-region.height
 p.add_redact_annot(region,fill=(1,1,1));p.apply_redactions(images=2,graphics=2,text=0)
 # Discard the old illustration content, rather than covering selectable text.
 if gap>1:
  cut=region.y1+1;top,bottom=C.split_page(d,0,cut);qdoc=fitz.open();q=qdoc.new_page(width=p.rect.width,height=p.rect.height+gap)
  q.show_pdf_page(fitz.Rect(0,0,p.rect.width,cut),top,0,clip=fitz.Rect(0,0,p.rect.width,cut),keep_proportion=False)
  q.show_pdf_page(fitz.Rect(0,cut+gap,p.rect.width,p.rect.height+gap),bottom,0,clip=fitz.Rect(0,cut,p.rect.width,p.rect.height),keep_proportion=False);d=qdoc;p=d[0]
 else:cut=region.y1+1;gap=0
 art_rect=fitz.Rect(region.x0,region.y0,region.x1,region.y0+target-label_h-4);put_art(p,key,art_rect)
 if labels:
  p.insert_font(fontname='Studybody',fontfile=str(S.fonts['body']));S.text(p,labels,region.x0,art_rect.y1+5,region.width,8.8,'body',S.SAGE,12)
 assert words(p)==before,(n+1,'Figure text changed',before-words(p),words(p)-before)
 return d,(cut,gap)

def unbox_steps(d,region):
 p=d[0];before=words(p);saved=[s for s in spans(p) if region.contains(fitz.Rect(s['bbox']))]
 p.add_redact_annot(region,fill=(1,1,1));p.apply_redactions(images=0,graphics=2,text=0)
 for s in saved:
  font='hebo' if s['flags']&16 or 'Bold' in s['font'] else 'helv';p.insert_text(s['origin'],s['text'],fontname=font,fontsize=s['size'],color=S.rgb(S.SAGE if s['text'] in ['01','02','03'] else S.INK))
 assert words(p)==before

def build(b):
 slug=b['slug'];base=fitz.open(BASE/b['file']);current=fitz.open(CURRENT/b['file']);out=fitz.open();used=defaultdict(int);details=[];shifts={};replaced=set()
 for i,p in enumerate(base):
  n=i+1;key=choose(p,slug,n,used)
  if i==0 or slug=='art-of-attention' and n==6:
   out.insert_pdf(current,from_page=i,to_page=i,links=False);details.append({'page':n,'mode':'approved cover' if i==0 else 'approved character artwork'});continue
  if slug in chapters and n in range(4,20,2):
   tmp=new_reading(chapters[slug],chapters[slug]['chapters'][(n-4)//2],n,key);out.insert_pdf(tmp,links=False);used[key]+=1;replaced.add(n);details.append({'page':n,'mode':'complete artwork reading page','scene':key});continue
  entry=regions.get(slug,{}).get(n);region=None
  if slug not in chapters:
   if slug in ['life-secrets','art-of-attention','lead-without-the-noise','man-and-people'] and C.reading_page(p,slug):region=header_slot(p)
   if region is None and entry and entry['kind']=='diagram':region=fitz.Rect(entry['bounds'])
  if region is not None:
   tmp,shift=replace_figure(base,i,region,key);out.insert_pdf(tmp,links=False);used[key]+=1;shifts[i]=shift;replaced.add(n);details.append({'page':n,'mode':'artwork replaces diagram or old scene','scene':key,'bounds':list(region),'cut':shift[0],'addedHeight':shift[1]});continue
  if entry and entry['kind']=='steps':
   # Keep the practical steps as unboxed coloured margin notes.
   tmp=fitz.open();tmp.insert_pdf(current,from_page=i,to_page=i,links=False)
   old_detail=CURRENT/b['file']
   prior=next(x for x in json.loads((R/'private/character-collection'/f'{slug}-report.json').read_text())['details'] if x['page']==n)
   r=fitz.Rect(entry['bounds']);cut=prior.get('cut',float('inf'));gap=prior.get('addedHeight',0)
   if r.y0>=cut:r+=fitz.Rect(0,gap,0,gap)
   unbox_steps(tmp,r);out.insert_pdf(tmp,links=False);details.append({'page':n,'mode':'unboxed practical margin notes','scene':prior.get('scene')});continue
  out.insert_pdf(current,from_page=i,to_page=i,links=False);prior=next(x for x in json.loads((R/'private/character-collection'/f'{slug}-report.json').read_text())['details'] if x['page']==n);details.append({'page':n,'mode':'retained approved artwork or practical reading page',**({'scene':prior['scene']} if 'scene' in prior else {})})
 # Links are restored per-page from the unchanged current edition, except pages
 # reconstructed from the pre-character source, where their original coordinates apply.
 for i,p in enumerate(out):
  for a in list(p.get_links()):p.delete_link(a)
  origin=base if i in shifts else current
  for a in origin[i].get_links():
   item={k:a[k] for k in ['kind','from','uri','page','to','zoom','file','nameddest'] if k in a}
   if a['kind']==fitz.LINK_NAMED and str(a.get('page','')).isdigit() and 'nameddest' not in a:item={'kind':fitz.LINK_GOTO,'from':a['from'],'page':int(a['page'])-1,'to':fitz.Point(0,0)}
   if i in shifts:
    cut,gap=shifts[i];r=fitz.Rect(item['from'])
    if r.y0>=cut:r+=fitz.Rect(0,gap,0,gap)
    item['from']=r
   p.insert_link(item)
 # Redaction can materialise legacy PNG masks. Optimise them before encryption,
 # then restore the exact approved cover and Attention proof from the baseline.
 out.rewrite_images(dpi_threshold=180,dpi_target=144,quality=78,lossy=True,lossless=True,bitonal=False,color=True,gray=True)
 keep=[0]+([5] if slug=='art-of-attention' else [])
 for i in reversed(keep):out.delete_page(i);out.insert_pdf(current,from_page=i,to_page=i,start_at=i,links=False)
 out.set_metadata(current.metadata);out.set_toc(current.get_toc());out.subset_fonts();dest=OUT/b['file'];out.save(dest,garbage=4,clean=True,deflate=True)
 check=fitz.open(dest);assert len(check)==len(current);assert check[0].get_pixmap().samples==current[0].get_pixmap().samples
 for i,p in enumerate(check):
  if not(slug in chapters and i+1 in range(4,20,2)):assert words(p)==words(current[i]),(slug,i+1,'Original text changed',words(current[i])-words(p),words(p)-words(current[i]))
  for s in spans(p):assert (p.rect+(-1,-1,1,1)).contains(fitz.Rect(s['bbox'])),(slug,i+1,'Overflow',s['text'])
 sample=fitz.open()
 for info in actual[slug]:sample.insert_pdf(check,from_page=info['page']-1,to_page=info['page']-1,links=False)
 sample_name=b['file'].replace('.pdf','-sample.pdf');sample.set_metadata({'title':current.metadata.get('title','OPortals')+' — Three-page sample','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});sample.subset_fonts();sample.save(OUT/sample_name,garbage=4,deflate=True)
 candidates={MEDIA/x['src'].split('/')[-1]:x['page'] for x in actual[slug] if x['page']>1}
 for path in MEDIA.glob('*.webp'):
  m=re.fullmatch(r'(?:editorial-|testing-collection-)?(?:'+re.escape(slug)+'|'+re.escape(b['file'][:-4])+r')-page-(\d+)\.webp',path.name)
  if m and 1<int(m[1])<=len(check):candidates[path]=int(m[1])
 for path,n in candidates.items():
  width=Image.open(path).width if path.exists() else 630;page=check[n-1];pix=page.get_pixmap(matrix=fitz.Matrix(width/page.rect.width,width/page.rect.width),alpha=False);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(path,'WEBP',quality=88,method=6)
 scene_counts={k:v for k,v in used.items() if v}
 report={'slug':slug,'file':b['file'],'pages':len(check),'replacedPages':sorted(replaced),'details':details,'scenesUsed':scene_counts,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sampleSha256':hashlib.sha256((OUT/sample_name).read_bytes()).hexdigest(),'samplePageCount':3,'bytes':dest.stat().st_size}
 print(slug,len(replaced),'artwork replacements;',len(scene_counts),'distinct new compositions;',round(dest.stat().st_size/1024),'KiB',flush=True);return report

if __name__=='__main__':
 only=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--only=')),None);reports=[build(b) for b in manifest if not only or b['slug']==only]
 if not only:
  (OUT/'verification-report.json').write_text(json.dumps(reports,indent=2));jobs=[]
  for b in reports:jobs.extend([{'name':b['file'],'path':str((OUT/b['file']).relative_to(R))},{'name':b['file'].replace('.pdf','-sample.pdf'),'path':str((OUT/b['file'].replace('.pdf','-sample.pdf')).relative_to(R)),'pageCount':3}])
  (OUT/'encryption-jobs.json').write_text(json.dumps(jobs,indent=2));(R/'brand/artwork-edition/manifest.json').write_text(json.dumps(MASTER,indent=2))
