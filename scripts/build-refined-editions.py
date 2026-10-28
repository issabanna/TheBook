"""Design-review refinements: fixed formats, readable prose and restrained diagram styling."""
from pathlib import Path
from collections import Counter
import fitz,re,json,sys
from PIL import Image
R=Path(__file__).resolve().parents[1];SRC=R/'private/refined-source';OUT=R/'private/publishing-preview';DEL=Path('/workspace/outputs/OPortals-Refined-Editions');DEL.mkdir(exist_ok=True)
STEMS=['art-of-attention','life-secrets','man-and-people-guide','lead-without-the-noise','sneakpeak-ideas']
FONTS={'body':'DejaVuSans.ttf','bold':'DejaVuSans-Bold.ttf','serif':'DejaVuSerif.ttf','italic':'DejaVuSerif-Italic.ttf'}
INK='#30382b';OLIVE='#68734b';BLUE='#245389';BORDER='#d7decf'
COLORS={'art-of-attention':('#245389','#edf3f8'),'life-secrets':('#68734b','#f5f2df'),'man-and-people-guide':('#635079','#f2eef7'),'lead-without-the-noise':('#52674d','#eef2e9'),'sneakpeak-ideas':('#68734b','#f5f2df')}
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def tx(b):return ' '.join(s['text'] for l in b['lines'] for s in l['spans'])
def font(p,kind):
 name='Compact'+kind;p.insert_font(fontname=name,fontfile='/usr/share/fonts/truetype/dejavu/'+FONTS[kind]);return name
def wrap(text,width,size,kind='body'):
 f=fitz.Font(fontfile='/usr/share/fonts/truetype/dejavu/'+FONTS[kind]);ls=[];line=''
 for w in text.split():
  test=(line+' '+w).strip()
  if line and f.text_length(test,fontsize=size)>width:ls.append(line);line=w
  else:line=test
 if line:ls.append(line)
 return ls
def lines(p,ls,x,y,size=10.5,kind='body',color=INK,leading=None):
 lead=leading or size*1.36
 for line in ls:p.insert_text((x,y+size),line,fontname=font(p,kind),fontsize=size,color=rgb(color));y+=lead
 return y
def text(p,t,x,y,width,size=10.5,kind='body',color=INK):return lines(p,wrap(t,width,size,kind),x,y,size,kind,color)
def panel(p,r,fill):
 p.draw_rect(r,fill=rgb(fill),color=rgb(BORDER),width=.55,radius=.04)
def copy(p,source,clip,target,maps):
 p.show_pdf_page(target,source.parent,source.number,clip=clip,keep_proportion=False);maps.append((fitz.Rect(clip),fitz.Rect(target)))
def running(p,s,maps):
 H=s.rect.height;copy(p,s,fitz.Rect(0,0,420,51),fitz.Rect(0,0,420,51),maps)
 copy(p,s,fitz.Rect(0,H-34,420,H),fitz.Rect(0,p.rect.height-34,420,p.rect.height),maps)
def trim_tail(d,s,end,maps):
 return d,maps
def put_note(p,head,body,y,stem):
 accent,tint=COLORS[stem];ls=wrap(body,330,11,'serif');height=len(ls)*15+(34 if head else 24)
 r=fitz.Rect(30,y,390,y+height);panel(p,r,tint);p.draw_line((30,y+6),(30,y+height-6),color=rgb(accent),width=2)
 if head:text(p,head,41,y+8,330,8.2,'bold',accent)
 lines(p,ls,41,y+(25 if head else 10),11,'serif',accent,15)
 return y+height
def body_columns(p,paras,y,stem,size=11.5):
 # Single-column prose avoids narrow lines and sideways reading on phones.
 for i,t in enumerate(paras):
  if i:y+=8
  y=text(p,t,30,y,360,size)
 return y
def links(p,s,maps):
 result=[]
 for a in s.get_links():
  box=a['from'];options=[(box & old).get_area() for old,new in maps]
  if not options or max(options)==0:continue
  old,new=maps[options.index(max(options))];sx=new.width/old.width;sy=new.height/old.height
  rr=fitz.Rect(new.x0+(box.x0-old.x0)*sx,new.y0+(box.y0-old.y0)*sy,new.x0+(box.x1-old.x0)*sx,new.y0+(box.y1-old.y0)*sy)
  item={'kind':a['kind'],'from':rr}
  if a['kind']==fitz.LINK_URI:item['uri']=a['uri']
  elif str(a.get('page','')).isdigit():item.update(kind=fitz.LINK_GOTO,page=int(a['page'])-1 if isinstance(a['page'],str) else a['page'],to=fitz.Point(0,0))
  else:continue
  result.append(item)
 return result
def article(s,stem,H):
 ss=spans(s);h=s.rect.height;blocks=[b for b in s.get_text('dict')['blocks'] if 'lines' in b]
 titles=[x for x in ss if x['size']>=18 and 55<x['bbox'][1]<180]
 if not titles:return None
 title=' '.join(x['text'] for x in titles);title_end=max(x['bbox'][3] for x in titles)
 markers=[x for x in ss if 55<x['bbox'][1]<90 and x['size']<8]
 note_heads=[x for x in ss if x['bbox'][1]>h*.6 and 'QUESTION' in x['text'] or x['bbox'][1]>h*.6 and 'TAKE THIS INTO YOUR DAY' in x['text']]
 note_head=note_heads[0] if note_heads else None
 note_parts=[x for x in ss if note_head and x['bbox'][1]>note_head['bbox'][3] and x['bbox'][1]<h-36 and x['size']>=8]
 if not note_head:note_parts=[x for x in ss if 'Serif' in x['font'] and 9<x['size']<12 and x['bbox'][1]>h*.78 and x['bbox'][1]<h-36]
 note=' '.join(x['text'] for x in note_parts)
 note_top=min([x['bbox'][1] for x in ([note_head] if note_head else [])+note_parts] or [h-36])
 paras=[];body_blocks=[]
 for b in blocks:
  bs=[x for l in b['lines'] for x in l['spans']]
  if b['bbox'][0]<42 and b['bbox'][1]>title_end and b['bbox'][3]<note_top-2 and all(10<=x['size']<=11.6 and 'Serif' not in x['font'] for x in bs):paras.append(tx(b));body_blocks.append(b)
 if not paras:return None
 subs=[x for x in ss if 11.7<=x['size']<18 and x['bbox'][1]>title_end and x['bbox'][1]<250]
 excluded=titles+markers+subs+([note_head] if note_head else [])+note_parts+[x for b in body_blocks for l in b['lines'] for x in l['spans']]
 remaining=[x for x in ss if x not in excluded and 52<x['bbox'][1] and x['bbox'][3]<h-36]
 figure_rects=[fitz.Rect(x['bbox']) for x in remaining]
 for im in s.get_image_info():figure_rects.append(fitz.Rect(im['bbox']))
 excluded_rects=[fitz.Rect(b['bbox']) for b in body_blocks]+[fitz.Rect(x['bbox']) for x in titles+subs+markers]
 if note:excluded_rects.append(fitz.Rect(29,note_top-12,391,h-35))
 for dr in s.get_drawings():
  r=dr['rect'];fill=dr.get('fill')
  if r.y0<55 or r.y1>=h-35 or (fill and min(fill)>.97) or (r.height<5 and r.width<55) or (r.height<1 and r.width>300):continue
  if any(r.intersects(e) for e in excluded_rects):continue
  figure_rects.append(r)
 figure=None
 if figure_rects:
  figure=fitz.Rect(figure_rects[0])
  for r in figure_rects[1:]:figure|=r
  figure=fitz.Rect(max(29,figure.x0-3),max(title_end+5,figure.y0-3),min(391,figure.x1+3),min(note_top-10,figure.y1+3))
 # Any extra text must be inside the retained native visual.
 if any(not figure or not figure.contains(fitz.Rect(x['bbox'])) for x in remaining):return None
 d=fitz.open();p=d.new_page(width=420,height=H);maps=[];running(p,s,maps);accent,tint=COLORS[stem]
 y=60
 for m in markers:y=text(p,m['text'],30,y,360,8.2,'bold',accent)+4
 y=text(p,title,30,y,360,26,'serif',accent)+4
 for sub in subs:y=text(p,sub['text'],30,y,360,12.3,'serif',BLUE)+7
 if figure and figure.height>0:
  fw=min(360,figure.width);fh=figure.height*fw/figure.width
  copy(p,s,figure,fitz.Rect((420-fw)/2,y+4,(420+fw)/2,y+4+fh),maps);y+=fh+12
 y=body_columns(p,paras,y,stem)+6
 if note:y=put_note(p,note_head['text'] if note_head else '',note,y,stem)
 if any('A SMALL PRACTICE' in m['text'] for m in markers) and H-44-y>80:
  # Useful answer space on practice pages, rather than an unused lower half.
  end=min(H-49,y+135);panel(p,fitz.Rect(30,y+12,390,end),'#fcfcf8')
  for yy in range(round(y+36),round(end-9),22):p.draw_line((42,yy),(378,yy),color=rgb(BORDER),width=.4)
  y=end
 if y>H-43:return None
 if words(p)!=words(s):
  return None
 d,maps=trim_tail(d,s,y,maps);p=d[0]
 return d,{'page':s.number+1,'layout':'single-column illustrated article','contentBottom':round(y),'pageHeight':round(p.rect.height)},links(p,s,maps)

def life_idea(s,H):
 ss=spans(s);h=s.rect.height
 if not any(x['text']=='IN AN ORDINARY LIFE' for x in ss):return None
 blocks=[b for b in s.get_text('dict')['blocks'] if 'lines' in b];title=[x for x in ss if x['size']>=18 and x['bbox'][1]<180]
 marker=[x for x in ss if 55<x['bbox'][1]<90 and x['size']<8]
 prompt=next(x for x in ss if x['text']=='TAKE THIS INTO YOUR DAY');question=' '.join(x['text'] for x in ss if x['bbox'][1]>prompt['bbox'][3] and x['bbox'][1]<h-36 and x['size']>=8)
 main=sorted([b for b in blocks if b['bbox'][0]<42 and b['bbox'][1]>max(x['bbox'][3] for x in title) and b['bbox'][3]<prompt['bbox'][1]-10],key=lambda b:b['bbox'][1])
 numbers=sorted([x for x in ss if x['text'] in ['01','02','03'] and x['bbox'][0]>247],key=lambda x:x['bbox'][1]);steps=[]
 for i,num in enumerate(numbers):
  high=numbers[i+1]['bbox'][1]-12 if i<2 else num['bbox'][1]+52
  parts=[x for x in ss if x['bbox'][0]>=260 and x['bbox'][1]>num['bbox'][3] and x['bbox'][1]<high];steps.append(' '.join(x['text'] for x in parts))
 scenario=[b for b in blocks if b['bbox'][0]>=247 and b['bbox'][1]>numbers[-1]['bbox'][1]+60 and b['bbox'][3]<prompt['bbox'][1]]
 if len(steps)!=3 or not scenario:return None
 d=fitz.open();p=d.new_page(width=420,height=H);maps=[];running(p,s,maps)
 y=60
 for m in marker:y=text(p,m['text'],30,y,360,8.2,'bold',OLIVE)+6
 y=text(p,' '.join(x['text'] for x in title),30,y,360,26,'serif',OLIVE)+4
 for b in main:
  t=tx(b)
  if t=='TRY THIS':y+=2;y=text(p,t,30,y,360,8.2,'bold',OLIVE)+5
  else:y=text(p,t,30,y,360,11.5,'body',INK)+6
 y+=1
 y=text(p,'IN AN ORDINARY LIFE',30,y,360,8.2,'bold',OLIVE)+6
 heights=[]
 for step in steps:heights.append(max(51,26+len(wrap(step,96,9.4,'bold'))*12.8))
 ht=max(heights)
 for i,step in enumerate(steps):
  x=30+i*124;panel(p,fitz.Rect(x,y,x+112,y+ht),'#f6f7f1');text(p,str(i+1).zfill(2),x+8,y+6,96,8.2,'bold',OLIVE);text(p,step,x+8,y+22,96,9.4,'bold',INK)
 y+=ht+8
 for b in scenario:y=text(p,tx(b),30,y,360,11,'body',BLUE)+6
 y+=2;y=put_note(p,prompt['text'],question,y,'life-secrets')
 if y>H-43:return None
 if words(p)!=words(s):return None
 d,maps=trim_tail(d,s,y,maps);p=d[0]
 return d,{'page':s.number+1,'layout':'single-column idea, steps and everyday example','contentBottom':round(y),'pageHeight':round(p.rect.height)},links(p,s,maps)

def bands(s,stem,H):
 original=s;clone=fitz.open();clone.insert_pdf(s.parent,from_page=s.number,to_page=s.number);s=clone[0];h=s.rect.height;accent,tint=COLORS[stem]
 # Box native workbook prompts, source notes and contents rows without changing their wording.
 jobs=[]
 for b in s.get_text('dict')['blocks']:
  if 'lines' not in b:continue
  bs=[x for l in b['lines'] for x in l['spans']];r=fitz.Rect(b['bbox']);t=tx(b)
  if r.y0<=55 or r.y1>=h-37:continue
  small=all(x['size']<9.1 for x in bs) and len(t)>75
  field=(any(x['text'] in ['INTENTION','ARRANGEMENT','RETURN','REVIEW','OBSERVED','REPORTED','INFERRED','01','02','03','04','05','06'] for x in bs) and len(t)>12)
  if small or field:jobs.append((r,bs,small))
 for r,bs,small in jobs:s.add_redact_annot(fitz.Rect(r.x0-1,r.y0-1,r.x1+1,r.y1+1),fill=False)
 if jobs:s.apply_redactions(images=0,graphics=0)
 for r,bs,small in jobs:
  rr=fitz.Rect(30,r.y0-6,390,r.y1+6);panel(s,rr,tint if small else '#f6f7f1')
  for x in bs:
   kind='italic' if 'Italic' in x['font'] else 'serif' if 'Serif' in x['font'] else 'bold' if ('Bold' in x['font'] or x['text'].isupper()) else 'body'
   s.insert_text(x['origin'],x['text'],fontname=font(s,kind),fontsize=x['size'],color=rgb(accent if small or x['text'].isupper() else INK))
 assert words(s)==words(original),(stem,original.number+1,'native note words')
 ss=spans(s);intervals=[]
 for b in s.get_text('dict')['blocks']:
  r=fitz.Rect(b['bbox'])
  if r.y0>52 and r.y1<h-36:intervals.append((r.y0-2,r.y1+2))
 for dr in s.get_drawings():
  r=dr['rect'];f=dr.get('fill')
  if r.y0<=52 or r.y1>=h-36 or (f and min(f)>.97) or (r.height<1 and r.width>300):continue
  intervals.append((r.y0-1.5,r.y1+1.5))
 merged=[]
 for a,b in sorted(intervals):
  if merged and a<=merged[-1][1]+8:merged[-1][1]=max(b,merged[-1][1])
  else:merged.append([a,b])
 total=sum(b-a for a,b in merged)+max(0,len(merged)-1)*10
 assert total+105<=H,(stem,original.number+1,'fixed page capacity',total+105,H)
 d=fitz.open();p=d.new_page(width=420,height=H);maps=[];running(p,s,maps);y=60;accent,tint=COLORS[stem]
 for a,b in merged:
  r=fitz.Rect(0,a,420,b);dest=fitz.Rect(0,y,420,y+b-a)
  copy(p,s,r,dest,maps);y+=b-a+10
 if any('WORKBOOK' in x['text'] for x in spans(original) if x['bbox'][1]<90) and H-y>90:
  end=min(H-49,y+130);panel(p,fitz.Rect(30,y+4,390,end),'#fcfcf8')
  for yy in range(round(y+27),round(end-8),22):p.draw_line((42,yy),(378,yy),color=rgb(BORDER),width=.4)
  y=end
 assert words(p)==words(original),(stem,original.number+1,'band text mismatch',words(original)-words(p),words(p)-words(original))
 d,maps=trim_tail(d,original,y,maps);p=d[0]
 return d,{'page':original.number+1,'layout':'compact native workbook or reference page','pageHeight':round(p.rect.height)},links(p,original,maps)

def build(stem,sample_only=False):
 source=fitz.open(SRC/(stem+'.pdf'));doc=fitz.open();changes=[];pending={};H=720
 for i,s in enumerate(source):
  if i==0:doc.insert_pdf(source,from_page=0,to_page=0);continue
  n=i+1;regular=(stem in ['art-of-attention','man-and-people-guide'] and (n==2 or 5<=n<=(28 if stem=='art-of-attention' else 40))) or (stem=='life-secrets' and (n==2 or n in [5,9,13,17,21,25])) or (stem=='lead-without-the-noise' and 5<=n<=20)
  result=life_idea(s,H) if stem=='life-secrets' else None
  if result is None and regular:result=article(s,stem,H)
  if result is None:result=bands(s,stem,H)
  tmp,report,page_links=result;doc.insert_pdf(tmp);changes.append(report);pending[i]=page_links
  assert words(doc[-1])==words(s),(stem,n,'text mismatch')
 for i,items in pending.items():
  for item in items:doc[i].insert_link(item)
 for i,s in enumerate(source):assert len(doc[i].get_links())==len(s.get_links()),(stem,i+1,'links mismatch')
 doc.set_toc(source.get_toc());doc.set_metadata(source.metadata);dest=OUT/(stem+'.pdf');doc.save(dest,garbage=4,clean=True,deflate=True)
 (DEL/dest.name).write_bytes(dest.read_bytes());return changes

def sampler():
 source=fitz.open(SRC/'sneakpeak-ideas.pdf');doc=fitz.open();pending={};changes=[]
 mapping={x['sampler_page']-1:x for x in json.loads((R/'private/books/premium/sampler-source-map.json').read_text())}
 for i,s in enumerate(source):
  if i==0:doc.insert_pdf(source,from_page=0,to_page=0);continue
  if i in mapping:
   e=mapping[i];tmp=fitz.open();maps=[]
   if e['book'] in STEMS[:4]:
    book=fitz.open(OUT/(e['book']+'.pdf'));page=book[e['source_page']-1]
   else:
    native=fitz.open();q=native.new_page(width=420,height=595);q.show_pdf_page(q.rect,source,i,clip=fitz.Rect(0,103,420,698),keep_proportion=False)
    z=article(q,'lead-without-the-noise',720) or bands(q,'lead-without-the-noise',720);book=z[0];page=book[0]
   H=760;p=tmp.new_page(width=420,height=H);y=40;target=fitz.Rect(0,y,420,y+page.rect.height);p.show_pdf_page(target,book,page.number,keep_proportion=False)
   copy(p,s,fitz.Rect(0,0,420,40),fitz.Rect(0,0,420,40),maps)
   doc.insert_pdf(tmp);pending[i]=links(p,s,maps)
   # Preserve any source book links as well as the sampler's clickable source strip.
   for a in page.get_links():
    if a['kind']==fitz.LINK_URI:pending[i].append({'kind':fitz.LINK_URI,'from':a['from']+fitz.Rect(0,y,0,y),'uri':a['uri']})
   changes.append({'page':i+1,'layout':'excerpt from the same compact edition' if e['book'] in STEMS[:4] else 'compact future-edition preview','pageHeight':H})
  else:
   tmp,report,ls=bands(s,'sneakpeak-ideas',760);doc.insert_pdf(tmp);pending[i]=ls;changes.append(report)
  assert words(doc[-1])==words(s),('sampler',i+1,'text mismatch',words(s)-words(doc[-1]),words(doc[-1])-words(s))
 for i,ls in pending.items():
  for item in ls:doc[i].insert_link(item)
 for i,s in enumerate(source):assert len(doc[i].get_links())>=len(s.get_links()),('sampler',i+1,'links')
 doc.set_metadata(source.metadata);dest=OUT/'sneakpeak-ideas.pdf';doc.save(dest,garbage=4,clean=True,deflate=True);(DEL/dest.name).write_bytes(dest.read_bytes());return changes

def samples():
 choices={'art-of-attention':[1,5,6,7],'life-secrets':[1,9,10,28],'man-and-people-guide':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}
 for stem,ns in choices.items():
  full=fitz.open(OUT/(stem+'.pdf'));sample=fitz.open()
  for n in ns:sample.insert_pdf(full,from_page=n-1,to_page=n-1,links=False)
  sample.set_metadata({'title':'OPortals — Four-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'});dest=OUT/(stem+'-sample.pdf');sample.save(dest,garbage=4,clean=True,deflate=True);assert len(sample)==4;(DEL/dest.name).write_bytes(dest.read_bytes())

if __name__=='__main__':
 reports={}
 for stem in (STEMS[:1] if '--sample' in sys.argv else STEMS[:4]):reports[stem]=build(stem)
 if '--sample' not in sys.argv:reports['sneakpeak-ideas']=sampler();samples()
 (DEL/'layout-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps({k:Counter(x['layout'] for x in v) for k,v in reports.items()},indent=2))
