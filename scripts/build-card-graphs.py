"""Professional graph cards and reflection panels, derived from the existing PDFs.
Preserves wording, illustrations, covers, pagination and links. Testing edition only.
"""
from pathlib import Path
from io import BytesIO
from collections import Counter
import json,re,hashlib
import fitz
R=Path(__file__).resolve().parents[1];SRC=R/'private/checkpoints/before-graph-cards';ORIGINAL=R/'private/books';OUT=R/'private/publishing-preview';DELIVERY=Path('/workspace/outputs/OPortals-Graph-Edition');DELIVERY.mkdir(exist_ok=True)
STEMS=['art-of-attention','life-secrets','man-and-people-guide','lead-without-the-noise','sneakpeak-ideas']
TITLES={'art-of-attention':'The Art of Attention','life-secrets':'Life Secrets','man-and-people-guide':'Man and People','lead-without-the-noise':'Lead Without the Noise','sneakpeak-ideas':'SneakPeak Ideas'}
FONTROOT=Path('/usr/share/fonts/truetype/dejavu');FONTFILES={'Body':FONTROOT/'DejaVuSans.ttf','Bold':FONTROOT/'DejaVuSans-Bold.ttf','Serif':FONTROOT/'DejaVuSerif.ttf','Italic':FONTROOT/'DejaVuSerif-Italic.ttf'}
INK='#30382b';OLIVE='#68734b';BORDER='#d7decf';PAPER='#f6f7f1'
EXCLUDED={'art-of-attention':{5,9,13,17,21,25},'life-secrets':{5,9,13,17,21,25},'man-and-people-guide':{5,11,17,23,29,35},'lead-without-the-noise':{5,7,9,10,13,17}}
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def words(p):return Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def font(page,kind):
 name='OPGraph'+kind;page.insert_font(fontname=name,fontfile=str(FONTFILES[kind]));return name
def card(page,r,fill=None):
 try:page.draw_rect(r,color=rgb(BORDER),fill=rgb(fill) if fill else None,width=.65,radius=.065,overlay=True)
 except TypeError:page.draw_rect(r,color=rgb(BORDER),fill=rgb(fill) if fill else None,width=.65,overlay=True)
def put(page,text,rect,size=9.4,bold=False,color=INK,align=0):
 result=page.insert_textbox(rect,text,fontname=font(page,'Bold' if bold else 'Body'),fontsize=size,lineheight=1.3,color=rgb(color),align=align)
 if result<0:raise ValueError('Card label does not fit: '+repr(text)+' '+str(rect))
def arrow(page,a,b):
 page.draw_line(a,b,color=rgb(OLIVE),width=.7)
 # Arrow is a vector shape, not a text glyph.
 import math
 angle=math.atan2(b.y-a.y,b.x-a.x);length=3
 page.draw_polyline([fitz.Point(b.x-length*math.cos(angle-.55),b.y-length*math.sin(angle-.55)),b,fitz.Point(b.x-length*math.cos(angle+.55),b.y-length*math.sin(angle+.55))],color=rgb(OLIVE),width=.7)
def reinsert(page,ss):
 for s in ss:
  kind='Italic' if 'Italic' in s['font'] else 'Serif' if 'Serif' in s['font'] else 'Bold' if ('Bold' in s['font'] or s['flags']&16) else 'Body'
  color=((s['color']>>16&255)/255,(s['color']>>8&255)/255,(s['color']&255)/255)
  page.insert_text(s['origin'],s['text'],fontname=font(page,kind),fontsize=s['size'],color=color)
def sidebar(page):
 ss=spans(page)
 if not any(s['text']=='IN AN ORDINARY LIFE' for s in ss):return 0
 nums=sorted([s for s in ss if s['text'] in ['01','02','03'] and s['bbox'][0]>=247 and s['bbox'][1]<450],key=lambda s:s['bbox'][1])
 if len(nums)!=3:raise ValueError('Missing three sidebar steps')
 start=nums[0]['bbox'][1]-10;zone=fitz.Rect(247,start-2,390,nums[-1]['bbox'][1]+54);labels=[s for s in ss if zone.contains(fitz.Rect(s['bbox']))]
 if len(nums)!=3:raise ValueError('Missing sidebar step numbers on page '+str(page.number+1)+' '+repr([(s['text'],s['bbox']) for s in ss if s['text'] in ['01','02','03']]))
 groups=[]
 for i,num in enumerate(nums):
  hi=nums[i+1]['bbox'][1] if i<2 else zone.y1
  group=[s for s in labels if s['bbox'][1]>num['bbox'][1]+2 and s['bbox'][1]<hi]
  groups.append(' '.join(s['text'] for s in sorted(group,key=lambda s:(s['bbox'][1],s['bbox'][0]))))
 before=words(page);page.add_redact_annot(zone,fill=False);page.apply_redactions(images=0,graphics=2)
 for i,tx in enumerate(groups):
  r=fitz.Rect(251,start+i*68,386,start+56+i*68);card(page,r,PAPER)
  put(page,str(i+1).zfill(2),fitz.Rect(r.x0+10,r.y0+7,r.x1-10,r.y0+21),7.5,True,OLIVE)
  put(page,tx,fitz.Rect(r.x0+10,r.y0+23,r.x1-10,r.y1-5),8.8,True)
  if i<2:arrow(page,fitz.Point(318.5,r.y1+3),fitz.Point(318.5,r.y1+9))
 if before!=words(page):raise ValueError('Sidebar text changed')
 return 3

def selection_graph(page,number):
 zone=fitz.Rect(34,285,386,377) if number==6 else fitz.Rect(34,196,386,322)
 if any(fitz.Rect(x['bbox']).intersects(zone) for x in page.get_image_info()):raise ValueError('Selection graph overlaps an illustration')
 ss=[s for s in spans(page) if zone.contains(fitz.Rect(s['bbox']))]
 original=' '.join(s['text'] for s in sorted(ss,key=lambda s:(s['bbox'][1],s['bbox'][0])))
 labels=['Many details in view','A selected detail','The experience you notice'] if number==6 else ['What demands notice','What quietly matters','Choose where to look']
 assert Counter(re.findall(r'\w+',original))==Counter(re.findall(r'\w+',' '.join(labels)))
 before=words(page);page.add_redact_annot(zone,fill=False);page.apply_redactions(images=0,graphics=2)
 width=(352-28)/3;top=zone.y0+(zone.height-64)/2
 for i,tx in enumerate(labels):
  r=fitz.Rect(34+i*(width+14),top,34+i*(width+14)+width,top+64);card(page,r,PAPER)
  put(page,tx,fitz.Rect(r.x0+9,r.y0+14,r.x1-9,r.y1-8),9.4,True,align=1)
  if i<2:arrow(page,fitz.Point(r.x1+3,(r.y0+r.y1)/2),fitz.Point(r.x1+11,(r.y0+r.y1)/2))
 assert words(page)==before,'Selection wording changed'
 return 3

def candidate_rectangles(original):
 boxes=[]
 for dr in original.get_drawings():
  r=dr['rect'];f=dr.get('fill');items=dr['items']
  if not(f and min(f)>.60 and max(f)-min(f)>.035 and 35<r.width<390 and 16<r.height<245 and r.x0>=30 and r.x1<=390):continue
  # Filled rectangles or rounded rectangular containers, not circles or semantic shapes.
  if not(any(x[0]=='re' for x in items) or (sum(x[0]=='c' for x in items)>=4 and sum(x[0]=='l' for x in items)>=3)):continue
  if not any(all(abs(a-b)<.2 for a,b in zip(r,old)) for old in boxes):boxes.append(r)
 return [r for r in boxes if not any(o!=r and o.contains(r) and o.get_area()>r.get_area()+1 for o in boxes)]
def frame_graphs(page,original,skip_sidebar=False):
 count=0
 for r in candidate_rectangles(original):
  if skip_sidebar and r.x0>=247 and r.y0<425:continue
  if any(fitz.Rect(x['bbox']).intersects(r) for x in page.get_image_info()):continue
  ss=[s for s in spans(page) if fitz.Rect(s['bbox']).intersects(r)]
  partial=any(not r.contains(fitz.Rect(s['bbox'])) for s in ss)
  meaningful=False
  for dr in page.get_drawings():
   rr=dr['rect']
   if rr.get_area()<1 or not r.contains(rr):continue
   same=all(abs(a-b)<1 for a,b in zip(rr,r))
   f=dr.get('fill')
   if not same and ((f and min(f)<.93) or (dr.get('color') and not f)):meaningful=True
  if ss and not partial and not meaningful:
   before=words(page);page.add_redact_annot(r,fill=False);page.apply_redactions(images=0,graphics=2);card(page,r,PAPER);reinsert(page,ss)
   if words(page)!=before:raise ValueError('Graph label changed')
  else:card(page,r)
  count+=1
 return count

def reflection(page):
 ss=spans(page);H=page.rect.height
 markers=[s for s in ss if s['bbox'][1]>H*.60 and ('TAKE THIS INTO YOUR DAY' in s['text'] or ('QUESTION' in s['text'] and ('DAY' in s['text'] or 'KEEP' in s['text'])))]
 if not markers:return 0
 marker=min(markers,key=lambda s:s['bbox'][1]);body=sorted([s for s in ss if s['bbox'][1]>marker['bbox'][3] and s['bbox'][1]<H-38 and s['size']>=8],key=lambda s:(s['bbox'][1],s['bbox'][0]))
 if not body:return 0
 tx=' '.join(s['text'] for s in body);last=max(s['bbox'][3] for s in body);prior=max([s['bbox'][3] for s in ss if s not in body and s is not marker and s['bbox'][3]<marker['bbox'][1]] or [0]);top=max(marker['bbox'][1]-14,prior+8)
 needed=200-page.new_shape().insert_textbox(fitz.Rect(44,0,376,200),tx,fontname=font(page,'Body'),fontsize=9.2,lineheight=1.3)
 bottom=top+max(56,needed+38)
 footer=min([s['bbox'][1] for s in ss if s['bbox'][1]>last+3 and s['size']<8] or [H-24]);limit=footer-8
 if bottom>limit:raise ValueError('Reflection needs a tighter layout on page '+str(page.number+1)+' '+repr(tx))
 r=fitz.Rect(34,top,386,bottom);zone=fitz.Rect(33,top-5,387,bottom+2)
 # Do not cover anything outside the prompt, including the page footer.
 for s in ss:
  sr=fitz.Rect(s['bbox'])
  if sr.intersects(zone) and s not in body and s is not marker:raise ValueError('Prompt boundary would overlap other text on page '+str(page.number+1)+' '+s['text']+' '+str(zone)+' '+str(sr))
 before=words(page);page.add_redact_annot(zone,fill=False);page.apply_redactions(images=0,graphics=2);card(page,r,PAPER)
 put(page,marker['text'],fitz.Rect(44,top+8,376,top+20),7.2,True,OLIVE)
 target=fitz.Rect(44,top+25,376,bottom-8)
 size=9.2
 put(page,tx,target,size,False,INK)
 if words(page)!=before:raise ValueError('Reflection text changed on page '+str(page.number+1)+' removed='+repr(before-words(page))+' added='+repr(words(page)-before)+' '+repr(tx))
 return 1

def restore_links(doc,source):
 for n in range(1,len(doc)):
  existing={tuple(round(v,2) for v in x['from']) for x in doc[n].get_links()}
  for x in source[n].get_links():
   if tuple(round(v,2) for v in x['from']) in existing:continue
   if x['kind']==fitz.LINK_URI:doc[n].insert_link({'kind':fitz.LINK_URI,'from':x['from'],'uri':x['uri']})
   elif str(x.get('page','')).isdigit():doc[n].insert_link({'kind':fitz.LINK_GOTO,'from':x['from'],'page':int(x['page'])-1 if isinstance(x['page'],str) else x['page'],'to':fitz.Point(0,0)})
reports=[]
for stem in STEMS[:4]:
 source=fitz.open(SRC/(stem+'.pdf'));original=fitz.open(ORIGINAL/(stem+'.pdf'));doc=fitz.open(SRC/(stem+'.pdf'));counts={'graphCards':0,'sidebarCards':0,'reflectionCards':0}
 for n in range(1,len(doc)):
  page=doc[n];before=words(page)
  special=stem=='art-of-attention' and n+1 in [6,26]
  if special:counts['graphCards']+=selection_graph(page,n+1)
  elif n+1 not in EXCLUDED[stem]:
   is_sidebar=stem=='life-secrets' and any(s['text']=='IN AN ORDINARY LIFE' for s in spans(page))
   if is_sidebar:counts['sidebarCards']+=sidebar(page)
   counts['graphCards']+=frame_graphs(page,original[n],is_sidebar)
  counts['reflectionCards']+=reflection(page)
  if before!=words(page):raise ValueError('Interior words changed '+stem+' '+str(n+1))
 restore_links(doc,source);out=OUT/(stem+'.pdf');doc.subset_fonts();doc.save(out,garbage=4,clean=True,deflate=True);doc.close();current=fitz.open(out)
 assert current[0].get_pixmap().samples==source[0].get_pixmap().samples,'Cover changed'
 for n in range(1,len(current)):
  assert words(current[n])==words(source[n]),(stem,n+1)
  assert len(current[n].get_links())>=len(source[n].get_links()),(stem,n+1,'links')
 reports.append({'book':TITLES[stem],'pages':len(current),**counts,'interiorTextPreserved':True,'coverPixelsUnchanged':True})
# Update sampler excerpts from the same revised paid editions.
stem='sneakpeak-ideas';source=fitz.open(SRC/(stem+'.pdf'));original=fitz.open(ORIGINAL/(stem+'.pdf'));doc=fitz.open(SRC/(stem+'.pdf'));mapping=json.loads((R/'private/books/premium/sampler-source-map.json').read_text());replaced=set()
for entry in mapping:
 if entry['book'] not in STEMS[:4]:continue
 idx=entry['sampler_page']-1;replaced.add(idx);book=fitz.open(OUT/(entry['book']+'.pdf'));tmp=fitz.open();p=tmp.new_page(width=420,height=760)
 p.show_pdf_page(fitz.Rect(0,40,420,760) if book[0].rect.height==720 else fitz.Rect(0,103,420,698),book,entry['source_page']-1);p.draw_rect(fitz.Rect(0,0,420,40),fill=rgb('#354735'),color=None);p.insert_font(fontname='SamplerGraphHeader',fontfile=str(FONTFILES['Bold']))
 for b in source[idx].get_text('dict',clip=fitz.Rect(0,0,420,40))['blocks']:
  for l in b.get('lines',[]):
   for s in l['spans']:p.insert_text(s['origin'],s['text'],fontname='SamplerGraphHeader',fontsize=s['size'],color=rgb('#f2ecdd'))
 doc.delete_page(idx);doc.insert_pdf(tmp,start_at=idx)
for n in range(1,len(doc)):
 if n not in replaced:frame_graphs(doc[n],original[n]);reflection(doc[n])
restore_links(doc,source);out=OUT/(stem+'.pdf');doc.save(out,garbage=4,clean=True,deflate=True);doc.close();current=fitz.open(out)
assert len(current)==len(source)
for n in range(1,len(current)):
 assert words(current[n])==words(source[n]),('sampler text',n+1)
 assert len(current[n].get_links())>=len(source[n].get_links()),('sampler links',n+1)
reports.append({'book':'SneakPeak Ideas','pages':len(current),'paidExcerptsMatchRevisedEditions':True,'interiorTextPreserved':True})
SAMPLES={'art-of-attention':[0,4,5,6],'life-secrets':[0,8,9,27],'man-and-people-guide':[0,4,18,35],'lead-without-the-noise':[0,4,6,9]}
for stem in STEMS:
 full=OUT/(stem+'.pdf');(DELIVERY/full.name).write_bytes(full.read_bytes())
 if stem in SAMPLES:
  d=fitz.open(full);sample=fitz.open()
  for n in SAMPLES[stem]:sample.insert_pdf(d,from_page=n,to_page=n,links=False)
  sample.set_metadata({'title':TITLES[stem]+' — Four-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'});p=OUT/(stem+'-sample.pdf');sample.save(p,garbage=4,clean=True,deflate=True);(DELIVERY/p.name).write_bytes(p.read_bytes());assert len(sample)==4
(OUT/'graph-quality-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
