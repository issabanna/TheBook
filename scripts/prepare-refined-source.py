"""Prepare preserved source material and restrained cover refinements for Testing."""
from pathlib import Path
from collections import Counter
import re,fitz
from pypdf import PdfReader,PdfWriter
from pypdf.generic import ContentStream,FloatObject,DecodedStreamObject
R=Path(__file__).resolve().parents[1];BASE=R/'private/checkpoints/before-compact-interiors';CURRENT=R/'private/checkpoints/before-design-refinement';OUT=R/'private/refined-source';OUT.mkdir(exist_ok=True)
STEMS=['art-of-attention','life-secrets','man-and-people-guide','lead-without-the-noise','sneakpeak-ideas']
BODY='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def normalise(stem):
 reader=PdfReader(BASE/(stem+'.pdf'));w=PdfWriter();w.clone_document_from_reader(reader);seen=set()
 def change(cs):
  for i,(a,op) in enumerate(cs.operations):
   if op not in [b'rg',b'RG'] or len(a)!=3:continue
   r,g,b=map(float,a);new=None
   if r>.35 and b>.55 and b>g+.15 and r>g+.10:new='#827095'
   elif b>.75 and b>r+.25 and b>g+.15:new='#245389'
   elif r>.8 and g>.5 and b<.45:new='#e5c55b'
   if new:cs.operations[i]=([FloatObject(x) for x in rgb(new)],op)
  return cs
 def forms(res):
  if not res:return
  objects=res.get('/XObject',{});objects=objects.get_object() if hasattr(objects,'get_object') else objects
  for k,ref in list(objects.items()):
   obj=ref.get_object();ident=getattr(ref,'idnum',id(obj))
   if ident in seen or obj.get('/Subtype')!='/Form':continue
   seen.add(ident);cs=change(ContentStream(obj,w));n=DecodedStreamObject();n.update({k:v for k,v in obj.items() if k not in ['/Length','/Filter','/DecodeParms']});n.set_data(cs.get_data());objects[k]=w._add_object(n);forms(n.get('/Resources'))
 for p in w.pages[1:]:
  if p.get_contents() is not None:p.replace_contents(change(p.get_contents()))
  res=p.get('/Resources');forms(res.get_object() if res else None)
 dest=OUT/(stem+'-palette.pdf');w.write(dest);d=fitz.open(dest)
 for n,p in enumerate(d):
  if not n:continue
  old=words(p);allspans=spans(p);jobs=[];gold=[];headers=[]
  for dr in p.get_drawings():
   f=dr.get('fill')
   if f and f[0]>.75 and f[1]>.55 and f[2]<.55:gold.append(dr['rect'])
   if f and min(f)<.60 and dr['rect'].width>35 and dr['rect'].height>10:headers.append(dr['rect'])
  for s in allspans:
   r=fitz.Rect(s['bbox']);white=s['color']>0xeeeeee and any(x.contains(r) for x in gold)
   if not (r.y0>85 and r.y1<p.rect.height-37):continue
   if s['size']<8.5 or white:jobs.append((s,white))
  for s,white in jobs:p.add_redact_annot(fitz.Rect(s['bbox']),fill=False)
  if jobs:p.apply_redactions(images=0,graphics=0)
  for s,white in jobs:
   path=BOLD if 'Bold' in s['font'] or s['flags']&16 else BODY;fn='ReadableDiagramBold' if path==BOLD else 'ReadableDiagram';p.insert_font(fontname=fn,fontfile=path)
   size=max(9,s['size']);font=fitz.Font(fontfile=path);width=font.text_length(s['text'],fontsize=size);r=fitz.Rect(s['bbox']);x=max(32,min(388-width,(r.x0+r.x1-width)/2));color=rgb('#30382b') if white else tuple((s['color']>>shift&255)/255 for shift in (16,8,0))
   containers=[z for z in headers+gold if z.contains(r)]
   if s['color']>0xeeeeee and containers:
    z=min(containers,key=lambda z:z.get_area());x=max(z.x0+7,min(z.x1-7-width,x))
   p.insert_text((x,s['origin'][1]),s['text'],fontname=fn,fontsize=size,color=color)
  assert old==words(p),(stem,n+1,'diagram wording')
 return d
def label(p,t,x,y,size=11,kind='body',color='#30382b'):
 path={'body':BODY,'bold':BOLD,'serif':SERIF}[kind];name='RefCover'+kind;p.insert_font(fontname=name,fontfile=path);p.insert_text((x,y),t,fontname=name,fontsize=size,color=rgb(color))
def image_data(p):
 return [p.parent.extract_image(x[0])['image'] for x in p.get_images(full=True)]
def logo(p):
 label(p,'O',30,34,12,'bold','#68734b');x=30+fitz.Font(fontfile=BOLD).text_length('O',fontsize=12);label(p,'Portals.com',x,34,12,'bold')
def wrap(p,t,x,y,width,size=11,color='#30382b'):
 f=fitz.Font(fontfile=BODY);line=''
 for word in t.split():
  nxt=(line+' '+word).strip()
  if line and f.text_length(nxt,fontsize=size)>width:label(p,line,x,y,size,color=color);y+=size*1.4;line=word
  else:line=nxt
 if line:label(p,line,x,y,size,color=color)
def cover(stem):
 source=fitz.open(CURRENT/(stem+'.pdf'));d=fitz.open();d.insert_pdf(source,from_page=0,to_page=0);p=d[0];before=words(p)
 if stem=='life-secrets':
  zone=fitz.Rect(18,65,402,309);p.add_redact_annot(zone,fill=False);p.apply_redactions(images=0,graphics=0)
  p.draw_rect(zone,fill=rgb('#f6f0df'),fill_opacity=.94,color=None)
  label(p,'PHILOSOPHY FOR EVERYDAY LIFE',30,88,7.5,'bold','#68734b');label(p,'Life',28,153,52,'serif');label(p,'Secrets',28,211,52,'serif')
  wrap(p,'Small philosophical ideas for the choices you make every day.',30,250,350,11.5);label(p,'18 ILLUSTRATED IDEAS',30,291,7.8,'bold','#68734b')
 elif stem=='man-and-people-guide':
  p.add_redact_annot(fitz.Rect(25,100,395,220),fill=False);p.apply_redactions(images=0,graphics=0)
  f=fitz.Font(fontfile=SERIF)
  for t,y in [('Man and',152),('People',212)]:label(p,t,(420-f.text_length(t,fontsize=53))/2,y,53,'serif')
 elif stem=='lead-without-the-noise':
  art=image_data(source[0])[-1];d=fitz.open();p=d.new_page(width=420,height=720);p.draw_rect(p.rect,fill=rgb('#c7d1bd'),color=None);p.draw_rect(fitz.Rect(0,0,420,56),fill=rgb('#f7f3e9'),color=None);logo(p)
  label(p,'PHILOSOPHY FOR EVERYDAY LIFE',30,88,7.5,'bold','#52674d');label(p,'Lead Without',28,146,39,'serif');label(p,'the Noise',28,201,47,'serif')
  label(p,'Lead with clarity. Listen with care.',30,238,12);label(p,'Clarity. Listening. Responsibility.',30,263,10,'body','#52674d')
  p.draw_rect(fitz.Rect(0,284,420,658),fill=rgb('#f1e8d3'),color=None);p.insert_image(fitz.Rect(30,296,390,656),stream=art)
  p.draw_line((30,682),(390,682),color=rgb('#52674d'),width=.55);label(p,'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE',30,701,6.2,'bold','#52674d')
 elif stem=='sneakpeak-ideas':
  arts=image_data(source[0]);p.add_redact_annot(fitz.Rect(0,310,420,710),fill=False);p.apply_redactions(images=2,graphics=2)
  p.draw_rect(fitz.Rect(0,310,420,710),fill=rgb('#eae3cf'),color=None);p.insert_image(fitz.Rect(55,310,365,620),stream=arts[0],keep_proportion=True)
  for i,art in enumerate(arts[1:4]):p.insert_image(fitz.Rect(32+i*122,630,144+i*122,714),stream=art,keep_proportion=True)
 assert words(p)==before,(stem,'cover words changed',before-words(p),words(p)-before)
 return d
for stem in STEMS:
 d=normalise(stem);newcover=cover(stem);d.delete_page(0);d.insert_pdf(newcover,start_at=0);d.save(OUT/(stem+'.pdf'),garbage=4,clean=True,deflate=True);print(stem,'palette, labels and cover prepared')
