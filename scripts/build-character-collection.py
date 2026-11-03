"""Apply the approved recurring character to all Testing book illustrations.

Existing wording, covers, functional diagrams and page numbers are authoritative.
New illustrated reading pages keep selectable vector text. Reflection sheets,
references and contents remain practical. Published snapshots are never written.
"""
from pathlib import Path
from collections import Counter,defaultdict
from io import BytesIO
import fitz,json,re,sys,hashlib
from PIL import Image
R=Path(__file__).resolve().parents[1];BASE=R/'private/checkpoints/before-character-collection';OUT=R/'private/character-collection';MEDIA=R/'public/editorial-media'
rows=json.loads((BASE/'manifest.json').read_text());site=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(site.split('const actualPages=',1)[1])[0]
ART=json.loads((R/'brand/character-scenes/manifest.json').read_text());artbytes={k:(OUT/(k+'.jpg')).read_bytes() for k in ART}
ARTDOC={};ARTCLIP={};PLANS=json.loads((R/'brand/character-scenes/book-page-scenes.json').read_text())
for key,data in artbytes.items():
 im=Image.open(BytesIO(data)).convert('RGB');w,h=im.size;mask=im.point(lambda x:0 if x>232 else 255).convert('L');bounds=mask.getbbox() or (0,0,w,h);pad=18
 x0,y0,x1,y1=bounds;clip=fitz.Rect(max(0,x0-pad),max(0,y0-pad),min(w,x1+pad),min(h,y1+pad))
 d=fitz.open();p=d.new_page(width=w,height=h);p.insert_image(p.rect,stream=data);ARTDOC[key]=d;ARTCLIP[key]=clip
# Clip only the unused white canvas at PDF layout time; generated masters stay intact.
def put_art(page,key,rect):page.show_pdf_page(rect,ARTDOC[key],0,clip=ARTCLIP[key],keep_proportion=True)
OWN={'life-secrets':'life','art-of-attention':'room','the-philosopher-manager':'manager','lead-without-the-noise':'lead','time-for-what-matters':'time','stand-out-for-something':'stand','the-space-before-yes':'boundaries','think-again-gently':'revision','the-quiet-art-of-enough':'enough','when-life-changes':'change','man-and-people':'people','meditations-reimagined':'meditations','epictetus-a-freer-mind':'epictetus','epicurus-the-art-of-enough':'epicurus','plato-the-examined-life':'plato','aristotle-a-life-of-character':'aristotle','seneca-on-the-shortness-of-life':'seneca'}
KEYWORDS={'life':'purpose meaning life grow choice question energy','room':'attention notice detail world present light familiar','manager':'delegate responsibility decision system outcome escalation handover','lead':'listen leadership account pressure meeting team trust','time':'calendar time priority urgency task interruption return rhythm','stand':'useful work contribution credit recognition praise impact visible','boundaries':'boundary limit yes no request promise capacity agreement availability','revision':'belief verdict fact evidence certainty explanation revision change mind','enough':'enough more comparison maintenance stopping quantity enjoy','change':'change transition role mixed anchor experiment next circumstance','meditations':'day morning impression humanity larger return practice conduct','epictetus':'control possess direction freedom approval responsibility impression','epicurus':'pleasure disturbance consequence desire fear friendship security simple','plato':'examine question reputation account reason ignorance certainty appearance','aristotle':'character proportionate habit repetition mean flourishing act reasons','seneca':'busyness postpone rest memory mortality finite reading arrangement','people':'person people greeting custom social reply meaning expression shared','mirror':'perspective self worth identity view observe other description'}
NEGATIVE=['route through','find your question','page for your own','six questions','read beyond','go beyond the diagram','reusable reflection','reading references','reading map','bring it into your day','small experiments','week of','complicate the plan','one situation.','return sentence','charter','inventory','field guide','worksheet','your own experiment','questions to revisit']
def words(p):return Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def title(p):return ' '.join(s['text'] for s in spans(p) if s['size']>=17 and 40<s['bbox'][1]<min(270,p.rect.height*.48) and s['text'] not in ['≠','→','?','+','=']).strip()
def blocks(p):return [fitz.Rect(b[:4]) for b in p.get_text('blocks') if b[6]==0 and b[4].strip()]
def overlap(rect,text):return any(rect.intersects(fitz.Rect(s['bbox'])) for s in text if s['text'].strip())
def scene_for(p,slug,used,last):
 if str(p.number+1) in PLANS.get(slug,{}):return PLANS[slug][str(p.number+1)]
 head=title(p).lower();body=p.get_text().lower();scores={}
 for key,terms in KEYWORDS.items():
  score=sum((3 if re.search(r'\b'+re.escape(t)+r'\w*\b',head) else 0)+(0.4 if re.search(r'\b'+re.escape(t)+r'\w*\b',body) else 0) for t in terms.split())
  score+=(2.5 if key==OWN[slug] else 0)-used[key]*2.5-(7 if last==key else 0)
  if key==OWN[slug] and p.number==1:score+=14
  if slug=='art-of-attention' and p.number==4 and key=='room':score-=30
  scores[key]=score
 return max(scores,key=scores.get)
def raster_slot(p):
 images=[fitz.Rect(i['bbox'])&p.rect for i in p.get_image_info() if i['width']>100 and i['height']>60]
 images=[r for r in images if r.width>=130 and r.height>=55 and r.y1>80 and r.y0<p.rect.height-45]
 if not images:return None
 ss=spans(p);head=[s for s in ss if s['size']>=17 and 40<s['bbox'][1]<270];top=max([fitz.Rect(s['bbox']).y1 for s in head]or[70])+5
 best=None
 for x0,x1 in [(30,p.rect.width-30),(30,308)]:
  occupied=sorted((max(top,s['bbox'][1]-3),min(p.rect.height-45,s['bbox'][3]+3)) for s in ss if s['text'].strip() and s['bbox'][0]<x1 and s['bbox'][2]>x0 and s['bbox'][3]>top and s['bbox'][1]<p.rect.height-45)
  merged=[]
  for a,b in occupied:
   if b<=a:continue
   if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
   else:merged.append((a,b))
  prev=top
  for a,b in merged+[(p.rect.height-45,p.rect.height-45)]:
   r=fitz.Rect(x0,prev+2,x1,a-2)
   if r.height>=64 and any((r&i).get_area()>min(r.get_area(),i.get_area())*.35 for i in images) and not overlap(r,ss):
    score=r.get_area()
    if best is None or score>best[0]:best=(score,r)
   prev=max(prev,b)
 return best[1] if best else None

def reading_page(p,slug):
 n=p.number+1;head=title(p).lower()
 if not head or len(p.get_text().split())<65:return False
 if any(t in head for t in NEGATIVE):return False
 if slug in ['the-philosopher-manager','time-for-what-matters','stand-out-for-something']:return n in [2,3] or 5<=n<=20
 if len(p.parent)==22:return n==2 or n in range(4,20,2)
 if slug=='life-secrets':return 2<=n<=28 and n not in [3,4]
 if slug=='art-of-attention':return 2<=n<=28 and n not in [3,4,8,12,16,20,24,27]
 if slug=='lead-without-the-noise':return 2<=n<=20 and n!=4
 if slug=='man-and-people':return 2<=n<=38 and n not in [3,4,10,16,22,28,34,38]
 return False

def safe_cut(p):
 ss=spans(p);heads=[fitz.Rect(s['bbox']) for s in ss if s['size']>=17 and 40<s['bbox'][1]<min(270,p.rect.height*.48) and s['text'] not in ['≠','→','?','+','=']]
 if not heads:return None
 occupied=blocks(p);text_occupied=list(occupied);pix=p.get_pixmap(alpha=False)
 def visible(d):
  col=d.get('color') or d.get('fill')
  if not col or min(col)>.97:return False
  target=tuple(round(v*255) for v in col);r=d['rect'];hits=0
  for fx,fy in [(0,.5),(1,.5),(.5,0),(.5,1),(.2,.2),(.8,.2),(.2,.8),(.8,.8),(.5,.5)]:
   x=int(r.x0+r.width*fx);y=int(r.y0+r.height*fy)
   for dx,dy in [(0,0),(-1,0),(1,0),(0,-1),(0,1)]:
    xx,yy=x+dx,y+dy
    if 0<=xx<pix.width and 0<=yy<pix.height and max(abs(pix.pixel(xx,yy)[i]-target[i]) for i in range(3))<=18:
     hits+=1;break
  return hits>=2
 for d in p.get_drawings():
  r=d['rect'];fill=d.get('fill');col=d.get('color')
  if r.height>4 and r.width<p.rect.width*.99 and r.y0>=40 and r.y1<p.rect.height-34 and visible(d):occupied.append(r)
 for image in p.get_image_info():
  r=fitz.Rect(image['bbox'])&p.rect
  if r.get_area() and r.y0>=40 and r.y1<p.rect.height-34:occupied.append(r)
 y=max(r.y1 for r in heads)+9
 for _ in range(100):
  crossing=[r for r in occupied if r.y0-.8<y<r.y1+.8]
  if not crossing:
   if y<p.rect.height-42:return y
   break
  y=max(r.y1 for r in crossing)+7
 # The header-to-title gap is safe when a full-width sidebar makes the first
 # choice impossible. This keeps complete paragraphs and diagrams together.
 for y in [49,50,51,52,53,54]:
  if not any(r.y0-.8<y<r.y1+.8 for r in text_occupied):return y
 return None

def split_page(source,n,cut):
 top=fitz.open();top.insert_pdf(source,from_page=n,to_page=n,links=False)
 bottom=fitz.open();bottom.insert_pdf(source,from_page=n,to_page=n,links=False)
 for doc,r in [(top,fitz.Rect(0,cut,source[n].rect.width,source[n].rect.height)),(bottom,fitz.Rect(0,0,source[n].rect.width,cut))]:
  p=doc[0];p.add_redact_annot(r,fill=False);p.apply_redactions(images=1,graphics=1,text=0)
 assert words(top[0])+words(bottom[0])==words(source[n]),(n+1,'Split must preserve all words')
 return top,bottom

def restore_links(out,base,shifts):
 for i,p in enumerate(out):
  for a in list(p.get_links()):p.delete_link(a)
  for a in base[i].get_links():
   item={k:a[k] for k in ['kind','from','uri','page','to','zoom','file','nameddest'] if k in a};r=fitz.Rect(item['from']);cut,gap=shifts.get(i,(float('inf'),0))
   if r.y0>=cut:r+=fitz.Rect(0,gap,0,gap)
   elif r.y1>cut:raise AssertionError((i+1,'Link crosses inserted illustration'))
   item['from']=r
   # MuPDF exposes legacy /Fit page destinations as numeric named links.
   # Preserve their real destination as an explicit page link.
   if a['kind']==fitz.LINK_NAMED and str(a.get('page','')).isdigit() and 'nameddest' not in a:
    item={'kind':fitz.LINK_GOTO,'from':r,'page':int(a['page'])-1,'to':fitz.Point(0,0)}
   if item['kind']==fitz.LINK_GOTO and isinstance(a.get('page'),int) and a['page']>=0 and 'to' in item:
    target=fitz.Point(item['to']);tc,tg=shifts.get(a['page'],(float('inf'),0))
    if target.y>=tc:target.y+=tg
    item['to']=target
   p.insert_link(item)

def build(b):
 slug=b['slug'];base=fitz.open(BASE/b['file']);work=fitz.open(BASE/b['file']);out=fitz.open();used=defaultdict(int);last=None;details=[];shifts={}
 for n,p in enumerate(work):
  if n==0 or slug=='art-of-attention' and n==5:
   out.insert_pdf(work,from_page=n,to_page=n,links=False);details.append({'page':n+1,'mode':'approved cover' if not n else 'approved character proof'});continue
  slot=raster_slot(p);eligible=reading_page(p,slug)
  if not slot and not eligible:
   out.insert_pdf(work,from_page=n,to_page=n,links=False);details.append({'page':n+1,'mode':'reading aid / worksheet retained'});continue
  key=scene_for(p,slug,used,last);used[key]+=1;last=key
  if slot:
   before=words(p);p.add_redact_annot(slot,fill=(1,1,1));p.apply_redactions(images=1,graphics=0,text=1);p.draw_rect(slot,color=None,fill=(1,1,1),overlay=True);put_art(p,key,slot);assert words(p)==before,(slug,n+1,'raster replacement words')
   out.insert_pdf(work,from_page=n,to_page=n,links=False);details.append({'page':n+1,'mode':'character scene replaces artwork','scene':key,'bounds':list(slot)});continue
  cut=safe_cut(p)
  if cut is None:raise AssertionError((slug,n+1,'No safe illustration boundary'))
  top,bottom=split_page(work,n,cut);W,H=p.rect.width,p.rect.height;gap=142
  q=out.new_page(width=W,height=H+gap);q.show_pdf_page(fitz.Rect(0,0,W,cut),top,0,clip=fitz.Rect(0,0,W,cut),keep_proportion=False);q.show_pdf_page(fitz.Rect(0,cut+gap,W,H+gap),bottom,0,clip=fitz.Rect(0,cut,W,H),keep_proportion=False);put_art(q,key,fitz.Rect(30,cut+8,W-30,cut+gap-8))
  assert words(q)==words(base[n]),(slug,n+1,'Composed words',words(base[n])-words(q),words(q)-words(base[n]))
  shifts[n]=(cut,gap);details.append({'page':n+1,'mode':'character scene with original native diagram/text','scene':key,'cut':cut,'addedHeight':gap})
 assert len(out)==len(base)
 # Optimise placed raster art for digital reading. The exact approved covers
 # and proof page are restored afterwards; all text/diagrams stay native vectors.
 out.rewrite_images(dpi_threshold=180,dpi_target=144,quality=80,lossy=True,lossless=True,bitonal=False,color=True,gray=True)
 keep=[0]+([5] if slug=='art-of-attention' else [])
 for i in reversed(keep):out.delete_page(i);out.insert_pdf(base,from_page=i,to_page=i,start_at=i,links=False)
 restore_links(out,base,shifts);out.set_metadata(base.metadata);dest=OUT/b['file'];out.save(dest,garbage=4,clean=True,deflate=True);check=fitz.open(dest);base=fitz.open(BASE/b['file'])
 for i,p in enumerate(check):
  assert words(p)==words(base[i]),(slug,i+1,'Saved word preservation')
  for s in spans(p):
   if not (p.rect+fitz.Rect(-1,-1,1,1)).contains(fitz.Rect(s['bbox'])):raise AssertionError((slug,i+1,'Text outside page',s['text']))
 assert check[0].get_pixmap().samples==base[0].get_pixmap().samples,(slug,'Cover changed')
 # The approved proof is compared in a fresh rendering process by final QA;
 # image rewriting can leave shared decoded-image cache entries in this process.
 assert sum(len(p.get_links()) for p in check)==sum(len(p.get_links()) for p in base),(slug,'Links changed')
 sample=fitz.open()
 for info in actual[slug]:sample.insert_pdf(check,from_page=info['page']-1,to_page=info['page']-1,links=False)
 assert len(sample)==3;sample.set_metadata({'title':b['slug'].replace('-',' ').title()+' — Three-page sample','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});sample.subset_fonts();sample_name=b['file'][:-4]+'-sample.pdf';sample.save(OUT/sample_name,garbage=4,deflate=True)
 samplesaved=fitz.open(OUT/sample_name)
 for i,info in enumerate(actual[slug]):assert words(samplesaved[i])==words(check[info['page']-1]) and samplesaved[i].rect==check[info['page']-1].rect
 # Update actual preview images, including earlier image URLs still in use.
 candidates={MEDIA/x['src'].split('/')[-1]:x['page'] for x in actual[slug] if x['page']>1}
 for path in MEDIA.glob('*.webp'):
  m=re.fullmatch(r'(?:editorial-|testing-collection-)?(?:'+re.escape(slug)+'|'+re.escape(b['file'][:-4])+r')-page-(\d+)\.webp',path.name)
  if m and 1<int(m[1])<=len(check):candidates[path]=int(m[1])
 for path,n in candidates.items():
  width=Image.open(path).width if path.exists() else 630;p=check[n-1];pix=p.get_pixmap(matrix=fitz.Matrix(width/p.rect.width,width/p.rect.width),alpha=False);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(path,'WEBP',quality=88,method=6)
 changed=[d['page'] for d in details if 'scene' in d];assert len(changed)>=6,(slug,'Not enough illustrated pages',changed)
 report={'slug':slug,'file':b['file'],'pages':len(check),'illustratedPages':changed,'scenesUsed':dict(used),'details':details,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sampleSha256':hashlib.sha256((OUT/sample_name).read_bytes()).hexdigest(),'bytes':dest.stat().st_size,'samplePageCount':3}
 (OUT/(slug+'-report.json')).write_text(json.dumps(report,indent=2));print(slug,len(changed),'illustrated pages',round(dest.stat().st_size/1024),'KiB',flush=True);return report

if __name__=='__main__':
 only=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--only=')),None);reports=[build(b) for b in rows if not only or b['slug']==only]
 if not only:
  jobs=[]
  for b in reports:jobs.extend([{'name':b['file'],'path':str((OUT/b['file']).relative_to(R))},{'name':b['file'][:-4]+'-sample.pdf','path':str((OUT/(b['file'][:-4]+'-sample.pdf')).relative_to(R)),'pageCount':3}])
  (OUT/'encryption-jobs.json').write_text(json.dumps(jobs,indent=2));(OUT/'verification-report.json').write_text(json.dumps(reports,indent=2));print('All 17 Testing books and their true three-page samples prepared.',flush=True)
