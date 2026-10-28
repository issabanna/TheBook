"""Update Testing covers only; keep the graph edition interiors byte-equivalent in content.
Usage: python3 scripts/build-organic-covers.py attention.png life.png people.png lead.png free.png
"""
from pathlib import Path
from collections import Counter
from io import BytesIO
import sys,re,json
import fitz
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'private/checkpoints/before-organic-covers'
OUT=ROOT/'private/publishing-preview'
DELIVERY=Path('/workspace/outputs/OPortals-Organic-Covers');DELIVERY.mkdir(exist_ok=True)
FONT='/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf'
REG='/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'
BRAND='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
INK='#242621';OLIVE='#68734b'
SPECS=[
 ('art-of-attention',['THE ART OF','ATTENTION'],[43,47], 'Make room for what deserves your attention.','AN OPORTALS ORIGINAL'),
 ('life-secrets',['LIFE','SECRETS'],[69,61], 'Small philosophical ideas for the choices you make every day.','18 ILLUSTRATED IDEAS'),
 ('man-and-people-guide',['MAN AND','PEOPLE'],[51,60], 'Notice the expectations shaping your choices.','Independent OPortals companion to José Ortega y Gasset'),
 ('lead-without-the-noise',['LEAD WITHOUT','THE NOISE'],[34,48], 'Lead with clarity. Listen with care.','Clarity. Listening. Responsibility.'),
 ('sneakpeak-ideas',['SNEAKPEAK','IDEAS'],[41,67], 'One page. A question to take into your day.',''),
]
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def font(p,name,path):p.insert_font(fontname=name,fontfile=path);return name
def centred(p,text,y,size=10,weight=False,color=INK):
 path=FONT if weight else REG;f=fitz.Font(fontfile=path);width=f.text_length(text,fontsize=size)
 assert width<=p.rect.width-62,(text,width)
 p.insert_text(((p.rect.width-width)/2,y),text,fontname=font(p,'OrganicTitle' if weight else 'OrganicBody',path),fontsize=size,color=rgb(color))
def wrapped(p,text,y,width=310,size=11,leading=17):
 f=fitz.Font(fontfile=REG);line='';lines=[]
 for word in text.split():
  test=(line+' '+word).strip()
  if f.text_length(test,fontsize=size)>width and line:lines.append(line);line=word
  else:line=test
 if line:lines.append(line)
 for line in lines:centred(p,line,y,size);y+=leading
 return y
def tokens(p):return Counter(re.findall(r'\w+',p.get_text().casefold()))
report=[]
for spec,art in zip(SPECS,sys.argv[1:]):
 stem,lines,sizes,sub,credit=spec;source=fitz.open(SOURCE/(stem+'.pdf'));doc=fitz.open(SOURCE/(stem+'.pdf'));p=doc[0];w,h=p.rect.width,p.rect.height
 old=tokens(p)
 p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2)
 # Generated art is a flat full-page background; typography stays vector/searchable.
 im=Image.open(art).convert('RGB');b=BytesIO();im.save(b,'JPEG',quality=94,optimize=True,subsampling=0)
 p.insert_image(p.rect,stream=b.getvalue(),keep_proportion=False)
 centred(p,'PHILOSOPHY FOR EVERYDAY LIFE',h*.263,8.4,False)
 y=h*.350
 for line,size in zip(lines,sizes):centred(p,line,y,size,True);y+=h*.089
 wrapped(p,sub,max(y+h*.015,h*.515),width=310,size=11,leading=17)
 if stem=='lead-without-the-noise':centred(p,credit,h*.626,9.2)
 # Match the website's olive O and charcoal Portals.com wordmark.
 word='OPortals.com';f=fitz.Font(fontfile=BRAND);size=15.5;total=f.text_length(word,fontsize=size);x=(w-total)/2;y=h*.710
 fn=font(p,'OrganicBrand',BRAND);p.insert_text((x,y),'O',fontname=fn,fontsize=size,color=rgb(OLIVE));p.insert_text((x+f.text_length('O',fontsize=size),y),'Portals.com',fontname=fn,fontsize=size,color=rgb(INK))
 if credit and stem!='lead-without-the-noise':centred(p,credit,h*.748,6.9 if stem=='man-and-people-guide' else 7.5)
 footer='SELECTED EXCERPTS & CLEARLY MARKED FUTURE PREVIEWS' if stem=='sneakpeak-ideas' else 'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE'
 centred(p,footer,h*.785,5.9,False)
 assert tokens(p)==old,(stem,'cover words changed',tokens(p)-old,old-tokens(p))
 dest=OUT/(stem+'.pdf');doc.save(dest,garbage=4,clean=True,deflate=True);doc.close();current=fitz.open(dest)
 for n in range(1,len(current)):
  assert current[n].get_text()==source[n].get_text(),(stem,n+1,'interior text')
  assert current[n].get_pixmap().samples==source[n].get_pixmap().samples,(stem,n+1,'interior rendering')
  assert len(current[n].get_links())==len(source[n].get_links()),(stem,n+1,'interior links')
 current[0].get_pixmap(matrix=fitz.Matrix(2,2)).save(DELIVERY/(stem+'-cover.png'))
 (DELIVERY/dest.name).write_bytes(dest.read_bytes())
 report.append({'book':stem,'pages':len(current),'coverWordingPreserved':True,'interiorTextAndRendersUnchanged':True,'interiorLinksPreserved':True})
choices={'art-of-attention':[1,5,6,7],'life-secrets':[1,9,10,28],'man-and-people-guide':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}
for stem,ns in choices.items():
 d=fitz.open(OUT/(stem+'.pdf'));s=fitz.open()
 for n in ns:s.insert_pdf(d,from_page=n-1,to_page=n-1,links=False)
 s.set_metadata({'title':'OPortals — Four-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'})
 dest=OUT/(stem+'-sample.pdf');s.save(dest,garbage=4,clean=True,deflate=True);assert len(s)==4;(DELIVERY/dest.name).write_bytes(dest.read_bytes())
(DELIVERY/'quality-checks.json').write_text(json.dumps(report,indent=2))
# A review sheet of real rendered covers, not simulated mockups.
thumbs=[]
for stem,*_ in SPECS:
 im=Image.open(DELIVERY/(stem+'-cover.png')).convert('RGB');im.thumbnail((285,490));thumbs.append(im)
sheet=Image.new('RGB',(5*313,546),'#edece6')
for i,im in enumerate(thumbs):sheet.paste(im,(i*313+(313-im.width)//2,24))
sheet.save(DELIVERY/'collection-review.jpg',quality=94)
print(json.dumps(report,indent=2))
