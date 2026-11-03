"""Independent cold-render verification of the full Testing character collection."""
from pathlib import Path
from collections import Counter
import json,fitz,re,math
from PIL import Image,ImageDraw,ImageChops
R=Path(__file__).resolve().parents[1];OUT=R/'private/character-collection';BASE=R/'private/checkpoints/before-character-collection';reports=json.loads((OUT/'verification-report.json').read_text());s=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(s.split('const actualPages=',1)[1])[0]
words=lambda p:Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def image(p):
 x=p.get_pixmap(alpha=False);return Image.frombytes('RGB',(x.width,x.height),x.samples)
def links(p):
 result=[]
 for a in p.get_links():
  if a['kind']==fitz.LINK_URI:result.append(('uri',a.get('uri')))
  elif a['kind']==fitz.LINK_GOTO:result.append(('page',a.get('page')))
  elif a['kind']==fitz.LINK_NAMED and str(a.get('page','')).isdigit():result.append(('page',int(a['page'])-1))
  else:result.append((a['kind'],a.get('nameddest')))
 return Counter(result)
issues=[];pages=0;illustrated=0;tiles=[]
for b in reports:
 base=fitz.open(BASE/b['file']);book=fitz.open(OUT/b['file']);sample=fitz.open(OUT/(b['file'][:-4]+'-sample.pdf'));assert len(book)==len(base)==b['pages'];assert len(sample)==3
 assert image(base[0]).tobytes()==image(book[0]).tobytes(),(b['slug'],'Cover changed')
 for i,(old,new) in enumerate(zip(base,book)):
  pages+=1;assert words(old)==words(new),(b['slug'],i+1,'Words changed');assert links(old)==links(new),(b['slug'],i+1,'Link destinations changed')
  oldim=image(old);newim=image(new);detail=b['details'][i]
  if detail.get('addedHeight'):
   cut=detail['cut'];gap=detail['addedHeight'];assert abs(new.rect.height-old.rect.height-gap)<.02
   for span in spans(old):
    r=fitz.Rect(span['bbox']);shift=gap if r.y0>=cut else 0
    box=(max(0,math.floor(r.x0)),max(0,math.floor(r.y0)),min(oldim.width,math.ceil(r.x1)),min(oldim.height,math.ceil(r.y1)))
    target=(box[0],box[1]+shift,box[2],box[3]+shift)
    a=oldim.crop(box).convert('L');c=newim.crop(target).convert('L');ink=lambda im:sum(v<180 for v in im.getdata());aa,cc=ink(a),ink(c)
    if aa>=15 and (cc<aa*.75 or cc>aa*1.35) and abs(cc-aa)>15:issues.append((b['slug'],i+1,span['text'],aa,cc))
  for span in spans(new):assert (new.rect+fitz.Rect(-1,-1,1,1)).contains(fitz.Rect(span['bbox'])),(b['slug'],i+1,'Text outside page')
 for j,info in enumerate(actual[b['slug']]):assert image(sample[j]).tobytes()==image(book[info['page']-1]).tobytes(),(b['slug'],'Sample pixels differ',j)
 if b['slug']=='art-of-attention':assert image(base[5]).tobytes()==image(book[5]).tobytes(),('Approved proof changed')
 illustrated+=len(b['illustratedPages']);n=actual[b['slug']][-1]['page'];im=image(book[n-1]);im.thumbnail((280,620));tile=Image.new('RGB',(300,660),'#edf0f2');tile.paste(im,((300-im.width)//2,12));ImageDraw.Draw(tile).text((10,635),b['slug'],fill='#243642');tiles.append(tile)
assert not issues,('Text or diagram labels appear obscured',issues[:30])
for offset in range(0,len(tiles),6):
 group=tiles[offset:offset+6];sheet=Image.new('RGB',(900,660*((len(group)+2)//3)),'#edf0f2')
 for i,im in enumerate(group):sheet.paste(im,(i%3*300,i//3*660))
 sheet.save(OUT/('proof-sheet-'+str(offset//6+1)+'.png'))
(OUT/'quality-checks.json').write_text(json.dumps({'books':len(reports),'pages':pages,'illustratedPages':illustrated,'allWordsPreserved':True,'coversPreserved':True,'linkDestinationsPreserved':True,'samplePixelsMatch':True,'allTextWithinPage':True,'textVisibilityVerified':True},indent=2));print('Verified',len(reports),'books,',pages,'pages,',illustrated,'character pages and 17 exact three-page samples.',flush=True)
