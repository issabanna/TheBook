"""Check all rendered pages, wording, page dimensions, links and exact samples."""
from pathlib import Path
from collections import Counter
import fitz,json,re,importlib.util
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('collection',R/'scripts/build-social-collection.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
D=C.DEL
def signature(p):
 return Counter((a['kind'],a.get('uri'),a.get('page')) for a in p.get_links())
report=[];proof=fitz.open();total=0
fitz.TOOLS.mupdf_warnings()
for stem in C.STEMS:
 d=fitz.open(C.OUT/(stem+'.pdf'));b=fitz.open(C.BASE/(stem+'.pdf'));assert len(d)==len(b)
 tiles=[];changed=[];outbounds=[]
 for i,p in enumerate(d):
  assert C.words(p)==C.words(b[i]),(stem,i+1,'words')
  assert p.rect==b[i].rect,(stem,i+1,'dimensions')
  assert signature(p)==signature(b[i]),(stem,i+1,'navigation',signature(p),signature(b[i]))
  for a in p.get_links():
   if a['kind']==fitz.LINK_GOTO:assert 0<=a['page']<len(d),(stem,i+1,'link destination')
  for s in C.spans(p):
   if not (p.rect+fitz.Rect(-.3,-.3,.3,.3)).contains(fitz.Rect(s['bbox'])):outbounds.append((i+1,s['text']))
  pix=p.get_pixmap(matrix=fitz.Matrix(.65,.65),alpha=False)
  if pix.samples!=b[i].get_pixmap(matrix=fitz.Matrix(.65,.65),alpha=False).samples:changed.append(i+1)
  im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);im.thumbnail((210,380))
  tile=Image.new('RGB',(224,405),'#eaecef');tile.paste(im,((224-im.width)//2,8));ImageDraw.Draw(tile).text((8,386),str(i+1),fill='#152e4d');tiles.append(tile)
  if i in [0,4,5,8,18,27,35]:
   px=p.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False)
   Image.frombytes('RGB',[px.width,px.height],px.samples).save(D/(stem+'-'+str(i+1)+'.png'))
 assert not outbounds,(stem,'text outside page',outbounds)
 assert changed==[i+1 for i in range(len(d)) if not (stem=='art-of-attention' and i+1 in [1,5,6])],(stem,'every page included',changed)
 for start in range(0,len(tiles),16):
  items=tiles[start:start+16];sheet=Image.new('RGB',(896,405*((len(items)+3)//4)),'#eaecef')
  for i,im in enumerate(items):sheet.paste(im,((i%4)*224,(i//4)*405))
  sheet.save(D/(stem+'-sheet-'+str(start//16+1)+'.jpg'),quality=89)
 choices=C.SAMPLES.get(stem,[1,2,3,7])
 for n in choices:proof.insert_pdf(d,from_page=n-1,to_page=n-1,links=False)
 if stem in C.SAMPLES:
  s=fitz.open(C.OUT/(stem+'-sample.pdf'));assert len(s)==4
  for i,n in enumerate(C.SAMPLES[stem]):assert s[i].get_pixmap().samples==d[n-1].get_pixmap().samples,(stem,'sample equality')
 total+=len(d);report.append(dict(book=stem,pages=len(d),changedPages=changed,wordsPreserved=True,linksPreserved=True,dimensionsPreserved=True,allPagesRendered=True,textWithinPage=True))
warnings=fitz.TOOLS.mupdf_warnings();assert not warnings,('PDF warnings',warnings)
proof.set_metadata({'title':'OPortals — Complete collection design review','author':'OPortals','subject':'Five covers and selected real pages from the full redesigned collection.'})
proof.save(D/'Collection-Design-Review.pdf',garbage=4,deflate=True)
(D/'quality-checks.json').write_text(json.dumps({'totalPages':total,'books':report},indent=2)+'\n')
print(json.dumps({'totalPages':total,'books':report},indent=2))
