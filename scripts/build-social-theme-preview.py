"""One cover and two interior pages in the OPortals social-post language.

All other pages and all words remain those of the approved edition.
Artwork arguments are imagegen outputs; compositing preserves selectable type.
"""
from pathlib import Path
from collections import Counter
from io import BytesIO
import fitz,re,json,sys
from PIL import Image

R=Path(__file__).resolve().parents[1]
BASE=R/'private/checkpoints/before-social-theme/art-of-attention.pdf'
OUT=R/'private/publishing-preview'
DEL=Path('/workspace/outputs/OPortals-Social-Theme-Preview');DEL.mkdir(exist_ok=True)
FONT={'display':R/'public/design-fonts/Anton-Regular.ttf',
 'body':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'),
 'bold':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'),
 'logo':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')}
INK='#111a22';NAVY='#152e4d';BLUE='#245389';CYAN='#cfe8f1';OLIVE='#68734b';GREY='#68737a'
MAIN=276.8;SIDE=69.2;SX=320.8
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def font(p,k):
 name='SocialBook'+k;p.insert_font(fontname=name,fontfile=str(FONT[k]));return name
def width(t,size,k):return fitz.Font(fontfile=str(FONT[k])).text_length(t,fontsize=size)
def wrap(t,w,size,k):
 lines=[];line=''
 for word in t.split():
  nxt=(line+' '+word).strip()
  if line and width(nxt,size,k)>w:lines.append(line);line=word
  else:line=nxt
 if line:lines.append(line)
 return lines
def text(p,t,x,y,w,size=10.8,k='body',c=INK,leading=None):
 for line in wrap(t,w,size,k):p.insert_text((x,y+size),line,fontname=font(p,k),fontsize=size,color=rgb(c));y+=leading or size*1.4
 return y
def center(p,t,y,size,k='body',c=INK):
 p.insert_text(((420-width(t,size,k))/2,y+size),t,fontname=font(p,k),fontsize=size,color=rgb(c))
def logo(p,y=25,size=12,centered=False):
 a=width('O',size,'logo');b=width('Portals.com',size,'logo');x=(420-a-b)/2 if centered else 30
 p.insert_text((x,y),'O',fontname=font(p,'logo'),fontsize=size,color=rgb(OLIVE))
 p.insert_text((x+a,y),'Portals.com',fontname=font(p,'logo'),fontsize=size,color=rgb('#111111'))
def picture(p,path,r,clip):
 # PDF clipping trims the illustration's white canvas, without changing the art.
 im=Image.open(path).convert('RGB');buf=BytesIO();im.save(buf,'JPEG',quality=94,optimize=True)
 art=fitz.open();q=art.new_page(width=im.width,height=im.height);q.insert_image(q.rect,stream=buf.getvalue())
 p.show_pdf_page(r,art,0,clip=fitz.Rect(clip),keep_proportion=True)
def running(p,n):
 logo(p,29,10)
 p.insert_text((390-width('WHAT GETS THROUGH',7,'bold'),29),'WHAT GETS THROUGH',fontname=font(p,'bold'),fontsize=7,color=rgb(GREY))
 p.draw_line((30,43),(390,43),color=rgb('#d8e0e5'),width=.5)
 p.insert_text((30,p.rect.height-18),'The Art of Attention',fontname=font(p,'body'),fontsize=7,color=rgb(GREY))
 p.insert_text((390-width(str(n).zfill(2),8,'bold'),p.rect.height-18),str(n).zfill(2),fontname=font(p,'bold'),fontsize=8,color=rgb(NAVY))
def margin(p,head,body,y):
 start=y
 if head:y=text(p,head,SX,y,SIDE,7.6,'bold',BLUE)+8
 y=text(p,body,SX,y,SIDE,9.6,'body',NAVY)
 p.draw_line((SX-7,start),(SX-7,y),color=rgb('#aac6d5'),width=.8)
 return y
def captions(p,items,y):
 end=y
 for i,item in enumerate(items):
  x=30+i*124;p.draw_line((x,y),(x+22,y),color=rgb('#8aaec1'),width=1)
  end=max(end,text(p,item,x,y+8,112,9.3,'body',NAVY))
 return end+12
def cover(path):
 d=fitz.open();p=d.new_page(width=420,height=720);logo(p,39,16,True)
 center(p,'PHILOSOPHY FOR EVERYDAY LIFE',76,8,'bold',GREY)
 center(p,'The Art of',111,54,'display','#10151b');center(p,'Attention',176,82,'display','#10151b')
 center(p,'AN OPORTALS ORIGINAL',281,8,'bold',OLIVE)
 picture(p,path,fitz.Rect(28,319,392,568),(20,210,1234,1040))
 center(p,'Make room for what deserves your attention.',614,12,'body',NAVY)
 p.draw_line((70,668),(350,668),color=rgb('#d8e0e5'),width=.6)
 center(p,'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE',690,7,'bold',GREY)
 return d
def interior(n,path):
 source=fitz.open(BASE);s=source[n-1];d=fitz.open();p=d.new_page(width=420,height=s.rect.height);running(p,n)
 if n==5:
  marker='CHAPTER 01';title='What gets through';sub='Attention is the doorway into experience.'
  paras=['You open a book and notice, a moment later, that you have been reading the same paragraph without receiving it. The page was before you; your attention was elsewhere. This ordinary experience reveals a distinction worth keeping: being exposed to something is not the same as meeting it. Attention selects which parts of the world become vivid enough to guide thought and action. We begin with that doorway, before turning to habits or productivity.']
  cap=['A possible demand','Attention selects','Experience takes shape'];nh='';note='A world can be available without becoming part of your experience.'
 else:
  marker='ONE IDEA / CONNECT IT TO YOUR LIFE';title='A room full of possible worlds';sub=''
  paras=['A room contains more than any one person can notice: a conversation, a change in light, the discomfort of a chair, an unfinished thought. Where attention goes, a particular version of the room becomes present. This selection is necessary; receiving every detail equally would make purposeful action difficult.',
  'The philosophical question is not how to eliminate selection. It is how to notice its direction. Are you attending because you chose to, because someone needs you, or because a signal successfully interrupted you? These reasons can overlap. A child calling for help may deserve an immediate response; a notification may only imitate that urgency. Begin with curiosity about the difference. You are examining a relationship with experience, not diagnosing a defective mind.']
  cap=['Many details in view','A selected detail','The experience you notice'];nh='TAKE THIS INTO YOUR DAY';note='Describe a familiar place using five details you usually pass without noticing.'
 y=text(p,marker,30,59,360,7.7,'bold',OLIVE)+9
 y=text(p,title,30,y,360,34 if n==5 else 31,'display','#10151b',leading=36)+10
 if sub:y=text(p,sub,30,y,360,12,'body',NAVY)+10
 if n==5:
  picture(p,path,fitz.Rect(89,y,331,y+149),(20,210,1234,1040));y+=158
 else:
  picture(p,path,fitz.Rect(30,y,390,y+164),(55,190,1485,865));y+=172
 y=captions(p,cap,y);top=y
 for i,t in enumerate(paras):
  if i:y+=9
  y=text(p,t,30,y,MAIN,10.8,'body',INK)
 end=max(y,margin(p,nh,note,top))
 assert end<p.rect.height-42,(n,'layout needs more room',end,p.rect.height)
 assert words(p)==words(s),(n,words(s)-words(p),words(p)-words(s))
 return d
def build(focus,room):
 base=fitz.open(BASE);doc=fitz.open(BASE);new={0:cover(focus),4:interior(5,focus),5:interior(6,room)}
 for idx,d in new.items():
  p=doc[idx];assert words(d[0])==words(base[idx]),(idx,'preserved wording')
  p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,d,0)
 dest=OUT/'art-of-attention.pdf';doc.subset_fonts();doc.save(dest,garbage=4,clean=True,deflate=True);doc=fitz.open(dest)
 for i,p in enumerate(doc):
  assert words(p)==words(base[i]),(i+1,'book words')
  assert len(p.get_links())==len(base[i].get_links()),(i+1,'navigation')
  if i not in new:assert p.get_pixmap().samples==base[i].get_pixmap().samples,(i+1,'unchanged page pixels')
 sample=fitz.open()
 for n in [1,5,6,7]:sample.insert_pdf(doc,from_page=n-1,to_page=n-1,links=False)
 sample.set_metadata({'title':'The Art of Attention — Four-page sample','author':'OPortals','subject':'New social-theme cover and two redesigned pages; remaining page retains the current edition.'})
 sample.save(OUT/'art-of-attention-sample.pdf',garbage=4,deflate=True)
 preview=fitz.open()
 for n in [1,5,6]:preview.insert_pdf(doc,from_page=n-1,to_page=n-1,links=False)
 preview.set_metadata({'title':'OPortals — Social theme design preview','author':'OPortals'})
 preview.save(DEL/'Social-Theme-Design-Preview.pdf',garbage=4,deflate=True)
 for f in ['art-of-attention.pdf','art-of-attention-sample.pdf']:(DEL/f).write_bytes((OUT/f).read_bytes())
 (DEL/'Anton-OFL.txt').write_bytes((R/'public/design-fonts/Anton-OFL.txt').read_bytes())
 for n in [1,5,6]:
  pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(1.8,1.8),alpha=False);Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(DEL/('attention-'+str(n)+'.png'))
 print(json.dumps({'bookPages':len(doc),'samplePages':len(sample),'redesignedPages':[1,5,6],'allWordingPreserved':True,'other29PagesPixelIdentical':True}))
if __name__=='__main__':build(Path(sys.argv[1]),Path(sys.argv[2]))
