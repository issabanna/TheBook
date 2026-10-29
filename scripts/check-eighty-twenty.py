"""Rendered-PDF publication checks, against the restored editions."""
from pathlib import Path
from collections import Counter
import json,re,fitz
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=Path('/workspace/outputs/OPortals-Eighty-Twenty');P=R/'private/publishing-preview';BASE=R/'private/checkpoints/before-eighty-twenty'
STEMS=['art-of-attention','life-secrets','man-and-people-guide','lead-without-the-noise','sneakpeak-ideas']
def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def uris(p):return Counter(x['uri'] for x in p.get_links() if x['kind']==fitz.LINK_URI)
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
report=[]
fitz.TOOLS.mupdf_warnings()
for stem in STEMS:
 d=fitz.open(P/(stem+'.pdf'));base=fitz.open(BASE/(stem+'.pdf'));assert len(d)==len(base)
 assert d[0].get_pixmap().samples==base[0].get_pixmap().samples,(stem,'cover pixels')
 thumbs=[];outbounds=[];overlaps=[];links=0
 for n,p in enumerate(d):
  assert words(p)==words(base[n]),(stem,n+1,'word preservation')
  assert uris(p)==uris(base[n]),(stem,n+1,'external links')
  assert len(p.get_links())>=len(base[n].get_links()),(stem,n+1,'navigation count')
  for a in p.get_links():
   if a['kind']==fitz.LINK_GOTO:assert 0<=a['page']<len(d),(stem,n+1,'destination')
  links+=len(p.get_links());ss=spans(p)
  for s in ss:
   r=fitz.Rect(s['bbox'])
   if not (p.rect+fitz.Rect(-.2,-.2,.2,.2)).contains(r):outbounds.append((n+1,s['text']))
  # Render every page, including original functional exercises and references.
  pix=p.get_pixmap(matrix=fitz.Matrix(.7,.7),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);im.thumbnail((210,380))
  tile=Image.new('RGB',(224,405),'#eae8df');tile.paste(im,((224-im.width)//2,8));ImageDraw.Draw(tile).text((8,386),str(n+1),fill='#30382b');thumbs.append(tile)
  if n in [4,5,6,7,8,9,13,18,27,35]:
   pix=p.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False);Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(D/(stem+'-'+str(n+1)+'.png'))
 assert not outbounds,(stem,'text outside page',outbounds)
 for start in range(0,len(thumbs),16):
  items=thumbs[start:start+16];sheet=Image.new('RGB',(896,405*((len(items)+3)//4)),'#eae8df')
  for i,im in enumerate(items):sheet.paste(im,((i%4)*224,(i//4)*405))
  sheet.save(D/(stem+'-sheet-'+str(start//16+1)+'.jpg'),quality=90)
 if stem!='sneakpeak-ideas':
  sample=fitz.open(P/(stem+'-sample.pdf'));assert len(sample)==4
  choices={'art-of-attention':[1,5,6,7],'life-secrets':[1,9,10,28],'man-and-people-guide':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}[stem]
  for i,n in enumerate(choices):assert sample[i].get_pixmap().samples==d[n-1].get_pixmap().samples,(stem,'sample pixels')
 report.append(dict(book=stem,pages=len(d),allWordsPreserved=True,restoredCoverUnchanged=True,externalLinksPreserved=True,links=links,textWithinPage=True,allPagesRendered=True))
warnings=fitz.TOOLS.mupdf_warnings();assert not warnings,('PDF warnings',warnings)
d=fitz.open(P/'art-of-attention.pdf');chapter=fitz.open()
for n in [5,6,7,8]:chapter.insert_pdf(d,from_page=n-1,to_page=n-1,links=False)
chapter.set_metadata({'title':'The Art of Attention — Chapter 1 — 80/20 layout preview','author':'OPortals'});chapter.save(D/'Attention-Chapter-1-Preview.pdf',garbage=4,deflate=True)
(D/'quality-checks.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
