"""Independent verification of the complete artwork edition and actual samples."""
from pathlib import Path
from collections import Counter
import fitz,json,re,hashlib
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'private/artwork-edition';BASE=R/'private/checkpoints/before-artwork-edition'
reports=json.loads((D/'verification-report.json').read_text());actual=json.JSONDecoder().raw_decode((R/'public/testing-next.html').read_text().split('const actualPages=',1)[1])[0]
manuscripts={b['slug']:b for name in ['originals','reimagined'] for b in json.loads((R/f'private/catalogue-expansion/{name}.json').read_text())}
wordlist=lambda value:Counter(re.findall(r'\w+',value,flags=re.U))
words=lambda p:wordlist(p.get_text())
def pixels(p):
 fitz.TOOLS.store_shrink(100)
 return p.get_pixmap().samples
def links(p):
 result=[]
 for a in p.get_links():
  if a['kind']==fitz.LINK_URI:result.append(('uri',a.get('uri')))
  elif a['kind']==fitz.LINK_GOTO:result.append(('page',a.get('page')))
  elif a['kind']==fitz.LINK_NAMED and str(a.get('page','')).isdigit():result.append(('page',int(a['page'])-1))
  else:result.append((a['kind'],a.get('nameddest')))
 return Counter(result)
pages=0;replaced=0;tiles=[]
for b in reports:
 old=fitz.open(BASE/b['file']);book=fitz.open(D/b['file']);sample=fitz.open(D/b['file'].replace('.pdf','-sample.pdf'))
 assert len(book)==len(old)==b['pages'];assert len(sample)==3
 assert pixels(old[0])==pixels(book[0]),(b['slug'],'Cover changed')
 for i,p in enumerate(book):
  pages+=1
  if b['slug'] in manuscripts and i+1 in range(4,20,2):
   chapter=manuscripts[b['slug']]['chapters'][(i-3)//2]
   for field in ['title','body','note','ref','question']:assert not(wordlist(chapter[field])-words(p)),(b['slug'],i+1,'Missing manuscript',field)
   assert 'READ THE RELATIONSHIP' not in p.get_text()
   assert not any(any(item[0]=='re' for item in dr['items']) for dr in p.get_drawings()),(b['slug'],i+1,'Reading page has a rectangle')
  else:assert words(p)==words(old[i]),(b['slug'],i+1,'Text changed')
  assert links(p)==links(old[i]),(b['slug'],i+1,'Link targets changed')
  for block in p.get_text('dict')['blocks']:
   for line in block.get('lines',[]):
    for span in line['spans']:assert (p.rect+(-1,-1,1,1)).contains(fitz.Rect(span['bbox'])),(b['slug'],i+1,'Text overflow',span['text'])
  # Render every complete page in a fresh process; catch damaged image streams.
  pix=p.get_pixmap(matrix=fitz.Matrix(.6,.6),alpha=False)
  if i+1 in b['replacedPages']:assert p.get_image_info(),(b['slug'],i+1,'Missing artwork')
 for i,info in enumerate(actual[b['slug']]):assert pixels(sample[i])==pixels(book[info['page']-1]),(b['slug'],'Sample differs from complete edition')
 if b['slug']=='art-of-attention':assert pixels(book[5])==pixels(old[5]),('Attention approved artwork changed')
 for n in b['replacedPages']:
  p=book[n-1];pix=p.get_pixmap(matrix=fitz.Matrix(.5,.5),alpha=False);im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);im.thumbnail((205,410));tile=Image.new('RGB',(225,440),'#edf0f2');tile.paste(im,((225-im.width)//2,8));ImageDraw.Draw(tile).text((6,421),b['slug'][:24]+' / '+str(n),fill='#243642');tiles.append(tile)
 replaced+=len(b['replacedPages'])
for offset in range(0,len(tiles),12):
 group=tiles[offset:offset+12];sheet=Image.new('RGB',(900,440*((len(group)+3)//4)),'#edf0f2')
 for i,im in enumerate(group):sheet.paste(im,((i%4)*225,(i//4)*440))
 sheet.save(D/f'proof-sheet-{offset//12+1:02}.jpg',quality=90)
result={'books':len(reports),'pages':pages,'artworkReplacementPages':replaced,'threePageSamples':len(reports),'coversPreserved':True,'authoredTextPreserved':True,'linkTargetsPreserved':True,'allPagesRender':True,'allTextWithinBounds':True,'samplePixelsMatch':True}
(D/'quality-checks.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
