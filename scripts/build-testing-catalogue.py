"""Build ten short illustrated books and their true three-page samples.

Manuscripts live in private/catalogue-expansion, never in the public build.
Artwork is original vector composition. Existing editions are not modified.
"""
from pathlib import Path
import json,math,re,fitz
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];PRIVATE=R/'private/catalogue-expansion';OUT=PRIVATE/'pdf';MEDIA=R/'public/editorial-media';DEL=Path('/workspace/outputs/OPortals-Catalogue-Expansion')
for p in [OUT,MEDIA,DEL]:p.mkdir(parents=True,exist_ok=True)
BOOKS=json.loads((PRIVATE/'originals.json').read_text())+json.loads((PRIVATE/'reimagined.json').read_text())
FONTS={'display':R/'public/design-fonts/Anton-Regular.ttf','body':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'),'bold':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'),'italic':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Italic.ttf'),'logo':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')}
FF={k:fitz.Font(fontfile=str(p)) for k,p in FONTS.items()};INK='#202e37';NAVY='#19324b';MUTED='#65747b';LINE='#dce3e5';WHITE='#ffffff';OLIVE='#68734b'
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def wrap(t,w,size,k):
 ls=[];line=''
 for word in t.split():
  nxt=(line+' '+word).strip()
  if line and FF[k].text_length(nxt,fontsize=size)>w:ls.append(line);line=word
  else:line=nxt
 if line:ls.append(line)
 return ls
def txt(p,t,x,y,w,size=11,k='body',color=INK,leading=None):
 ls=wrap(t,w,size,k);lead=leading or size*1.48
 p.insert_font(fontname='New'+k,fontfile=str(FONTS[k]))
 for line in ls:p.insert_text((x,y+size),line,fontname='New'+k,fontsize=size,color=rgb(color));y+=lead
 assert y<695,(p.number,t[:45],y)
 return y

def center(p,t,y,w=360,size=11,k='body',color=INK):
 ls=wrap(t,w,size,k);p.insert_font(fontname='New'+k,fontfile=str(FONTS[k]))
 for line in ls:p.insert_text(((420-FF[k].text_length(line,fontsize=size))/2,y+size),line,fontname='New'+k,fontsize=size,color=rgb(color));y+=size*1.3
 return y

def rect(p,r,fill=WHITE,stroke=LINE,width=.7,radius=.06):p.draw_rect(fitz.Rect(r),color=rgb(stroke),fill=rgb(fill),width=width,radius=radius)
def line(p,a,b,color=LINE,width=1):p.draw_line(a,b,color=rgb(color),width=width)
def circle(p,x,y,r,fill,stroke=None,width=1):p.draw_circle((x,y),r,color=rgb(stroke or fill),fill=rgb(fill),width=width)
def path(p,points,fill,stroke=None,width=1,close=True):
 s=p.new_shape();s.draw_polyline(points);s.finish(color=rgb(stroke or fill),fill=rgb(fill) if close else None,width=width,closePath=close);s.commit()
def logo(p,y=28,centered=False):
 size=12;full=FF['logo'].text_length('OPortals.com',fontsize=size);x=(420-full)/2 if centered else 30
 txt(p,'O',x,y-12,30,size,'logo',OLIVE);txt(p,'Portals.com',x+FF['logo'].text_length('O',fontsize=size),y-12,180,size,'logo','#181c1e')
def shell(d,b,n,marker):
 p=d.new_page(width=420,height=720);logo(p);txt(p,marker.upper(),282,19,108,6.3,'bold',b['accent']);line(p,(30,43),(390,43));txt(p,b['title'],30,695-13,320,7,'body',MUTED);txt(p,f'{n:02}',372,681,30,8,'bold',b['accent']);return p

def symbol(p,b,r):
 # Distinct conceptual cover symbols, with the same restrained editorial linework.
 x0,y0,x1,y1=r;cx=(x0+x1)/2;cy=(y0+y1)/2;u=min(x1-x0,y1-y0)/220;A=b['accent'];T=b['tint'];N=NAVY
 def pt(x,y):return(cx+x*u,cy+y*u)
 def c(x,y,z,f,s=None):xx,yy=pt(x,y);circle(p,xx,yy,z*u,f,s)
 def l(a,z,col=N,w=2):line(p,pt(*a),pt(*z),col,w*u)
 def box(a,z,fill,stroke=None):rect(p,(*pt(*a),*pt(*z)),fill,stroke or fill,1*u,.02)
 def poly(ps,f,s=None):path(p,[pt(*q) for q in ps],f,s,1.4*u)
 c(0,0,104,T)
 art=b['art']
 if art=='door':
  box((-55,-80),(38,86),N);box((-44,-69),(29,86),WHITE);poly([(-38,-65),(15,-83),(15,88),(-38,67)],A);c(4,8,3,'#e8c568');l((-81,87),(86,87));poly([(29,86),(91,108),(15,108),(-38,67)],'#e9dcae')
 elif art=='mirror':
  box((-80,-64),(-10,65),WHITE,LINE);box((10,-64),(80,65),WHITE,LINE);c(-45,-12,24,N);c(45,-12,24,A);poly([(-71,60),(-67,22),(-44,5),(-21,22),(-19,60)],N);poly([(19,60),(22,22),(45,5),(68,22),(71,60)],A);l((-2,-91),(-2,91),A);l((-14,-89),(-2,-99),A);l((-2,-99),(12,-90),A)
 elif art=='bowl':
  poly([(-83,8),(83,8),(65,59),(32,80),(-32,80),(-65,59)],A);l((-84,8),(84,8),N);l((0,7),(0,-74),N);poly([(0,-33),(-42,-49),(-35,-79),(-8,-67)],'#9ba66a');poly([(0,-56),(29,-88),(52,-81),(39,-49)],'#c5ad57');poly([(0,-5),(36,-28),(55,-12),(27,8)],'#a2b388');c(-48,-8,5,'#d8bf70')
 elif art=='river':
  poly([(-91,-91),(-12,-91),(24,-47),(-12,-5),(22,37),(-14,94),(-91,94)],'#b9d6e7');poly([(43,-91),(91,-91),(91,94),(15,94),(48,36),(12,-5),(48,-47)],A);l((-51,4),(57,4),N,5);l((-51,-12),(57,-12),N,2);l((-43,-22),(-43,15),N);l((49,-22),(49,15),N);c(4,-35,11,'#d6b357');l((4,-23),(4,-1),N,3)
 elif art=='sun':
  c(15,-20,61,'#d5b75e');poly([(-95,56),(-53,-5),(-6,35),(38,-28),(95,55)],A);poly([(-95,57),(-50,34),(-5,62),(46,20),(95,56),(95,88),(-95,88)],N);l((-90,91),(90,91),A)
 elif art=='circles':
  c(0,0,94,WHITE,A);c(0,0,65,T,A);c(0,0,35,A);l((0,-109),(0,-80),N);l((78,-78),(61,-61),N);l((111,0),(83,0),N);c(0,0,6,'#d9b65b');l((-100,99),(-35,35),N,1)
 elif art=='garden':
  box((-65,24),(64,42),N);poly([(-54,42),(53,42),(39,89),(-40,89)],A);l((0,24),(0,-69),N);poly([(0,-34),(-43,-61),(-61,-37),(-19,-10)],A);poly([(0,-58),(35,-87),(59,-62),(24,-34)],'#b3ba75');c(73,-75,18,'#d4b563');l((-77,90),(78,90),N)
 elif art=='lamp':
  c(0,-28,57,'#eadcc0');c(0,-28,35,WHITE,N);l((-17,4),(-17,31),N,3);l((17,4),(17,31),N,3);box((-20,31),(20,43),A);l((-13,51),(13,51),N,3);l((0,58),(0,90),A,2);l((-77,-27),(-95,-27),A);l((77,-27),(95,-27),A);l((0,-103),(0,-91),A);center(p,'?',cy-66*u,w=360,size=53*u,k='display',color=A)
 elif art=='scales':
  l((0,-77),(0,75),N,4);poly([(-29,89),(29,89),(18,72),(-18,72)],A);l((-77,-40),(77,-40),N,3);c(0,-40,8,'#d5b75e');l((-65,-40),(-85,17),A);l((-65,-40),(-45,17),A);poly([(-94,17),(-37,17),(-49,39),(-80,39)],N);l((65,-40),(44,17),A);l((65,-40),(86,17),A);poly([(36,17),(94,17),(80,39),(50,39)],A)
 else:
  box((-56,-85),(56,-73),N);box((-56,75),(56,87),N);path(p,[pt(-43,-73),pt(43,-73),pt(34,-31),pt(6,0),pt(34,31),pt(43,75),pt(-43,75),pt(-34,31),pt(-6,0),pt(-34,-31)],WHITE,N,2*u);poly([(-30,-49),(30,-49),(0,-9)],A);poly([(-31,66),(31,66),(0,30)],'#d5b75e');l((0,0),(0,23),A,1)

def diagram(p,b,labels,mode,r):
 x0,y0,x1,y1=r;w=x1-x0;h=y1-y0;A=b['accent'];T=b['tint'];rect(p,r,'#fafbf9',LINE,.6,.025)
 centers=[(x0+w*.19,y0+h*.5),(x0+w*.50,y0+h*.5),(x0+w*.81,y0+h*.5)]
 if mode%4==1:centers=[(x0+w*.20,y0+h*.50),(x0+w*.73,y0+h*.28),(x0+w*.73,y0+h*.73)]
 if mode%4==2:centers=[(x0+w*.22,y0+h*.28),(x0+w*.50,y0+h*.51),(x0+w*.79,y0+h*.74)]
 for j in range(2):
  a,z=centers[j],centers[j+1];line(p,a,z,A,1.2);dx=z[0]-a[0];dy=z[1]-a[1];dist=math.hypot(dx,dy);ux=dx/dist;uy=dy/dist;mx=a[0]+dx*.62;my=a[1]+dy*.62
  path(p,[(mx-ux*5-uy*3,my-uy*5+ux*3),(mx,my),(mx-ux*5+uy*3,my-uy*5-ux*3)],A)
 for i,((cx,cy),label) in enumerate(zip(centers,labels)):
  ww=w*.245;ss=8.2
  while len(wrap(label,ww-12,ss,'bold'))>3:ss-=.3
  ls=wrap(label,ww-12,ss,'bold');hh=max(46,len(ls)*ss*1.4+18);rect(p,(cx-ww/2,cy-hh/2,cx+ww/2,cy+hh/2),A if i==2 else WHITE,A if i==2 else '#cdd8d8',.8,.055)
  txt(p,label,cx-ww/2+6,cy-len(ls)*ss*1.4/2,ww-12,ss,'bold',WHITE if i==2 else NAVY,ss*1.4)

def margin(p,b,head,body,y):
 line(p,(313,y),(313,y+10),b['accent'],2);y=txt(p,head,322,y,68,7.5,'bold',b['accent'])+8
 return txt(p,body,322,y,68,9,'body',NAVY)

def cover(d,b):
 p=d.new_page(width=420,height=720);logo(p,38,True);center(p,'AN OPORTALS ORIGINAL' if b['category']=='original' else 'AN INDEPENDENT OPORTALS COMPANION',65,size=7.5,k='bold',color=b['accent'])
 size=54;title=b['title']
 while len(wrap(title,355,size,'display'))>3 or len(wrap(title,355,size,'display'))*size*1.3>178:size-=1
 y=center(p,title,99,size=size,k='display',color='#111b23');assert y<301
 if b['author']:center(p,'READING '+b['author'].upper(),y+9,size=8,k='bold',color=b['accent'])
 symbol(p,b,(72,307,348,548));center(p,b['subtitle'],578,w=342,size=12,color=NAVY)
 line(p,(65,666),(355,666));center(p,'ILLUSTRATED IDEAS · ORDINARY SITUATIONS · QUESTIONS TO KEEP',682,size=6.8,k='bold',color=MUTED)

def intro(d,b):
 p=shell(d,b,2,'Begin here');y=txt(p,'One idea. A real day.',30,67,360,31,'display',NAVY)+18
 y=txt(p,b['intro'],30,y,276,11)+16;margin(p,b,'READ SLOWLY','You do not need to use every idea. Start with the question that meets your day.',121)
 y=txt(p,'HOW TO USE THIS BOOK',30,y,276,8,'bold',b['accent'])+9
 for title,body in [('Notice','Read the idea and its diagram. What distinction does it make visible?'),('Try','Use the worked situation as an example, then adapt the small practice to your own circumstances.'),('Return','Keep one question. Revisit what happened before deciding whether the practice helped.')]:
  y=txt(p,title,30,y,276,12,'bold',NAVY)+4;y=txt(p,body,30,y,276,10.5)+12
 y=txt(p,'Eight ideas, eight worked situations, a seven-day field guide and a reusable reflection sheet. This is a short illustrated book; it invites reflection rather than promising a particular personal result.',30,y,276,10,'italic',MUTED)
 assert y<655

def contents(d,b):
 p=shell(d,b,3,'Reading map');y=txt(p,'Find your question.',30,68,360,34,'display',NAVY)+22
 links=[]
 for i,c in enumerate(b['chapters']):
  rect(p,(30,y,390,y+48),b['tint'] if i%2==0 else WHITE,LINE,.55,.03)
  txt(p,f'{i+1:02}',42,y+12,26,10,'bold',b['accent']);txt(p,c['title'],79,y+10,263,11,'bold',INK);txt(p,str(4+i*2),365,y+12,24,9,'bold',b['accent']);links.append((fitz.Rect(30,y,390,y+48),3+i*2));y+=58
 txt(p,'You can read in order or enter through a question. Tap a chapter to open it. The field guide begins on page 20; reading references are on page 22.',30,y+8,360,10,'body',MUTED)
 return links

def reading(d,b,c,i):
 p=shell(d,b,4+i*2,f'Idea {i+1:02} / Read');y=txt(p,c['title'],30,65,360,29,'display',NAVY,34)+16
 y=txt(p,c['body'],30,y,276,11,'body',INK,15)+17
 side=margin(p,b,'A DISTINCTION TO KEEP',c['note'],145)
 if c['ref']:margin(p,b,'READ ALONG',c['ref'],max(side+30,330))
 diagram(p,b,c['labels'],i,(30,y,306,y+140));y+=154
 txt(p,'READ THE RELATIONSHIP',30,y,276,7.7,'bold',b['accent']);y+=18
 y=txt(p,'Start with '+c['labels'][0].lower()+'. Notice how '+c['labels'][1].lower()+' changes the way you understand '+c['labels'][2].lower()+'. The diagram is a way to hold the distinction, not proof that life follows a fixed sequence.',30,y,276,10,'body',MUTED)+16
 rect(p,(30,y,306,y+58),b['tint'],LINE,.6,.02);txt(p,c['question'],42,y+10,252,10.5,'bold',b['accent']);assert y+58<665,(b["slug"],c["title"],y)

def application(d,b,c,i):
 p=shell(d,b,5+i*2,f'Idea {i+1:02} / Try');y=txt(p,'Bring it into your day.',30,65,360,29,'display',NAVY,35)+16
 y=txt(p,'AN ORDINARY SITUATION',30,y,276,8,'bold',b['accent'])+10;y=txt(p,c['scene'],30,y,276,12)+20
 margin(p,b,'ADAPT','Your circumstances matter.',130)
 rect(p,(30,y,390,y+110),b['tint'],LINE,.65,.025);txt(p,'TRY IT TODAY',43,y+13,330,8,'bold',b['accent']);txt(p,c['practice'],43,y+35,330,12,'body',NAVY);y+=130
 y=txt(p,'A question to carry',30,y,360,20,'display',NAVY)+10;y=txt(p,c['question'],30,y,360,12,'italic',b['accent'])+24
 for label,prompt in [('NOTICE','Describe the particular situation before judging it.'),('CHOOSE','What is one proportionate next action?'),('RETURN','What would tell you whether the change helped?')]:
  rect(p,(30,y,390,y+55),WHITE,LINE,.6,.02);txt(p,label,42,y+8,64,7.5,'bold',b['accent']);txt(p,prompt,117,y+7,258,9.5,'body',MUTED);line(p,(117,y+43),(375,y+43),'#dfe5e5',.5);y+=62
 assert y<665,(b["slug"],c["title"],y)

def fieldguide(d,b):
 p=shell(d,b,20,'Seven-day field guide');y=txt(p,'A week of small experiments.',30,63,360,30,'display',NAVY)+14
 y=txt(p,'Choose a modest situation. These are invitations, not daily tests. Skip, repeat or adapt a practice when that is more appropriate.',30,y,360,11)+17
 for i in range(7):
  c=b['chapters'][i];ls=wrap(c['practice'],282,10,'body');hh=max(54,len(ls)*14+23);rect(p,(30,y,390,y+hh),b['tint'] if i%2==0 else WHITE,LINE,.55,.02);txt(p,f'DAY {i+1}',42,y+12,49,8,'bold',b['accent']);txt(p,c['practice'],96,y+10,282,10);y+=hh+9
 txt(p,'After the week: what became clearer, what did not fit, and what will you keep? A useful result may be a better question rather than a dramatic change.',30,y+4,360,10,'italic',MUTED)

def worksheet(d,b):
 p=shell(d,b,21,'A reusable reflection sheet');y=txt(p,'Keep one useful question.',30,66,360,31,'display',NAVY)+14
 y=txt(p,'Use a real situation. You can write in a notebook or print this page. Return after taking one action; keep the account specific.',30,y,360,11)+20
 prompts=[('01 / THE SITUATION','What happened? Separate observation from interpretation.'),('02 / THE DISTINCTION',b['chapters'][0]['question']),('03 / THE PEOPLE','Who is affected, and which responsibility or constraint matters?'),('04 / THE NEXT STEP','What is one action within your practical reach?'),('05 / THE RETURN','What happened after you tried it? What remains uncertain?')]
 for head,prompt in prompts:
  rect(p,(30,y,390,y+82),WHITE,LINE,.6,.02);txt(p,head,42,y+9,333,8,'bold',b['accent']);txt(p,prompt,42,y+29,333,10);line(p,(42,y+65),(378,y+65),'#dfe5e5',.5);y+=94
 txt(p,'A note can remain unfinished. The purpose is to make the next thought more usable.',30,y+1,360,9,'italic',MUTED)

def sources(d,b):
 p=shell(d,b,22,'Reading notes & credits');y=txt(p,'Go back to the source.',30,65,360,30,'display',NAVY)+15
 if b['category']=='inspired':
  y=txt(p,b['author']+' · '+b['source'],30,y,360,14,'bold',b['accent'])+12
  y=txt(p,'This book contains independently written OPortals explanations, examples, illustrations and exercises. It is not a translation, an authorised edition or a substitute for the source. No endorsement or affiliation is claimed. The ancient source works are public domain; rights in particular modern translations and editions can differ.',30,y,360,10.5)+17
  for i,c in enumerate(b['chapters']):y=txt(p,f"{i+1:02} · {c['ref']}",30,y,360,9.6)+6
  y+=8
  for ref in b['refs']:y=txt(p,ref,30,y,360,9.4,'italic',MUTED)+8
  y=txt(p,'OPEN THE SOURCE READING',30,y+7,360,8,'bold',b['accent'])+9
  start=y;y=txt(p,b['url'],30,y,360,8.5,'body',b['accent']);p.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(30,start,390,y+3),'uri':b['url']});y+=19
 else:
  y=txt(p,'Original writing, examples, exercises and vector illustrations: OPortals.',30,y,360,12,'bold',b['accent'])+17
  y=txt(p,'These essays begin with contemporary situations and develop OPortals questions for reflection. They are not quotations or summaries of a single philosopher. Where a practice resembles a philosophical tradition, the resemblance should be an invitation to further reading rather than a claim that an ancient writer endorsed the modern example.',30,y,360,11)+20
  for ref in ['Epictetus, Enchiridion 1 and 4: judgment, choice and preparation.','Aristotle, Nicomachean Ethics II and VI: habits and practical judgment.','Plato, Apology 20c–23b and 38a: inquiry and examination.']:
   y=txt(p,ref,30,y,360,10.5)+13
  y=txt(p,'Further reading provides points of comparison, not the source of unmarked quotations. Consult an edition with an introduction and notes, and distinguish the historical argument from its contemporary application.',30,y,360,10.5,'italic',MUTED)+20
 y=txt(p,'A perspective, not a promise',30,y,360,16,'display',NAVY)+9
 y=txt(p,'Use these questions alongside practical support and appropriate professional advice where needed. A book cannot determine what is safe or right in every personal circumstance, and no particular outcome is guaranteed.',30,y,360,10)+16
 txt(p,'OPortals.com · Philosophy made simple, visual and practical.',30,y,360,9,'bold',b['accent'])

catalogue=[];report=[];cover_images=[]
for b in BOOKS:
 assert len(b['chapters'])==8
 d=fitz.open();cover(d,b);intro(d,b);toc=contents(d,b)
 for i,c in enumerate(b['chapters']):reading(d,b,c,i);application(d,b,c,i)
 fieldguide(d,b);worksheet(d,b);sources(d,b);assert len(d)==22
 for rr,n in toc:d[2].insert_link({'kind':fitz.LINK_GOTO,'from':rr,'page':n,'to':fitz.Point(0,0)})
 d.set_metadata({'title':b['title'],'author':'OPortals','subject':b['subtitle']+(' Independent commentary on '+b['author']+'; not a translation.' if b['author'] else ''),'keywords':'illustrated philosophy, everyday life, reflection','creator':'OPortals editorial studio'});d.subset_fonts();full=OUT/(b['slug']+'.pdf');d.save(full,garbage=4,deflate=True,clean=True)
 sample=fitz.open();selected=[1,4,5]
 for n in selected:sample.insert_pdf(d,from_page=n-1,to_page=n-1,links=False)
 sample.set_metadata({'title':b['title']+' — Three-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'});sample.save(OUT/(b['slug']+'-sample.pdf'),garbage=4,deflate=True)
 doc=fitz.open(full);alltext=' '.join(p.get_text() for p in doc);wordcount=len(re.findall(r'\b\w+\b',alltext));assert wordcount>1400,(b['slug'],wordcount)
 # Visible/selectable type remains within the page; figures and notes fit fixed envelopes.
 for p in doc:
  for block in p.get_text('dict')['blocks']:
   if 'lines' not in block:continue
   for ll in block['lines']:
    for sp in ll['spans']:assert fitz.Rect(0,0,421,721).contains(fitz.Rect(sp['bbox'])),(b['slug'],p.number,sp['text'],sp['bbox'])
 imgs=[]
 for n in selected:
  pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);name='testing-collection-'+b['slug']+('-cover' if n==1 else '-page-'+str(n))+'.webp';im.save(MEDIA/name,'WEBP',quality=86,method=6);imgs.append({'src':'/Testing/media/'+name,'page':n})
  if n==1:cover_images.append(im.copy())
 for f in [b['slug']+'.pdf',b['slug']+'-sample.pdf']:(DEL/f).write_bytes((OUT/f).read_bytes())
 c0=b['chapters'][0];catalogue.append(dict(id='new-'+b['slug'],slug=b['slug'],title=b['title'],category=b['category'],subtitle=b['subtitle'],author=b['author'],source=b['url'],sourceTitle=b['source'],topic=b['subtitle'].split(',')[0].upper(),price=7.99,pageCount=22,completed=True,checkoutPending=True,pdf='/Testing/books/'+b['slug']+'.pdf',samplePdf='/Testing/books/'+b['slug']+'-sample.pdf',cover=imgs[0]['src'],actualPages=imgs,facts=dict(benefits=[b['chapters'][i]['practice'] for i in [0,3,6]],ideas=[b['chapters'][i]['title'] for i in [0,3,6]],everyday=b['intro'],theme=b['source'] if b['author'] else b['subtitle']),captions=['Cover',c0['title'],'Bring it into your day']))
 report.append(dict(slug=b['slug'],pages=22,samplePages=3,words=wordcount,bytes=full.stat().st_size,chapters=8,links=len(doc[2].get_links()),sourceReferences=sum(bool(c['ref']) for c in b['chapters'])))
 print(b['slug']+': 22 pages / '+str(wordcount)+' words / three-page sample')
(R/'src/testing-catalogue.json').write_text(json.dumps(catalogue,ensure_ascii=False,separators=(',',':')))
(PRIVATE/'quality-report.json').write_text(json.dumps(report,indent=2));(DEL/'quality-report.json').write_text(json.dumps(report,indent=2))
# A quick contact sheet for visual inspection, generated from the actual PDFs.
sheet=Image.new('RGB',(1500,1120),'#f0f2ef');dr=ImageDraw.Draw(sheet)
for i,im in enumerate(cover_images):
 im.thumbnail((270,470));x=15+(i%5)*300;y=12+(i//5)*560;sheet.paste(im,(x+(270-im.width)//2,y));dr.text((x,y+480),catalogue[i]['title'][:35],fill='#183049')
sheet.save(DEL/'covers-contact-sheet.jpg',quality=92)
(DEL/'README.txt').write_text('Ten new OPortals short illustrated books. Each complete edition has 22 pages, eight ideas, worked situations, a seven-day field guide, a reflection sheet and credits. Each sample has three actual pages. Four are Originals; six are independent companions to credited ancient sources, not translations. Testing review only: planned price $7.99 USD per new title; new checkout links are not connected. Existing published books are unchanged.\n')
print('All ten books and samples built; existing editions untouched.')
