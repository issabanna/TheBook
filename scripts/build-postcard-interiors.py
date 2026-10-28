"""Illustrated Testing revision from the saved, authoritative PDF editions.
Replaces chapter graphics; keeps all interior wording, exercises and references.
"""
from pathlib import Path
from io import BytesIO
from collections import Counter
import sys,json,re,hashlib
import fitz
from PIL import Image,ImageOps
from pypdf import PdfReader,PdfWriter
from pypdf.generic import ContentStream,FloatObject,DecodedStreamObject,NameObject
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
R=Path(__file__).resolve().parents[1];SRC=R/'private/checkpoints/before-postcard-interiors';OUT=R/'private/publishing-preview';OUT.mkdir(exist_ok=True)
DELIVERY=Path('/workspace/outputs/OPortals-Postcard-Edition');DELIVERY.mkdir(exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf';BODY='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for n,p in [('Editorial',FONT),('Body',BODY),('Bold',BOLD)]:pdfmetrics.registerFont(TTFont(n,p))
SPECS=[('art-of-attention',[5,9,13,17,21,25],sys.argv[1]),('life-secrets',[5,9,13,17,21,25],sys.argv[2]),('man-and-people-guide',[5,11,17,23,29,35],sys.argv[3]),('lead-without-the-noise',[5,9,13,17],sys.argv[4])]
TITLES={'art-of-attention':'The Art of Attention','life-secrets':'Life Secrets','man-and-people-guide':'Man and People','lead-without-the-noise':'Lead Without the Noise','sneakpeak-ideas':'SneakPeak Ideas'}
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def words(p):return Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def split_sheet(path,stem):
 im=Image.open(path).convert('RGB');w,h=im.size;paths=[]
 for i in range(6):
  box=((i%2)*w//2,(i//2)*h//3,((i%2)+1)*w//2,((i//2)+1)*h//3);p=OUT/(stem+'-postcard-'+str(i)+'.jpg');im.crop(box).save(p,quality=94,optimize=True);paths.append(p)
 return paths
def flatten_containers(stem):
 reader=PdfReader(SRC/(stem+'.pdf'));writer=PdfWriter();writer.clone_document_from_reader(reader);count=0;visited=set()
 def stream_change(stream):
  nonlocal count
  for i,(args,op) in enumerate(stream.operations):
   if op==b'rg' and len(args)==3:
    vals=[float(x) for x in args]
    if min(vals)>.60 and max(vals)-min(vals)>.035:
     stream.operations[i]=([FloatObject(1),FloatObject(1),FloatObject(1)],op);count+=1
  return stream
 def forms(resources):
  if not resources:return
  objects=resources.get('/XObject',{});
  if hasattr(objects,'get_object'):objects=objects.get_object()
  for key,ref in list(objects.items()):
   obj=ref.get_object();ident=getattr(ref,'idnum',id(obj))
   if ident in visited or obj.get('/Subtype')!='/Form':continue
   visited.add(ident);cs=stream_change(ContentStream(obj,writer));new=DecodedStreamObject();new.update({k:v for k,v in obj.items() if k not in ['/Length','/Filter','/DecodeParms']});new.set_data(cs.get_data());objects[key]=writer._add_object(new);forms(new.get('/Resources'))
 for number,p in enumerate(writer.pages[1:],2):
  if stem=='art-of-attention' and number in [6,26]:continue # Selected fields carry meaning in these explanatory illustrations.
  stream=p.get_contents()
  if stream is not None:p.replace_contents(stream_change(stream))
  resources=p.get('/Resources');forms(resources.get_object() if resources else None)
 temp=OUT/(stem+'-frameless.pdf');writer.write(temp);return temp,count

def picture(c,path,x,y,w,h):
 im=ImageOps.fit(Image.open(path).convert('RGB'),(1000,round(1000*h/w)));buf=BytesIO();im.save(buf,'JPEG',quality=91,optimize=True);c.drawImage(ImageReader(buf),x,y,width=w,height=h)
def label(c,t,x,y,size=10,col='#303030',font='Body'):
 c.setFillColor(HexColor(col));c.setFont(font,size);c.drawString(x,y,t)
def linewrap(c,t,x,y,w,size=11,col='#303030'):
 line=''
 for word in t.split():
  nxt=(line+' '+word).strip()
  if pdfmetrics.stringWidth(nxt,'Body',size)>w and line:label(c,line,x,y,size,col);y-=size*1.45;line=word
  else:line=nxt
 if line:label(c,line,x,y,size,col)
def full_cover(stem,w,h,path):
 b=BytesIO();c=canvas.Canvas(b,pagesize=(w,h));picture(c,path,0,0,w,h)
 c.saveState();c.setFillColor(HexColor('#102f44' if stem=='art-of-attention' else '#f2ead4'));c.setFillAlpha(.62 if stem=='art-of-attention' else .68);c.rect(0,h-310,w,310,fill=1,stroke=0);c.restoreState()
 c.saveState();c.setFillColor(HexColor('#f7f3e9'));c.setFillAlpha(.88);c.rect(0,h-55,w,55,fill=1,stroke=0);c.restoreState()
 label(c,'O',30,h-34,12,'#68734b','Bold');ow=pdfmetrics.stringWidth('O','Bold',12);label(c,'Portals.com',30+ow,h-34,12,'#303030','Bold')
 ink='#fbf7ef' if stem=='art-of-attention' else '#30382b';accent='#eed69a' if stem=='art-of-attention' else '#68734b'
 label(c,'PHILOSOPHY FOR EVERYDAY LIFE',30,h-87,7,accent,'Bold')
 lines=['The Art of','Attention'] if stem=='art-of-attention' else ['Life','Secrets']
 for i,t in enumerate(lines):label(c,t,28,h-151-i*57,47 if stem=='art-of-attention' else 51,ink,'Editorial')
 sub='Make room for what deserves your attention.' if stem=='art-of-attention' else 'Small philosophical ideas for the choices you make every day.'
 linewrap(c,sub,30,h-248,350,11,ink)
 label(c,'AN OPORTALS ORIGINAL' if stem=='art-of-attention' else '18 ILLUSTRATED IDEAS',30,h-288,6.8,accent,'Bold')
 c.saveState();c.setFillColor(HexColor('#f7f3e9'));c.setFillAlpha(.84);c.rect(0,0,w,39,fill=1,stroke=0);c.restoreState();label(c,'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE',30,16,6.1,'#49543c','Bold');c.save();b.seek(0);return fitz.open(stream=b.read(),filetype='pdf')

def replace_chapter(page,original,stem,index,asset,custom_zone=None):
 if custom_zone is not None:zone=custom_zone
 elif stem=='lead-without-the-noise':zone=fitz.Rect(34,237,386,449)
 else:
  spans=[s for b in original.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
  top=max(s['bbox'][3] for s in spans if s['size']>=12 and s['bbox'][1]<240)+10
  body=[s['bbox'][1] for s in spans if 10.8<=s['size']<=11.3 and s['bbox'][1]>320 and len(s['text'])>40]
  bottom=(min(body) if body else 425)-8;zone=fitz.Rect(34,top,386,bottom)
 if zone.height<125:raise ValueError('Not enough chapter space '+stem+' '+str(index+1)+' '+str(zone))
 lines=[]
 for block in original.get_text('dict')['blocks']:
  for ln in block.get('lines',[]):
   r=fitz.Rect(ln['bbox'])
   if r.intersects(zone):
    if not zone.contains(r):raise ValueError('Partial text at chapter artwork boundary '+str(r)+' '+str(zone))
    lines.append((r, ' '.join(s['text'] for s in ln['spans'])))
 # Plain captions preserve the actual distinctions without surrounding them with boxes.
 centers=[(r.x0+r.x1)/2 for r,t in lines]
 k=3 if any(170<x<250 for x in centers) and any(x<160 for x in centers) and any(x>260 for x in centers) else 2 if any(x<190 for x in centers) and any(x>230 for x in centers) else 1
 cols=[[] for _ in range(k)]
 for r,t in sorted(lines,key=lambda z:(z[0].y0,z[0].x0)):
  col=min(k-1,max(0,int(((r.x0+r.x1)/2-zone.x0)/zone.width*k)));cols[col].append(t)
 cols=[' '.join(x) for x in cols];font=fitz.Font(fontfile=BODY);colw=(zone.width-(k-1)*12)/k;size=9.3
 def height(text):
  n=1;width=0
  for word in text.split():
   ww=font.text_length(word+' ',fontsize=size)
   if width+ww>colw:n+=1;width=ww
   else:width+=ww
  return n*size*1.35
 caph=max([height(x) for x in cols] or [0])+4
 if caph>zone.height-80:raise ValueError('Diagram captions too tall '+stem+' '+str(index+1))
 before=words(page);page.add_redact_annot(zone,fill=False);page.apply_redactions(images=2,graphics=2)
 arth=zone.height-caph-10;im=Image.open(asset);buf=BytesIO();im.save(buf,'JPEG',quality=93,optimize=True);page.insert_image(fitz.Rect(zone.x0,zone.y0,zone.x1,zone.y0+arth),stream=buf.getvalue(),keep_proportion=True)
 page.insert_font(fontname='OPortalsCaption',fontfile=BODY)
 for col,tx in enumerate(cols):
  if not tx:continue
  rect=fitz.Rect(zone.x0+col*(colw+12),zone.y1-caph,zone.x0+col*(colw+12)+colw,zone.y1+3)
  result=page.insert_textbox(rect,tx,fontsize=size,fontname='OPortalsCaption',lineheight=1.3,color=rgb('#535e58'),align=1)
  if result<0:raise ValueError('Caption overflow '+stem+' '+str(index+1))
 if words(page)!=before:raise ValueError('Chapter words changed '+stem+' '+str(index+1))
 return {'page':index+1,'visual':'postcard-style conceptual illustration','originalDiagramWordsRetained':True,'region':[round(v,1) for v in zone]}
def restore_links(doc,source):
 for n in range(1,len(doc)):
  existing={tuple(round(v,2) for v in x['from']) for x in doc[n].get_links()}
  for x in source[n].get_links():
   if tuple(round(v,2) for v in x['from']) in existing:continue
   if x['kind']==fitz.LINK_URI:doc[n].insert_link({'kind':fitz.LINK_URI,'from':x['from'],'uri':x['uri']})
   elif str(x.get('page','')).isdigit():doc[n].insert_link({'kind':fitz.LINK_GOTO,'from':x['from'],'page':int(x['page'])-1 if isinstance(x['page'],str) else x['page'],'to':fitz.Point(0,0)})
reports=[]
for stem,chapters,sheet in SPECS:
 assets=split_sheet(sheet,stem);temp,containers=flatten_containers(stem);doc=fitz.open(temp);source=fitz.open(SRC/(stem+'.pdf'));changes=[]
 for i,n in enumerate(chapters):changes.append(replace_chapter(doc[n-1],source[n-1],stem,n-1,assets[i]))
 if stem=='lead-without-the-noise':
  for n,asset in [(7,assets[4]),(10,assets[5])]:
   original=source[n-1];boxes=[]
   for dr in original.get_drawings():
    f=dr.get('fill');r=dr['rect']
    if f and min(f)>.6 and max(f)-min(f)>.035 and r.width>60 and r.height>20 and r.width<380:boxes.append(r)
   union=fitz.Rect(boxes[0])
   for r in boxes[1:]:union|=r
   lines=[fitz.Rect(l['bbox']) for b in original.get_text('dict')['blocks'] for l in b.get('lines',[])]
   before=max([r.y1 for r in lines if r.y1<union.y0] or [200]);after=min([r.y0 for r in lines if r.y0>union.y1] or [original.rect.height-80])
   zone=fitz.Rect(34,before+8,386,after-8)
   changes.append(replace_chapter(doc[n-1],original,stem,n-1,asset,zone))

 if stem in ['art-of-attention','life-secrets']:
  p=doc[0];cp=full_cover(stem,p.rect.width,p.rect.height,sys.argv[5 if stem=='art-of-attention' else 6]);p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,cp,0)
 restore_links(doc,source)
 doc.set_metadata({**doc.metadata,'title':TITLES[stem]+' — Illustrated Edition','author':'OPortals','creator':'OPortals publishing studio'})
 out=OUT/(stem+'.pdf');doc.subset_fonts();doc.save(out,garbage=4,clean=True,deflate=True);doc.close();new=fitz.open(out)
 for n in range(1,len(new)):
  assert words(new[n])==words(source[n]),('Interior wording changed',stem,n+1)
  assert len(new[n].get_links())>=len(source[n].get_links()),('Navigation lost',stem,n+1)
 assert len(new)==len(source)
 reports.append({'book':TITLES[stem],'pages':len(new),'chapterIllustrations':changes,'paleFillOperationsRemoved':containers,'interiorTextPreserved':True,'fullBleedCover':stem in ['art-of-attention','life-secrets']})
# Free anthology carries the identical revised paid pages and its already-corrected status copy.
stem='sneakpeak-ideas';temp,containers=flatten_containers(stem);doc=fitz.open(temp);source=fitz.open(SRC/(stem+'.pdf'))
for entry in json.loads((R/'private/books/premium/sampler-source-map.json').read_text()):
 paid=OUT/(entry['book']+'.pdf')
 if entry['book'] not in TITLES or not paid.exists():continue
 idx=entry['sampler_page']-1;headers=source[idx].get_text('dict',clip=fitz.Rect(0,0,420,40));book=fitz.open(paid);tmp=fitz.open();p=tmp.new_page(width=420,height=760)
 p.show_pdf_page(fitz.Rect(0,40,420,760) if book[0].rect.height==720 else fitz.Rect(0,103,420,698),book,entry['source_page']-1);p.draw_rect(fitz.Rect(0,0,420,40),fill=rgb('#354735'),color=None);p.insert_font(fontname='SamplerHeader',fontfile=BOLD)
 for b in headers['blocks']:
  for l in b.get('lines',[]):
   for s in l['spans']:p.insert_text(s['origin'],s['text'],fontname='SamplerHeader',fontsize=s['size'],color=rgb('#f2ecdd'))
 doc.delete_page(idx);doc.insert_pdf(tmp,start_at=idx)
restore_links(doc,source);doc.set_metadata({**doc.metadata,'title':'SneakPeak Ideas — Illustrated Collection','author':'OPortals','creator':'OPortals publishing studio'});out=OUT/(stem+'.pdf');doc.save(out,garbage=4,clean=True,deflate=True);doc.close();new=fitz.open(out)
for n in range(1,len(new)):
 assert words(new[n])==words(source[n]),('Sampler words changed',n+1)
 assert len(new[n].get_links())>=len(source[n].get_links()),('Sampler link lost',n+1)
reports.append({'book':'SneakPeak Ideas','pages':len(new),'paidExcerptsMatchRevisedEditions':True,'paleFillOperationsRemoved':containers,'interiorTextPreserved':True})
for stem in TITLES:
 d=fitz.open(OUT/(stem+'.pdf'));(DELIVERY/(stem+'.pdf')).write_bytes((OUT/(stem+'.pdf')).read_bytes())
 if stem!='sneakpeak-ideas':
  ids={'art-of-attention':[0,4,5,6],'life-secrets':[0,8,9,27],'man-and-people-guide':[0,4,18,35],'lead-without-the-noise':[0,4,6,9]}[stem];sample=fitz.open()
  for n in ids:sample.insert_pdf(d,from_page=n,to_page=n,links=False)
  sample.set_metadata({'title':TITLES[stem]+' — Four-page sample','author':'OPortals','subject':'Cover and three selected illustrated pages. Original page numbers retained.','creator':'OPortals publishing studio'})
  sample.save(OUT/(stem+'-sample.pdf'),garbage=4,clean=True,deflate=True);assert len(sample)==4;(DELIVERY/(stem+'-sample.pdf')).write_bytes((OUT/(stem+'-sample.pdf')).read_bytes())
(OUT/'postcard-quality-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))

for temporary in OUT.glob('*-frameless.pdf'):temporary.unlink()
