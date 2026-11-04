"""Render social/search preview cards from the existing approved covers/art."""
from pathlib import Path
from io import BytesIO
import json,fitz
from PIL import Image
R=Path(__file__).resolve().parents[1];meta=json.loads((R/'private/seo-pages-meta.json').read_text());books={b['slug']:b for b in json.loads((R/'private/artwork-edition/verification-report.json').read_text())}
FONTS={'display':R/'public/design-fonts/Anton-Regular.ttf','body':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'),'bold':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'),'logo':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')};FF={k:fitz.Font(fontfile=str(v)) for k,v in FONTS.items()}
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def wrap(text,width,size,key):
 lines=[];line=''
 for word in text.split():
  new=(line+' '+word).strip()
  if line and FF[key].text_length(new,fontsize=size)>width:lines.append(line);line=word
  else:line=new
 if line:lines.append(line)
 return lines
def put(p,text,x,y,width,size,key='body',color='#192b3a',leading=None):
 for line in wrap(text,width,size,key):p.insert_text((x,y+size),line,fontname='Seo'+key,fontsize=size,color=rgb(color));y+=leading or size*1.3
 return y
made=set()
for path,record in meta.items():
 name=record['image'].rsplit('/',1)[-1]
 if name in made:continue
 made.add(name);doc=fitz.open();p=doc.new_page(width=1200,height=630)
 for key,file in FONTS.items():p.insert_font(fontname='Seo'+key,fontfile=str(file))
 p.insert_text((52,63),'O',fontname='Seologo',fontsize=29,color=rgb('#68734b'));p.insert_text((52+FF['logo'].text_length('O',fontsize=29),63),'Portals.com',fontname='Seologo',fontsize=29,color=rgb('#161c21'))
 book=books.get(path.rsplit('/',1)[-1]) if path.startswith('/book/') else None
 if book:
  title=record['graph']['@graph'][1]['name'];size=72
  while len(wrap(title,660,size,'display'))>3:size-=2
  y=put(p,title,52,112,660,size,'display',leading=size*1.22)+24
  desc=record['description'];ds=26
  while len(wrap(desc,630,ds,'body'))>4:ds-=1
  put(p,desc,52,y,630,ds,'body','#56636a');price=record['graph']['@graph'][1]['offers']['price']
  put(p,'$'+price+' USD · Read a 3-page sample',52,551,660,22,'bold','#53623f')
  cover=fitz.open(R/'private/artwork-edition'/book['file']);p.show_pdf_page(fitz.Rect(775,40,1147,591),cover,0,keep_proportion=True)
 else:
  if path=='/SocialMirror':title='How do your\nfriends see you?';image='testing-collection-character-mirror.webp';desc='Six questions. Five friends. Your free results card.'
  elif path.startswith('/ideas'):
   title={'attention':'Make room for\nwhat matters.','choices':'A thought is\nnot yet a fact.','leadership':'Lead with\nclearer thinking.','meaning':'What makes\na life feel enough?'}.get(path.rsplit('/',1)[-1],'A fresh\nperspective.');week=path.rsplit('/',1)[-1];image={'attention':'testing-collection-character-room.webp','choices':'testing-collection-character-revision.webp','leadership':'testing-collection-character-lead.webp','meaning':'testing-collection-character-enough.webp'}.get(week,'testing-collection-character-room.webp');desc='Illustrated philosophy. Practical questions for everyday life.'
  else:title='Philosophy for\neveryday life.';image='editorial-social-attention-symbol.webp';desc='Illustrated books, thoughtful questions and a fresh perspective.'
  y=128
  for line in title.split('\n'):y=put(p,line,52,y,660,82,'display',leading=101)
  put(p,desc,52,y+23,635,27,'body','#56636a');put(p,'Simple. Visual. Practical.',52,552,660,22,'bold','#53623f')
  art=R/'public/published-editorial-media'/image;buf=BytesIO();Image.open(art).save(buf,'PNG');p.insert_image(fitz.Rect(746,120,1168,520),stream=buf.getvalue(),keep_proportion=True)
 pix=p.get_pixmap(alpha=False);im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
 for folder in ['editorial-media','published-editorial-media']:im.save(R/'public'/folder/name,'WEBP',quality=89,method=6)
print('Rendered',len(made),'sharing images at 1200 × 630 using approved artwork and covers.')
