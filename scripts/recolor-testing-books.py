"""Regenerate the Testing color edition from an immutable local manuscript backup.
Never processes Life Secrets. Keeps searchable text, original contents and links.
"""
from pathlib import Path
from io import BytesIO
import json, math, re, hashlib
from pypdf import PdfReader,PdfWriter
from pypdf.generic import FloatObject,NameObject
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
import fitz
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];B=R/'private/books';SRC=R/'private/checkpoints/before-color-edition/books';W,H=420,595
for name,file in [('Serif','DejaVuSerif.ttf'),('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
SPECS=[
('art-of-attention','The Art of\nAttention','Make room for what deserves your focus.','#243e42','#edc269','#e5ecdf','focus'),
('man-and-people-guide','Man and\nPeople','An independent illustrated companion\nto José Ortega y Gasset.','#35324b','#c4afd5','#e8e3ef','society'),
('the-philosopher-manager','The Philosopher\nManager','Judgment. Responsibility. Everyday work.','#324330','#e7bc68','#e6e9d8','balance'),
('lead-without-the-noise','Lead Without\nthe Noise','Clarity without the performance of certainty.','#293a52','#9fc4ca','#e1e8ed','lead'),
('time-for-what-matters','Time for\nWhat Matters','Give your finite day a considered shape.','#734b36','#f2cf88','#f0e5d1','time'),
('stand-out-for-something','Stand Out\nfor Something','Build a contribution worth noticing.','#503d4e','#d9b3a0','#eee0df','stand'),
('sneakpeak-ideas','SneakPeak\nIdeas','A small idea can change\nhow you see your day.','#46523b','#e4c579','#e9e7d8','pages')]
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def rect(c,x,y,w,h,col):c.setFillColor(HexColor(col));c.rect(x,y,w,h,fill=1,stroke=0)
def line(c,x,y,xx,yy,col,width=1):c.setStrokeColor(HexColor(col));c.setLineWidth(width);c.line(x,y,xx,yy)
def label(c,t,x,y,size=9,col='#f4eee2',font='Body'):
 c.setFillColor(HexColor(col));c.setFont(font,size);c.drawString(x,y,t)
def polygon(c,pts,col):
 p=c.beginPath();p.moveTo(*pts[0]);[p.lineTo(*v) for v in pts[1:]];p.close();c.setFillColor(HexColor(col));c.drawPath(p,fill=1,stroke=0)
def cover(spec):
 stem,title,sub,dark,accent,paper,kind=spec;buf=BytesIO();c=canvas.Canvas(buf,pagesize=(W,H));rect(c,0,0,W,H,dark)
 label(c,'O',35,557,12,accent,'Bold');label(c,'Portals.com',46,557,12,'#f4eee2','Bold');label(c,'ILLUSTRATED PHILOSOPHY',35,520,7,accent,'Bold')
 p=Paragraph(title.replace('\n','<br/>'),ParagraphStyle('title',fontName='Serif',fontSize=32,leading=37,textColor=HexColor('#f4eee2')));_,h=p.wrap(353,200);p.drawOn(c,35,490-h)
 for n,t in enumerate(sub.split('\n')):label(c,t,36,490-h-25-n*14,8.3,'#f4eee2')
 # Symbolic, book-specific vector art. Text is typeset, never rasterised.
 if kind=='focus':
  for i in range(12):
   yy=112+i*17;line(c,46,yy,369,yy,'#526d6c',1)
  polygon(c,[(210,323),(116,106),(310,106)],'#8caa9d')
  for i in range(9):line(c,140+i*3,135+i*17,285-i*3,135+i*17,dark,2)
  rect(c,155,201,112,12,accent);line(c,155,223,267,223,'#f4eee2',1)
 elif kind=='society':
  for row in range(5):
   for col in range(7):
    x=48+col*46;y=100+row*40;rect(c,x,y,27,27,'#70627f' if (row+col)%3 else '#a38da9');line(c,x+27,y+13,x+46,y+13,'#8a7b96',.7)
  polygon(c,[(184,83),(216,83),(216,296),(248,296),(200,342),(152,296),(184,296)],accent)
 elif kind=='balance':
  polygon(c,[(210,276),(165,114),(255,114)],'#8b9b7a');line(c,86,273,334,273,accent,5)
  for x in [100,320]:
   line(c,x,273,x-38,177,'#e9e1c9',1);line(c,x,273,x+38,177,'#e9e1c9',1);polygon(c,[(x-48,177),(x+48,177),(x+30,155),(x-30,155)],accent)
  rect(c,122,95,176,9,accent);label(c,'JUDGMENT',174,315,8,accent,'Bold')
 elif kind=='lead':
  for n in range(7):
   x=48+n*47;line(c,x,122,x,174,'#7796a9',2);line(c,x,174,210,261,'#7796a9',2)
  line(c,210,261,210,324,accent,9);polygon(c,[(190,311),(230,311),(210,337)],accent)
  rect(c,183,106,54,12,accent)
 elif kind=='time':
  rect(c,68,104,284,219,'#c18e60');rect(c,68,284,284,39,accent)
  for row in range(3):
   for col in range(5):rect(c,83+col*51,121+row*50,40,36,'#84563c')
  rect(c,134,171,91,36,accent);rect(c,236,121,40,36,'#f3e4bc')
  line(c,116,309,116,341,'#f4eee2',4);line(c,302,309,302,341,'#f4eee2',4)
 elif kind=='stand':
  for n in range(6):rect(c,49+n*54,101,43,42+n*26,'#87667e')
  rect(c,211,101,43,222,accent);polygon(c,[(232,346),(218,325),(246,325)],accent);line(c,232,349,232,368,accent,2)
 elif kind=='pages':
  for n,col in enumerate(['#9fae8c','#c5af86','#c7bacb']):
   xx=75+n*73;yy=110+n*26;polygon(c,[(xx,yy),(xx+118,yy+20),(xx+118,yy+167),(xx,yy+147)],col)
   for k in range(4):line(c,xx+16,yy+113-k*18,xx+93,yy+127-k*18,dark,1.5)
 line(c,35,72,385,72,accent,.7);label(c,'OPORTALS  /  VISUAL READING EDITION',35,48,6.8,accent,'Bold');c.save();buf.seek(0);return PdfReader(buf).pages[0]
def repaint(page,paper):
 stream=page.get_contents()
 if stream is not None:
  # Replace white fill with title-specific paper; text/lines/diagrams retain their colors.
  for i,(args,op) in enumerate(stream.operations):
   if op==b'rg' and len(args)==3 and all(float(v)>.99 for v in args):stream.operations[i]=([FloatObject(v) for v in rgb(paper)],op)
   elif op==b'g' and args and float(args[0])>.99:stream.operations[i]=([FloatObject(v) for v in rgb(paper)],b'rg')
  stream.operations=list(stream.operations)
  page.replace_contents(stream)
 # Underlay fills formerly transparent pages too. Side rails live outside text margins.
 buf=BytesIO();c=canvas.Canvas(buf,pagesize=(W,H));rect(c,0,0,W,H,paper);c.save();buf.seek(0);page.merge_page(PdfReader(buf).pages[0],over=False)
def regenerate(spec):
 stem,title,sub,dark,accent,paper,kind=spec;r=PdfReader(SRC/(stem+'.pdf'));writer=PdfWriter();writer.clone_document_from_reader(r)
 cp=cover(spec);writer.pages[0].replace_contents(cp.get_contents());writer.pages[0][NameObject('/Resources')]=cp['/Resources'].clone(writer)
 for n,p in enumerate(writer.pages[1:],1):
  # Colored paper throughout; a stronger opening tint at regular chapter intervals.
  tint=paper if n%4 else ('#dedac5' if kind in ['time','pages','balance'] else '#d6dfe2')
  repaint(p,tint)
  buf=BytesIO();c=canvas.Canvas(buf,pagesize=(W,H));rect(c,0,0,9,H,dark);rect(c,9,0,3,H,accent);rect(c,0,586,W,9,dark);c.save();buf.seek(0);p.merge_page(PdfReader(buf).pages[0])
 writer.add_metadata({'/Title':title.replace('\n',' '),'/Author':'OPortals','/Subject':sub.replace('\n',' '),'/Creator':'OPortals publishing studio'});writer.write(B/(stem+'.pdf'))
 # Samples are extracted from regenerated books, ensuring cover and page fidelity.
 if stem!='sneakpeak-ideas':
  full=PdfReader(B/(stem+'.pdf'));out=PdfWriter()
  if stem=='art-of-attention':ids=[0,2,3,6,10,14,17,28]
  elif stem=='man-and-people-guide':ids=[0,2,3,11,18,20,36,42]
  else:ids=[0,2,3,5,10,17,22]
  out.append(full,pages=ids,import_outline=False)
  for page in out.pages:
   if '/Annots'in page:del page['/Annots']
  out.add_metadata({'/Title':title.replace('\n',' ')+' — Free sample','/Author':'OPortals'});out.write(B/(stem+'-sample.pdf'))
 print(stem,len(writer.pages),'pages')
def export_media():
 catalog=json.loads((B/'sample-media.json').read_text());alias={'man-and-people':'man-and-people-guide'}
 for slug,records in catalog.items():
  if slug=='life-secrets':continue
  stem=alias.get(slug,slug);doc=fitz.open(B/(stem+'.pdf'))
  specs=[(slug+'-cover.webp',1)]+[(Path(r['src']).name,r['page']) for r in records]
  for name,n in specs:
   pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(1.55,1.55),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);im.save(B/'web-media'/name,'WEBP',quality=83)
 # Both legacy and current Ortega cover URLs must show the same PDF cover.
 (B/'web-media/man-and-people-guide-cover.webp').write_bytes((B/'web-media/man-and-people-cover.webp').read_bytes())
 # Contact sheet for visual review.
 thumbs=[]
 for stem,*_ in SPECS:
  doc=fitz.open(B/(stem+'.pdf'))
  for n in [0,5]:
   pix=doc[n].get_pixmap(matrix=fitz.Matrix(.65,.65));im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);thumbs.append(im)
 sheet=Image.new('RGB',(7*283,2*407),'#ddd8cd')
 for i,im in enumerate(thumbs):sheet.paste(im,((i//2)*283+5,(i%2)*407+10))
 sheet.save(B/'color-edition-review.jpg')
if __name__=='__main__':
 for spec in SPECS:regenerate(spec)
 export_media()
