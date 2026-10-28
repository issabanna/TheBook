"""Reversible editorial edition; original PDFs remain authoritative and untouched.
Uses searchable text, preserves page count and navigation, adds artwork only in audited free space.
"""
from pathlib import Path
from io import BytesIO
from collections import Counter
import json,re,hashlib,sys
import fitz
from PIL import Image,ImageOps,ImageDraw
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'private/books';OUT=ROOT/'private/publishing-preview';OUT.mkdir(exist_ok=True)
DELIVERY=Path('/workspace/outputs/OPortals-Editorial-Preview');DELIVERY.mkdir(exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf';SANS='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for n,p in [('Editorial',FONT),('Body',SANS),('Bold',BOLD)]:pdfmetrics.registerFont(TTFont(n,p))
SPECS=[
 {'stem':'art-of-attention','slug':'art-of-attention','title':'The Art of Attention','lines':['The Art of','Attention'],'sub':'Make room for what deserves your attention.','dark':'#183e53','accent':'#eac870','credit':'AN OPORTALS ORIGINAL','panel':0,'placements':[(3,485,640),(25,318,409)]},
 {'stem':'life-secrets','slug':'life-secrets','title':'Life Secrets','lines':['Life','Secrets'],'sub':'Small philosophical ideas for the choices you make every day.','dark':'#e6bf68','accent':'#49543c','credit':'AN OPORTALS ORIGINAL','panel':1,'placements':[(5,339,409),(25,339,409)]},
 {'stem':'man-and-people-guide','slug':'man-and-people','title':'Man and People','lines':['Man and','People'],'sub':'Notice the expectations shaping your choices.','dark':'#e4ddec','accent':'#51405e','credit':'INDEPENDENT OPORTALS COMPANION','panel':2,'placements':[(3,533,640)]},
 {'stem':'lead-without-the-noise','slug':'lead-without-the-noise','title':'Lead Without the Noise','lines':['Lead Without','the Noise'],'sub':'Lead with clarity. Listen with care.','dark':'#c7d1bd','accent':'#435443','credit':'AN OPORTALS ORIGINAL','panel':3,'placements':[(3,413,515)]},
 {'stem':'sneakpeak-ideas','slug':'sneakpeak-ideas','title':'SneakPeak Ideas','lines':['SneakPeak','Ideas'],'sub':'One page. A question to take into your day.','dark':'#eae3cf','accent':'#68734b','credit':'A FREE ILLUSTRATED COLLECTION','panel':-1,'placements':[]},
]
def rgb(c):return tuple(int(c[i:i+2],16)/255 for i in (1,3,5))
def text(c,t,x,y,size=10,col='#303030',font='Body'):
 c.setFillColor(HexColor(col));c.setFont(font,size);c.drawString(x,y,t)
def wrap(c,t,x,y,width,size=11,leading=16,col='#f7f3e9',font='Body'):
 words=t.split();line=''
 for word in words:
  nxt=(line+' '+word).strip()
  if pdfmetrics.stringWidth(nxt,font,size)>width and line:text(c,line,x,y,size,col,font);y-=leading;line=word
  else:line=nxt
 if line:text(c,line,x,y,size,col,font);y-=leading
 return y
def split_art(path,prefix):
 im=Image.open(path).convert('RGB');w,h=im.size;paths=[]
 for i in range(4):
  box=((i%2)*w//2,(i//2)*h//2,((i%2)+1)*w//2,((i//2)+1)*h//2);p=OUT/(prefix+'-'+str(i)+'.jpg');im.crop(box).save(p,quality=94,subsampling=0);paths.append(p)
 return paths
cover_paths=split_art(sys.argv[1],'cover-art');inside_paths=split_art(sys.argv[2],'reading-art')
def cover(spec,w,h):
 buf=BytesIO();c=canvas.Canvas(buf,pagesize=(w,h));dark=spec['dark'];isfree=spec['panel']<0;ink='#26332e' if spec['stem']!='art-of-attention' else '#faf7f0';accent=spec['accent']
 c.setFillColor(HexColor(dark));c.rect(0,0,w,h,fill=1,stroke=0)
 c.setFillColor(HexColor('#f7f3e9'));c.rect(0,h-56,w,56,fill=1,stroke=0)
 text(c,'O',32,h-34,12,'#68734b','Bold');ow=pdfmetrics.stringWidth('O','Bold',12);text(c,'Portals.com',32+ow,h-34,12,'#303030','Bold')
 text(c,'PHILOSOPHY FOR EVERYDAY LIFE',32,h-84,7,accent,'Bold')
 def picture(path,x,y,pw,ph,center=(.5,.5)):
  im=ImageOps.fit(Image.open(path),(900,max(1,round(900*ph/pw))),centering=center);buf=BytesIO();im.save(buf,'JPEG',quality=90,optimize=True);c.drawImage(ImageReader(buf),x,y,width=pw,height=ph)
 stem=spec['stem']
 if stem=='life-secrets':
  # A tall, open architectural space, with text held in a warm side column.
  picture(cover_paths[1],207,70,w-207,h-174,center=(.67,.5))
  text(c,'Life',29,h-159,43,ink,'Editorial');text(c,'Secrets',29,h-212,37,ink,'Editorial')
  yy=wrap(c,spec['sub'],32,h-253,151,11,17,ink)
  text(c,'18 ILLUSTRATED IDEAS',32,145,7,accent,'Bold');wrap(c,'For the life you actually have.',32,121,145,13,19,ink,'Editorial')
 elif stem=='man-and-people-guide':
  # Society is a shared landscape: a centred title above the human pattern.
  for line,yy in [('Man and',h-147),('People',h-201)]:
   xx=(w-pdfmetrics.stringWidth(line,'Editorial',46))/2;text(c,line,xx,yy,46,ink,'Editorial')
  wrap(c,spec['sub'],50,h-238,w-100,11,16,ink)
  text(c,'Independent OPortals companion to José Ortega y Gasset',32,h-286,8,accent)
  picture(cover_paths[2],0,92,w,h-414,center=(.5,.5))
 elif stem=='lead-without-the-noise':
  # An open, calm leadership cover: generous type and a shared table, no podium.
  for line,yy in [('Lead',h-142),('Without',h-190),('the Noise',h-238)]:text(c,line,29,yy,41,ink,'Editorial')
  wrap(c,'Clarity. Listening. Responsibility.',283,h-148,100,10,17,ink)
  wrap(c,spec['sub'],32,h-269,340,11,16,ink)
  ah=max(120,h-380);c.setFillColor(HexColor('#f1e8d3'));c.rect(0,70,w,ah,fill=1,stroke=0);picture(cover_paths[3],(w-ah)/2,70,ah,ah)
 elif isfree:
  text(c,'SneakPeak',29,h-150,43,ink,'Editorial');text(c,'Ideas',29,h-205,48,ink,'Editorial')
  wrap(c,spec['sub'],32,h-246,340,11,16,ink)
  ah=h-390
  for i,path in enumerate(cover_paths):picture(path,26+(i%2)*185,70+(1-i//2)*ah/2,181,ah/2-4)
 else:
  text(c,'The Art of',29,h-145,44,ink,'Editorial');text(c,'Attention',29,h-201,46,ink,'Editorial')
  wrap(c,spec['sub'],32,h-244,342,11,16,ink)
  text(c,spec['credit'],32,h-286,6.6,accent,'Bold')
  picture(cover_paths[0],0,70,w,h-404,center=(.5,.48))
 c.setStrokeColor(HexColor(accent));c.setLineWidth(.6);c.line(32,48,w-32,48)
 foot='SELECTED EXCERPTS & CLEARLY MARKED FUTURE PREVIEWS' if isfree else 'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE'
 text(c,foot,32,29,6.2,accent,'Bold');c.save();buf.seek(0);return fitz.open(stream=buf.read(),filetype='pdf')
def words(p):return Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def restyle_page(page,spec):
 jobs=[]
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   for span in line['spans']:
    if span['size']>=18 and span['text'].strip():jobs.append(span)
 for span in jobs:page.add_redact_annot(fitz.Rect(span['bbox']),fill=False)
 if jobs:page.apply_redactions(images=0,graphics=0)
 for span in jobs:
  page.insert_font(fontname='OPortalsEditorial',fontfile=FONT)
  size=span['size'];width=page.rect.width-34-span['origin'][0];font=fitz.Font(fontfile=FONT);need=font.text_length(span['text'],fontsize=size)
  if need>width:size*=width/need
  page.insert_text(span['origin'],span['text'],fontname='OPortalsEditorial',fontsize=size,color=rgb({'life-secrets':'#49543c','man-and-people-guide':'#51405e','lead-without-the-noise':'#435443','sneakpeak-ideas':'#39432f'}.get(spec['stem'],spec['dark'])))
 # Restrained running rule stays above the content and below the existing wordmark.
 if spec['stem']!='sneakpeak-ideas':page.draw_line((34,48),(page.rect.width-34,48),color=rgb(spec['accent']),width=.45,overlay=True)
 return len(jobs)
def add_scene(page,path,y0,y1):
 target=fitz.Rect(34,y0,page.rect.width-34,y1)
 for b in page.get_text('blocks'):
  if fitz.Rect(b[:4]).intersects(target):raise ValueError('Artwork would overlap existing text '+str(b[:4]))
 im=Image.open(path);ratio=target.width/target.height;im=ImageOps.fit(im,(1400,round(1400/ratio)),centering=(.5,.25));b=BytesIO();im.save(b,'JPEG',quality=91,optimize=True);page.insert_image(target,stream=b.getvalue())
reports=[]
for spec in SPECS:
 source=fitz.open(SRC/(spec['stem']+'.pdf'));doc=fitz.open(SRC/(spec['stem']+'.pdf'));cp=cover(spec,doc[0].rect.width,doc[0].rect.height);p=doc[0]
 # Redact only the old cover page; its links are not used for contents navigation.
 p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,cp,0)
 headings=0
 for n in range(1,len(doc)):
  before=words(source[n]);headings+=restyle_page(doc[n],spec)
  if words(doc[n])!=before:raise ValueError('Text changed unexpectedly '+spec['stem']+' page '+str(n+1))
 for page,y0,y1 in spec['placements']:add_scene(doc[page-1],inside_paths[spec['panel']],y0,y1)
 if spec['stem']=='sneakpeak-ideas':
  # The anthology shows the same edition quality, not separate marketing-only pages.
  mapping=json.loads((SRC/'premium/sampler-source-map.json').read_text())
  for entry in mapping:
   revised=OUT/(entry['book']+'.pdf')
   if not revised.exists():continue
   idx=entry['sampler_page']-1;oldpage=doc[idx];links=oldpage.get_links();headers=source[idx].get_text('dict',clip=fitz.Rect(0,0,420,40))
   temp=fitz.open();tp=temp.new_page(width=420,height=760);book=fitz.open(revised);tp.show_pdf_page(fitz.Rect(0,40,420,760) if book[0].rect.height==720 else fitz.Rect(0,103,420,698),book,entry['source_page']-1)
   tp.draw_rect(fitz.Rect(0,0,420,40),fill=rgb('#354735'),color=None)
   tp.insert_font(fontname='PreviewHeader',fontfile=BOLD)
   for block in headers['blocks']:
    for line in block.get('lines',[]):
     for span in line['spans']:tp.insert_text(span['origin'],span['text'],fontname='PreviewHeader',fontsize=span['size'],color=rgb('#f2ecdd'))
   doc.delete_page(idx);doc.insert_pdf(temp,start_at=idx)
   for link in links:
    if link.get('kind')==fitz.LINK_URI:doc[idx].insert_link({'kind':fitz.LINK_URI,'from':link['from'],'uri':link['uri']})
   if words(doc[idx])!=words(source[idx]):raise ValueError('Sampler source mismatch '+str(idx+1))

 if spec['stem']=='sneakpeak-ideas':
  def status_copy(n,rect,value,size):
   page=doc[n];page.add_redact_annot(fitz.Rect(rect),fill=False);page.apply_redactions(images=0,graphics=0);page.insert_font(fontname='OPortalsBody',fontfile=SANS)
   fit=page.insert_textbox(fitz.Rect(rect),value,fontname='OPortalsBody',fontsize=size,lineheight=1.45,color=rgb('#f2ecdd' if n==14 else '#39432f'))
   if fit<0:raise ValueError('Status copy overflow')
  status_copy(1,(34,444,386,523),'A separately marked section introduces philosophy in management, leadership, time and contribution. Source strips distinguish excerpts from available editions from previews of unreleased books. Check each book’s page for its current status.',10.5)
  status_copy(12,(34,233,386,317),'The following pages connect philosophy with management, leadership, time and contribution. Lead Without the Noise is available as a complete edition. The other three titles remain previews in closed reader testing and cannot be purchased.',11)
  status_copy(12,(34,466,330,485),'Complete edition / available on OPortals.com',8.7)
  status_copy(12,(34,77,386,95),'PRACTICAL PHILOSOPHY / EDITIONS & PREVIEWS',6.8)
  status_copy(14,(34,7,403,21),'EXCERPT / COMPLETE EDITION / LEAD WITHOUT THE NOISE',6.1)
 # Text redaction can remove a link annotation whose rectangle touches the heading.
 # Restore any such original navigation after the typography and status edits.
 for n in range(1,len(doc)):
  existing={tuple(round(v,2) for v in link['from']) for link in doc[n].get_links()}
  for link in source[n].get_links():
   if tuple(round(v,2) for v in link['from']) in existing:continue
   if link['kind']==fitz.LINK_URI:doc[n].insert_link({'kind':fitz.LINK_URI,'from':link['from'],'uri':link['uri']})
   elif str(link.get('page','')).isdigit():doc[n].insert_link({'kind':fitz.LINK_GOTO,'from':link['from'],'page':int(link['page'])-1 if isinstance(link['page'],str) else link['page'],'to':fitz.Point(0,0)})
 doc.set_metadata({**doc.metadata,'title':spec['title']+' — Editorial Preview','author':'OPortals','subject':spec['sub'],'creator':'OPortals publishing studio'})
 path=OUT/(spec['stem']+'.pdf');doc.subset_fonts();doc.save(path,garbage=4,deflate=True,clean=True);doc.close()
 current=fitz.open(path);assert len(current)==len(source)
 for n in range(1,len(current)):assert len(current[n].get_links())>=len(source[n].get_links()),('Missing PDF link',spec['stem'],n+1)
 for n in range(1,len(current)):
  if spec['stem']=='sneakpeak-ideas' and n in [1,12,14]:continue # Only publication-status paragraphs are deliberately corrected.
  assert words(current[n])==words(source[n]),(spec['stem'],n)
 # Four pages means exactly four; the free anthology remains complete.
 if spec['stem']!='sneakpeak-ideas':
  ids={'art-of-attention':[0,4,5,6],'life-secrets':[0,5,13,27],'man-and-people-guide':[0,18,30,35],'lead-without-the-noise':[0,4,8,16]}[spec['stem']]
  sample=fitz.open()
  for n in ids:sample.insert_pdf(current,from_page=n,to_page=n,links=False)
  sample.set_metadata({'title':spec['title']+' — Four-page sample','author':'OPortals'});sample.save(OUT/(spec['stem']+'-sample.pdf'),garbage=4,deflate=True,clean=True);assert len(sample)==4
 (DELIVERY/(spec['stem']+'.pdf')).write_bytes(path.read_bytes())
 reports.append({'book':spec['title'],'pages':len(current),'interiorTextPreserved':True,'statusCopyCorrected':spec['stem']=='sneakpeak-ideas','headingsRefined':headings,'illustrationsAdded':len(spec['placements']),'originalSha256':hashlib.sha256((SRC/(spec['stem']+'.pdf')).read_bytes()).hexdigest(),'newSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'quality-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
