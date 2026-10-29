"""Testing-only 80/20 reading edition, using the authoritative PDF text.

The wide column holds continuous prose; the narrow column holds an existing
reflection. Longer examples and writing prompts span both columns. Covers and
front/back matter come from restored version 146, not the rejected revision.
"""
from pathlib import Path
from collections import Counter
from io import BytesIO
import importlib.util, json, re, sys
import fitz
from PIL import Image, ImageOps

R=Path(__file__).resolve().parents[1]
SRC=R/'private/refined-source'
BASE=R/'private/checkpoints/before-eighty-twenty'
OUT=R/'private/publishing-preview'
ART=R/'private/eighty-art'
DEL=Path('/workspace/outputs/OPortals-Eighty-Twenty');DEL.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('book_helpers',R/'scripts/build-refined-editions.py')
B=importlib.util.module_from_spec(spec);spec.loader.exec_module(B)
STEMS=B.STEMS
MAIN=276.8;SIDE=69.2;GAP=14;X=30;SX=X+MAIN+GAP
INK=B.INK;OLIVE=B.OLIVE;BLUE=B.BLUE;BORDER=B.BORDER
CHAPTERS={'art-of-attention':[5,9,13,17,21,25],'life-secrets':[5,9,13,17,21,25],
 'man-and-people-guide':[5,11,17,23,29,35],'lead-without-the-noise':[5,7,9,10,13,17]}
SHEET={'art-of-attention':'attention','life-secrets':'life','man-and-people-guide':'man','lead-without-the-noise':'lead'}
SUPPORT={('art-of-attention',6):0,('art-of-attention',7):1,('life-secrets',9):2,
 ('life-secrets',25):3,('man-and-people-guide',19):4,('man-and-people-guide',36):5}

def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def spans(p):return B.spans(p)
def tx(b):return B.tx(b)
def text(p,t,x,y,w,size=10.8,kind='body',col=INK):
 return B.lines(p,B.wrap(t,w,size,kind),x,y,size,kind,col,leading=size*1.34)
def source_order(ss):return sorted(ss,key=lambda s:(round(s['bbox'][1],1),s['bbox'][0]))
def running(p,s,maps):B.running(p,s,maps)
def compact(d,s,end,maps):
 # Match the restored compact digital edition: no empty lower half added for
 # decoration. The text remains at its designed size; only the page tail moves.
 height=min(720,max(560,end+65));p=d[0]
 if height>=p.rect.height-8:return d,maps
 out=fitz.open();q=out.new_page(width=420,height=height)
 q.show_pdf_page(fitz.Rect(0,0,420,end+9),d,0,clip=fitz.Rect(0,0,420,end+9),keep_proportion=False)
 B.copy(q,s,fitz.Rect(0,s.rect.height-34,420,s.rect.height),fitz.Rect(0,height-34,420,height),[])
 maps=[(a,fitz.Rect(0,height-34,420,height) if a.y0>=s.rect.height-34 else b) for a,b in maps]
 return out,maps
def asset(stem,n):
 if (stem,n) in SUPPORT:return ART/('support-'+str(SUPPORT[(stem,n)])+'.jpg')
 if n in CHAPTERS.get(stem,[]):
  index={5:0,7:1,9:3,10:2,13:4,17:5}[n] if stem=='lead-without-the-noise' else CHAPTERS[stem].index(n)
  return ART/(SHEET[stem]+'-'+str(index)+'.jpg')
 return None
def picture(p,path,y,h):
 im=ImageOps.fit(Image.open(path).convert('RGB'),(1440,round(1440*h/360)),method=Image.Resampling.LANCZOS)
 buf=BytesIO();im.save(buf,'JPEG',quality=91,optimize=True)
 p.insert_image(fitz.Rect(30,y,390,y+h),stream=buf.getvalue());return y+h
def note(p,head,body,y,stem):
 accent,tint=B.COLORS[stem]
 h=max(43,23+len(B.wrap(body,336,10.5,'serif'))*14.5+(14 if head else 0))
 p.draw_rect(fitz.Rect(30,y,390,y+h),color=B.rgb(BORDER),fill=B.rgb(tint),width=.45)
 yy=y+9
 if head:yy=text(p,head,42,yy,336,7.7,'bold',accent)+5
 text(p,body,42,yy,336,10.5,'serif',accent)
 return y+h
def margin(p,head,body,y,stem):
 accent,tint=B.COLORS[stem]
 yy=y
 if head:yy=text(p,head,SX+1,yy,SIDE-2,7.2,'bold',accent)+8
 yy=text(p,body,SX+1,yy,SIDE-2,9.2,'serif',accent)
 p.draw_line((SX-6,y),(SX-6,max(y+30,yy)),color=B.rgb(BORDER),width=.7)
 return yy
def captions(p,ss,y):
 # Retain all explanatory words below new art, grouped by their original
 # columns instead of rebuilding a philosophical relationship from guesses.
 if not ss:return y
 centers=[(s['bbox'][0]+s['bbox'][2])/2 for s in ss]
 k=3 if any(170<c<250 for c in centers) and any(c<160 for c in centers) and any(c>260 for c in centers) else 2 if any(c<190 for c in centers) and any(c>230 for c in centers) else 1
 cols=[[] for _ in range(k)]
 for s in source_order(ss):
  c=min(k-1,max(0,int((((s['bbox'][0]+s['bbox'][2])/2)-30)/360*k)))
  cols[c].append(s['text'])
 w=(360-(k-1)*12)/k;bottom=y
 for i,col in enumerate(cols):
  if not col:continue
  xx=30+i*(w+12)
  p.draw_line((xx,y+2),(xx+min(24,w),y+2),color=B.rgb(BORDER),width=.7)
  bottom=max(bottom,text(p,' '.join(col),xx,y+9,w,9,'body','#586052'))
 return bottom+9

def parse(s):
 ss=spans(s);h=s.rect.height;blocks=[b for b in s.get_text('dict')['blocks'] if 'lines' in b]
 titles=[x for x in ss if x['size']>=18 and 55<x['bbox'][1]<180]
 if not titles:return None
 title_end=max(x['bbox'][3] for x in titles)
 markers=[x for x in ss if 55<x['bbox'][1]<90 and x['size']<8]
 heads=[x for x in ss if x['bbox'][1]>h*.6 and ('QUESTION' in x['text'] or 'TAKE THIS INTO YOUR DAY' in x['text'])]
 nh=min(heads,key=lambda x:x['bbox'][1]) if heads else None
 np=[x for x in ss if nh and x['bbox'][1]>nh['bbox'][3] and x['bbox'][1]<h-36 and x['size']>=8]
 if not nh:np=[x for x in ss if 'Serif' in x['font'] and 9<x['size']<12 and h*.78<x['bbox'][1]<h-36]
 nt=min([x['bbox'][1] for x in ([nh] if nh else [])+np] or [h-36])
 bodies=[]
 for b in blocks:
  bs=[x for l in b['lines'] for x in l['spans']]
  if b['bbox'][0]<42 and b['bbox'][1]>title_end and b['bbox'][3]<nt-2 and all(10<=x['size']<=11.6 and 'Serif' not in x['font'] for x in bs):bodies.append(b)
 if not bodies:return None
 subs=[x for x in ss if 11.7<=x['size']<18 and title_end<x['bbox'][1]<250]
 excluded=titles+markers+subs+([nh] if nh else [])+np+[x for b in bodies for l in b['lines'] for x in l['spans']]
 # The leadership chapter's list is real editorial content, not an artwork label.
 lists=[b for b in blocks if b['bbox'][0]<42 and b['bbox'][1]>title_end and b['bbox'][3]<nt-2 and any('Three questions in this chapter:' in x['text'] or x['text'].startswith('•') for l in b['lines'] for x in l['spans'])]
 excluded += [x for b in lists for l in b['lines'] for x in l['spans']]
 remaining=[x for x in ss if x not in excluded and 52<x['bbox'][1] and x['bbox'][3]<h-36]
 rects=[fitz.Rect(x['bbox']) for x in remaining]+[fitz.Rect(x['bbox']) for x in s.get_image_info()]
 ignore=[fitz.Rect(b['bbox']) for b in bodies+lists]+[fitz.Rect(x['bbox']) for x in titles+subs+markers]
 if np:ignore.append(fitz.Rect(29,nt-12,391,h-35))
 for dr in s.get_drawings():
  r=dr['rect'];fill=dr.get('fill')
  if r.y0<55 or r.y1>=h-35 or (fill and min(fill)>.97) or (r.height<5 and r.width<55) or (r.height<1 and r.width>300):continue
  if any(r.intersects(e) for e in ignore):continue
  rects.append(r)
 fig=None
 if rects:
  fig=fitz.Rect(rects[0])
  for r in rects[1:]:fig|=r
  fig=fitz.Rect(max(29,fig.x0-3),max(title_end+5,fig.y0-3),min(391,fig.x1+3),min(nt-10,fig.y1+3))
 if any(not fig or not fig.contains(fitz.Rect(x['bbox'])) for x in remaining):return None
 return dict(title=' '.join(x['text'] for x in titles),markers=source_order(markers),subs=source_order(subs),paras=[tx(b) for b in sorted(bodies,key=lambda b:b['bbox'][1])],nh=nh['text'] if nh else '',note=' '.join(x['text'] for x in source_order(np)),labels=remaining,figure=fig,lists=lists)

def selection(p,y):
 # Distinct nested fields retain selection's direction. No chain of generic boxes.
 p.draw_rect(fitz.Rect(30,y,390,y+111),color=B.rgb(BORDER),fill=B.rgb('#f7f5ee'),width=.5)
 for x,yy,c in [(53,20,'#c4ccb4'),(91,55,'#e5c55b'),(147,21,'#becad3'),(238,21,'#d6cbdc'),(329,57,'#b4c5b5')]:
  p.draw_rect(fitz.Rect(x,y+yy,x+25,y+yy+20),color=None,fill=B.rgb(c))
 p.draw_rect(fitz.Rect(82,y+45,124,y+87),color=B.rgb(BLUE),width=1.3)
 p.draw_line((124,y+66),(183,y+66),color=B.rgb(BLUE),width=.8)
 p.draw_rect(fitz.Rect(183,y+17,292,y+96),color=B.rgb(BORDER),fill=B.rgb('#edf3f8'),width=.55)
 p.draw_rect(fitz.Rect(217,y+37,258,y+77),color=None,fill=B.rgb('#e5c55b'))
 for t,x,w in [('Many details in view',37,124),('A selected detail',171,120),('The experience you notice',300,83)]:text(p,t,x,y+122,w,9,'body',INK)
 return y+165

def inventory(p,y):
 # An actual usable attention inventory with three equal writing fields.
 for i,t in enumerate(['Chosen','Necessary','Captured']):
  x=30+i*124;p.draw_rect(fitz.Rect(x,y,x+112,y+116),color=B.rgb(BORDER),fill=B.rgb(['#edf3f8','#f5f2df','#f2eef7'][i]),width=.5)
  text(p,t,x+9,y+9,94,10,'bold',INK)
  for yy in [47,71,95]:p.draw_line((x+9,y+yy),(x+103,y+yy),color=B.rgb(BORDER),width=.45)
 return y+129

def article(s,stem):
 data=parse(s)
 if not data:return None
 art=asset(stem,s.number+1);h=720;d=fitz.open();p=d.new_page(width=420,height=h);maps=[];running(p,s,maps);accent,tint=B.COLORS[stem]
 y=60
 for m in data['markers']:y=text(p,m['text'],30,y,360,7.7,'bold',accent)+7
 y=text(p,data['title'],30,y,360,25,'serif',accent)+9
 # Preserve subtitle lines as one logical sentence.
 if data['subs']:y=text(p,' '.join(x['text'] for x in data['subs']),30,y,360,12,'serif',BLUE)+10
 visual='retained explanatory diagram'
 if stem=='art-of-attention' and s.number+1==8:
  y=inventory(p,y);visual='redrawn usable three-field inventory'
 elif stem=='art-of-attention' and s.number+1==6 and not art:
  y=selection(p,y);visual='redrawn selection relationship'
 elif art and art.exists():
  y=picture(p,art,y,170 if 'CHAPTER' in ' '.join(m['text'] for m in data['markers']) else 160)+8
  y=captions(p,data['labels'],y);visual='new editorial illustration'
 elif data['figure']:
  fig=data['figure'];fw=min(360,fig.width);fh=fig.height*fw/fig.width
  B.copy(p,s,fig,fitz.Rect((420-fw)/2,y,(420+fw)/2,y+fh),maps);y+=fh+12
 top=y;bottom=top
 for i,t in enumerate(data['paras']):
  if i:bottom+=8
  bottom=text(p,t,30,bottom,MAIN,10.8)
 longnote=len(data['note'].split())>32
 if data['note'] and not longnote:bottom=max(bottom,margin(p,data['nh'],data['note'],top,stem))
 if data['lists']:
  yy=bottom+12
  for b in data['lists']:yy=text(p,tx(b),30,yy,360,10,'body',accent)+7
  bottom=yy
 if longnote:bottom=note(p,data['nh'],data['note'],bottom+12,stem)
 if any('A SMALL PRACTICE' in m['text'] for m in data['markers']) and h-48-bottom>65:
  end=min(h-48,bottom+100)
  for yy in range(round(bottom+24),round(end),21):p.draw_line((30,yy),(30+MAIN,yy),color=B.rgb(BORDER),width=.5)
  bottom=end
 if bottom>h-43:raise ValueError((stem,s.number+1,'article overflow',bottom))
 if words(p)!=words(s):raise ValueError((stem,s.number+1,'article text',words(s)-words(p),words(p)-words(s)))
 d,maps=compact(d,s,bottom,maps);p=d[0]
 return d,dict(page=s.number+1,layout='80/20 reading and notes',visual=visual,contentBottom=round(bottom),pageHeight=round(p.rect.height),mainWidth=MAIN,notesWidth=SIDE),B.links(p,s,maps)

def life(s):
 ss=spans(s);h=s.rect.height
 if not any(x['text']=='IN AN ORDINARY LIFE' for x in ss):return None
 blocks=[b for b in s.get_text('dict')['blocks'] if 'lines' in b]
 titles=[x for x in ss if x['size']>=18 and 55<x['bbox'][1]<180];end=max(x['bbox'][3] for x in titles)
 markers=[x for x in ss if 55<x['bbox'][1]<90 and x['size']<8]
 prompt=next(x for x in ss if x['text']=='TAKE THIS INTO YOUR DAY')
 question=' '.join(x['text'] for x in source_order(ss) if x['bbox'][1]>prompt['bbox'][3] and x['bbox'][1]<h-36 and x['size']>=8)
 main=sorted([b for b in blocks if b['bbox'][0]<42 and b['bbox'][1]>end and b['bbox'][3]<prompt['bbox'][1]-10],key=lambda b:b['bbox'][1])
 nums=sorted([x for x in ss if x['text'] in ['01','02','03'] and x['bbox'][0]>247],key=lambda x:x['bbox'][1]);steps=[]
 for i,n in enumerate(nums):
  hi=nums[i+1]['bbox'][1]-12 if i<2 else n['bbox'][1]+52
  steps.append(' '.join(x['text'] for x in source_order(ss) if x['bbox'][0]>=260 and n['bbox'][3]<x['bbox'][1]<hi))
 scenario=sorted([b for b in blocks if b['bbox'][0]>=247 and b['bbox'][1]>nums[-1]['bbox'][1]+60 and b['bbox'][3]<prompt['bbox'][1]],key=lambda b:b['bbox'][1])
 if len(steps)!=3 or not scenario:raise ValueError(('life structure',s.number+1))
 d=fitz.open();p=d.new_page(width=420,height=720);maps=[];running(p,s,maps);y=60
 for m in markers:y=text(p,m['text'],30,y,360,7.7,'bold',OLIVE)+7
 y=text(p,' '.join(x['text'] for x in source_order(titles)),30,y,360,25,'serif',OLIVE)+8
 art=asset('life-secrets',s.number+1)
 if art and art.exists():y=picture(p,art,y,80)+8
 top=y
 for b in main:
  t=tx(b)
  if t=='TRY THIS':y=text(p,t,30,y+2,MAIN,7.7,'bold',OLIVE)+5
  else:y=text(p,t,30,y,MAIN,10.8)+8
 yy=text(p,'IN AN ORDINARY LIFE',SX,top,SIDE,7.1,'bold',OLIVE)+10
 for i,step in enumerate(steps):
  yy=text(p,str(i+1).zfill(2),SX,yy,SIDE,8,'bold',OLIVE)+3
  yy=text(p,step,SX,yy,SIDE,9.2,'body',INK)+12
 p.draw_line((SX-6,top),(SX-6,yy-6),color=B.rgb(BORDER),width=.7)
 y=max(y,yy)+2
 for b in scenario:y=text(p,tx(b),30,y,360,10.1,'body',BLUE)+8
 y=note(p,prompt['text'],question,y+3,'life-secrets')
 if y>677:raise ValueError(('life overflow',s.number+1,y))
 assert words(p)==words(s),('life words',s.number+1,words(s)-words(p),words(p)-words(s))
 d,maps=compact(d,s,y,maps);p=d[0]
 return d,dict(page=s.number+1,layout='80/20 idea and practical steps; full-width example and reflection',visual='new editorial illustration' if art else 'typographic steps',contentBottom=round(y),pageHeight=round(p.rect.height),mainWidth=MAIN,notesWidth=SIDE),B.links(p,s,maps)

def build(stem):
 src=fitz.open(SRC/(stem+'.pdf'));base=fitz.open(BASE/(stem+'.pdf'));d=fitz.open();report=[];pending={}
 for i,s in enumerate(src):
  n=i+1;regular=(stem in ['art-of-attention','man-and-people-guide'] and (n==2 or 5<=n<=(28 if stem=='art-of-attention' else 40))) or (stem=='life-secrets' and (n==2 or n in CHAPTERS[stem])) or (stem=='lead-without-the-noise' and 5<=n<=20)
  result=life(s) if stem=='life-secrets' and 6<=n<=28 and n not in CHAPTERS[stem] else None
  if result is None and regular:result=article(s,stem)
  if result:
   tmp,r,ls=result;d.insert_pdf(tmp,links=False);pending[i]=ls;report.append(r)
  else:
   d.insert_pdf(base,from_page=i,to_page=i,links=False);pending[i]=B.links(d[-1],base[i],[(base[i].rect,d[-1].rect)])
   report.append(dict(page=n,layout='preserved cover, workbook or reference page'))
  assert words(d[-1])==words(base[i]),(stem,n,'baseline word mismatch',words(base[i])-words(d[-1]),words(d[-1])-words(base[i]))
 for i,ls in pending.items():
  for link in d[i].get_links():d[i].delete_link(link)
  for link in ls:d[i].insert_link(link)
 for i in range(len(d)):assert len(d[i].get_links())>=len(base[i].get_links()),(stem,i+1,'links')
 d.set_toc(base.get_toc());d.set_metadata(base.metadata);p=OUT/(stem+'.pdf');d.subset_fonts();d.save(p,garbage=4,clean=True,deflate=True)
 (DEL/p.name).write_bytes(p.read_bytes());return report

def sampler():
 base=fitz.open(BASE/'sneakpeak-ideas.pdf');d=fitz.open();mapping={x['sampler_page']-1:x for x in json.loads((R/'private/books/premium/sampler-source-map.json').read_text())};pending={};report=[]
 for i,s in enumerate(base):
  e=mapping.get(i)
  if e and e['book'] in STEMS[:4]:
   book=fitz.open(OUT/(e['book']+'.pdf'));q=book[e['source_page']-1];p=d.new_page(width=420,height=q.rect.height+40);p.show_pdf_page(fitz.Rect(0,40,420,q.rect.height+40),book,q.number);maps=[]
   B.copy(p,s,fitz.Rect(0,0,420,40),fitz.Rect(0,0,420,40),maps)
   ls=B.links(p,s,maps)
   for a in q.get_links():
    if a['kind']==fitz.LINK_URI:ls.append({'kind':fitz.LINK_URI,'from':a['from']+fitz.Rect(0,40,0,40),'uri':a['uri']})
   pending[i]=ls;report.append(dict(page=i+1,layout='matching revised paid excerpt'))
  else:
   d.insert_pdf(base,from_page=i,to_page=i,links=False);pending[i]=B.links(d[-1],s,[(s.rect,d[-1].rect)])
   report.append(dict(page=i+1,layout='preserved introduction, source notes or future preview'))
  assert words(d[-1])==words(s),('sampler words',i+1,words(s)-words(d[-1]),words(d[-1])-words(s))
 for i,ls in pending.items():
  for a in d[i].get_links():d[i].delete_link(a)
  for a in ls:d[i].insert_link(a)
 for i,s in enumerate(base):assert len(d[i].get_links())>=len(s.get_links()),('sampler links',i+1)
 d.set_metadata(base.metadata);p=OUT/'sneakpeak-ideas.pdf';d.save(p,garbage=4,clean=True,deflate=True);(DEL/p.name).write_bytes(p.read_bytes());return report

def samples():
 for stem,ns in {'art-of-attention':[1,5,6,7],'life-secrets':[1,9,10,28],'man-and-people-guide':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}.items():
  d=fitz.open(OUT/(stem+'.pdf'));s=fitz.open()
  for n in ns:s.insert_pdf(d,from_page=n-1,to_page=n-1,links=False)
  s.set_metadata({'title':'OPortals — Four-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'});p=OUT/(stem+'-sample.pdf');s.save(p,garbage=4,clean=True,deflate=True);(DEL/p.name).write_bytes(p.read_bytes())

if __name__=='__main__':
 reports={}
 for stem in (STEMS[:1] if '--sample' in sys.argv else STEMS[:4]):reports[stem]=build(stem)
 if '--sample' not in sys.argv:reports['sneakpeak-ideas']=sampler();samples()
 (DEL/'layout-report.json').write_text(json.dumps(reports,indent=2))
 print(json.dumps({k:dict(Counter(x['layout'] for x in v)) for k,v in reports.items()},indent=2))
