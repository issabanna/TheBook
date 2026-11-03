"""Apply approved C / blue-grey framing to visible PDF diagrams, preserving text.

Input is an owner-fetched immutable baseline. Covers and raster illustrations are
preserved. Invisible legacy drawing layers are filtered against rendered pixels.
"""
from pathlib import Path
from collections import Counter
import fitz,re,json,math,sys
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];SRC=R/'private/checkpoints/before-blue-grey';OUT=R/'private/blue-grey-editions';OUT.mkdir(exist_ok=True)
FRAME='#aeb8c1';PAPER='#f8fafb';STROKE='#a6b0ba';CONNECTOR='#7d8791';INK='#303a43';FILLS=['#fbfbfa','#e9f0f4','#efedf4']
def rgb(v):return tuple(int(v[i:i+2],16)/255 for i in (1,3,5))
def union(rects):
 r=fitz.Rect(rects[0])
 for x in rects[1:]:r|=x
 return r

def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def words(p):return Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def ellipse(d):return sum(i[0]=='c' for i in d['items'])==4 and not any(i[0] in ['l','re'] for i in d['items'])
def rounded(d):return any(i[0]=='re' for i in d['items']) or sum(i[0]=='c' for i in d['items'])>=4 and sum(i[0]=='l' for i in d['items'])>=3

def rect_text(rect,text):return [s for s in text if rect.contains(fitz.Point((s['bbox'][0]+s['bbox'][2])/2,(s['bbox'][1]+s['bbox'][3])/2))]
def visible_fill(d,pix,scale=2):
 r=d['rect'];fill=d.get('fill')
 if not fill:return False
 col=tuple(round(v*255) for v in fill);hits=0;total=0
 for fx in [.14,.33,.67,.86]:
  for fy in [.17,.37,.67,.83]:
   x=int((r.x0+r.width*fx)*scale);y=int((r.y0+r.height*fy)*scale)
   if 0<=x<pix.width and 0<=y<pix.height:
    total+=1;c=pix.pixel(x,y)[:3]
    hits+=max(abs(c[i]-col[i]) for i in range(3))<=3
 return total>0 and hits/total>=.20

def visible_stroke(d,pix,scale=2):
 col=d.get('color') or d.get('fill')
 if not col:return False
 target=tuple(round(c*255) for c in col)
 points=[]
 for item in d['items']:
  if item[0]=='l':
   a,b=item[1:3]
   for f in [.2,.4,.6,.8]:points.append((a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f))
  elif item[0]=='c':points.extend([(q.x,q.y) for q in [item[1],item[4]]])
  elif item[0]=='re':points += [(item[1].x0,item[1].y0),(item[1].x1,item[1].y1)]
 if not points:points=[((d['rect'].x0+d['rect'].x1)/2,(d['rect'].y0+d['rect'].y1)/2)]
 for px,py in points:
  for dx in [-1,0,1]:
   for dy in [-1,0,1]:
    x=int(px*scale)+dx;y=int(py*scale)+dy
    if 0<=x<pix.width and 0<=y<pix.height:
     c=pix.pixel(x,y)[:3]
     if max(abs(c[i]-target[i]) for i in range(3))<30:return True
 return False

def find_regions(p):
 text=spans(p);drawings=p.get_drawings();pix=p.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);nodes=[]
 for i,d in enumerate(drawings):
  r=d['rect'];f=d.get('fill')
  if not(f and (rounded(d) or ellipse(d)) and 36<=r.width<=245 and 18<=r.height<=125 and r.y0>=65 and r.y1<=p.rect.height-35 and p.rect.contains(r)):continue
  labels=rect_text(r,text)
  if not labels or sum(len(re.findall(r'\w+',s['text'])) for s in labels)>18 or any(s['size']>16 for s in labels):continue
  if not visible_fill(d,pix):continue
  key=tuple(round(v,1) for v in r);previous=next((n for n in nodes if n['key']==key),None)
  if previous:previous.update(i=i,d=d)
  else:nodes.append(dict(i=i,d=d,r=r,key=key))
 # Merge nearby rows/columns, while keeping distinct diagram groups apart.
 groups=[];todo=list(range(len(nodes)))
 while todo:
  group=[todo.pop(0)];changed=True
  while changed:
   changed=False
   for k in todo[:]:
    r=nodes[k]['r']
    for j in group:
     q=nodes[j]['r'];gx=max(0,r.x0-q.x1,q.x0-r.x1);gy=max(0,r.y0-q.y1,q.y0-r.y1)
     if gx<=100 and gy<=52 and (gx<=25 or gy<=18):group.append(k);todo.remove(k);changed=True;break
  if len(group)>=2:groups.append([nodes[i] for i in group])
 result=[]
 for group in groups:
  bbox=union([n['r'] for n in group]);parents=[]
  for i,d in enumerate(drawings):
   r=d['rect']
   if not d.get('fill') or not rounded(d) or r.width>p.rect.width-30 or r.height>p.rect.height*.55 or not r.contains(bbox) or r.get_area()<bbox.get_area()+100:continue
   if not visible_fill(d,pix):continue
   if any(fitz.Rect(im['bbox']).intersects(r) for im in p.get_image_info()):continue
   inner=[s for s in text if r.contains(fitz.Rect(s['bbox']))]
   if sum(len(s['text'].split()) for s in inner)>110:continue
   parents.append((i,d))
  parent=min(parents,key=lambda item:item[1]['rect'].get_area()) if parents else None
  region=fitz.Rect(parent[1]['rect']) if parent else bbox+(-8,-8,8,8)
  region &= fitz.Rect(22,55,p.rect.width-22,p.rect.height-34)
  if any(fitz.Rect(im['bbox']).intersects(region) for im in p.get_image_info()):continue
  label_spans=[s for s in text if fitz.Rect(s['bbox']).intersects(region)]
  # Never cover part of an unrelated line of prose or a neighbouring note.
  if any(not (region+(-.3,-.3,.3,.3)).contains(fitz.Rect(s['bbox'])) for s in label_spans):continue
  if any(s['size']>18 for s in label_spans):continue
  result.append(dict(region=region,nodes=group,parent=parent,text=label_spans,kind='diagram'))
 # Existing 80/20 books use a three-step textual sidebar: preserve its words and
 # vertical flow, adding the same quiet cards/frame without moving any text.
 if True:
  headings=[s for s in text if s['text'].startswith('IN AN ORDINARY')]
  if headings:
   numbers=sorted([s for s in text if s['text'] in ['01','02','03'] and s['bbox'][0]>300 and 60<s['bbox'][1]<p.rect.height-80],key=lambda s:s['bbox'][1])
   if len(numbers)==3:
    top=numbers[0]['bbox'][1]-6
    step_spans=[s for s in text if s['bbox'][0]>=319 and s['bbox'][1]>=numbers[0]['bbox'][1]-.5 and s['bbox'][3]<p.rect.height-38]
    end=max(s['bbox'][3] for s in step_spans)+6;region=fitz.Rect(313,top,390,min(end,p.rect.height-36));ss=[s for s in text if region.contains(fitz.Rect(s['bbox']))]
    partial=any(fitz.Rect(s['bbox']).intersects(region) and not region.contains(fitz.Rect(s['bbox'])) for s in text)
    if ss and not partial and not any(fitz.Rect(im['bbox']).intersects(region) for im in p.get_image_info()) and not any(e['region'].intersects(region) for e in result):result.append(dict(region=region,nodes=[],parent=None,text=ss,kind='steps'))
 return result,drawings,pix

FONTS={
 'body':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'),
 'bold':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'),
 'italic':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Italic.ttf'),
 'display':R/'public/design-fonts/Anton-Regular.ttf',
 'dejavu':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
 'dejavubold':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
 'serif':Path('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'),
 'serifitalic':Path('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf')}

def label_font(p,s):
 name=s['font'].lower();bold='bold' in name or s['flags']&16;italic='italic' in name or 'oblique' in name
 if name.startswith('helvetica'):return 'hebo' if bold else 'heit' if italic else 'helv'
 if 'times' in name:return 'tibo' if bold else 'tiit' if italic else 'tiro'
 key='display' if 'anton' in name else 'bold' if 'open' in name and bold else 'italic' if 'open' in name and italic else 'body' if 'open' in name else 'serifitalic' if ('serif' in name and italic) else 'serif' if 'serif' in name else 'dejavubold' if bold else 'dejavu'
 fn='BlueGrey'+key;p.insert_font(fontname=fn,fontfile=str(FONTS[key]));return fn

def repeat_path(page,d,color,fill):
 shape=page.new_shape()
 for item in d['items']:
  if item[0]=='l':shape.draw_line(item[1],item[2])
  elif item[0]=='c':shape.draw_bezier(item[1],item[2],item[3],item[4])
  elif item[0]=='re':shape.draw_rect(item[1])
  elif item[0]=='qu':shape.draw_quad(item[1])
 shape.finish(color=rgb(color) if d.get('color') else None,fill=rgb(fill) if d.get('fill') else None,width=min(max(d.get('width') or .7,.55),1.1),closePath=d.get('closePath',False),even_odd=d.get('even_odd',False));shape.commit()

def apply_region(page,entry,drawings,pix):
 region=entry['region'];before=words(page);saved=entry['text'];node_ids={n['i'] for n in entry['nodes']};parent_id=entry['parent'][0] if entry['parent'] else None
 page.add_redact_annot(region,fill=False);page.apply_redactions(images=0,graphics=0,text=0)
 page.draw_rect(region,color=rgb(FRAME),fill=rgb(PAPER),width=.65,radius=.035)
 if entry['kind']=='steps':
  marks=sorted([s for s in saved if s['text'] in ['01','02','03']],key=lambda s:s['bbox'][1])
  for i,mark in enumerate(marks):
   y=mark['bbox'][1]-3;y1=marks[i+1]['bbox'][1]-8 if i<2 else region.y1-5
   page.draw_rect(fitz.Rect(region.x0+4,y,region.x1-4,y1),color=rgb(STROKE),fill=rgb(FILLS[i]),width=.55,radius=.035)
 else:
  # Repaint only visible connectors and semantic marks at their original positions.
  for i,d in enumerate(drawings):
   r=d['rect']
   if i in node_ids or i==parent_id or not (region+(-.2,-.2,.2,.2)).contains(r):continue
   if any(abs(r.x0-n['r'].x0)<.3 and abs(r.y0-n['r'].y0)<.3 and abs(r.x1-n['r'].x1)<.3 and abs(r.y1-n['r'].y1)<.3 for n in entry['nodes']):continue
   if d.get('fill'):
    if r.get_area()>region.get_area()*.8 or not visible_fill(d,pix):continue
   elif not visible_stroke(d,pix):continue
   repeat_path(page,d,CONNECTOR,CONNECTOR)
  for i,n in enumerate(sorted(entry['nodes'],key=lambda n:n['i'])):
   if ellipse(n['d']):page.draw_oval(n['r'],color=rgb(STROKE),fill=rgb(FILLS[i%3]),width=.65,fill_opacity=n['d'].get('fill_opacity',1),dashes=n['d'].get('dashes'))
   else:page.draw_rect(n['r'],color=rgb(STROKE),fill=rgb(FILLS[i%3]),width=.65,radius=.06)
 for s in saved:page.insert_text(s['origin'],s['text'],fontname=label_font(page,s),fontsize=s['size'],color=rgb(INK))
 if words(page)!=before:raise ValueError('Text changed at page '+str(page.number+1)+' '+repr(before-words(page))+' '+repr(words(page)-before))

def restore_links(doc,source):
 for i,p in enumerate(doc):
  known={tuple(round(v,2) for v in a['from']) for a in p.get_links()}
  for a in source[i].get_links():
   if tuple(round(v,2) for v in a['from']) in known:continue
   if a['kind']==fitz.LINK_URI:p.insert_link({'kind':fitz.LINK_URI,'from':a['from'],'uri':a['uri']})
   elif a['kind']==fitz.LINK_GOTO and isinstance(a.get('page'),int) and a['page']>=0:p.insert_link({'kind':fitz.LINK_GOTO,'from':a['from'],'page':a['page'],'to':a.get('to',fitz.Point(0,0))})

manifest=json.loads((SRC/'manifest.json').read_text());report=[];audit='--audit' in sys.argv;only=next((v.split('=',1)[1] for v in sys.argv if v.startswith('--only=')),None)
for b in manifest:
 if only and b['slug']!=only:continue
 source=fitz.open(SRC/b['file']);doc=fitz.open(SRC/b['file']);rows=[]
 for i in range(1,len(doc)):
  p=doc[i];regions,drawings,pix=find_regions(source[i])
  if not regions:continue
  regions.sort(key=lambda e:e['region'].y0,reverse=True)
  if not audit:
   for entry in regions:apply_region(p,entry,drawings,pix)
  rows.append(dict(page=i+1,regions=[dict(kind=e['kind'],bounds=[round(v,2) for v in e['region']],nodes=len(e['nodes'])) for e in regions]))
 if not audit:
  restore_links(doc,source)
  for i,p in enumerate(doc):assert words(p)==words(source[i]),(b['slug'],i+1,'word count')
  assert doc[0].get_pixmap().samples==source[0].get_pixmap().samples,(b['slug'],'cover changed')
  doc.subset_fonts();dest=OUT/b['file'];doc.save(dest,garbage=4,clean=True,deflate=True);check=fitz.open(dest)
  for i,p in enumerate(check):assert words(p)==words(source[i]),(b['slug'],i+1,'saved word count')
  assert check[0].get_pixmap().samples==source[0].get_pixmap().samples,(b['slug'],'saved cover changed')
  assert len(check)==len(source);assert sum(len(p.get_links()) for p in check)==sum(len(p.get_links()) for p in source),(b['slug'],'links changed')
 entry=dict(slug=b['slug'],file=b['file'],pages=len(doc),styledPages=len(rows),diagrams=sum(len(r['regions']) for r in rows),nodes=sum(e['nodes'] for r in rows for e in r['regions']),details=rows);report.append(entry)
 print(b['slug'],entry['styledPages'],'pages,',entry['diagrams'],'diagrams,',entry['nodes'],'nodes',flush=True)
(OUT/('audit.json' if audit else 'quality-report.json')).write_text(json.dumps(report,indent=2))
