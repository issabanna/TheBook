"""Extend the approved social-poster typography and art direction to every page.

The saved pre-expansion PDFs are authoritative. Text remains selectable, every
word and link is checked, useful exercise diagrams remain native PDF vectors.
New imagegen artwork is placed through PDF clipping, never stretched or edited.
"""
from pathlib import Path
from collections import Counter
from io import BytesIO
import fitz, importlib.util, json, re, sys
from PIL import Image, ImageDraw

R=Path(__file__).resolve().parents[1]
BASE=R/'private/checkpoints/before-social-collection'
OUT=R/'private/publishing-preview'
DEL=Path('/workspace/outputs/OPortals-Social-Collection');DEL.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('social',R/'scripts/build-social-theme-preview.py')
S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
STEMS=['art-of-attention','life-secrets','man-and-people-guide','lead-without-the-noise','sneakpeak-ideas']
CHAPTERS={'art-of-attention':[5,9,13,17,21,25],'life-secrets':[9,5,13,17,21,25],
 'man-and-people-guide':[5,11,17,23,29,35],'lead-without-the-noise':[5,7,9,10,13,17]}
PALETTES={'art-of-attention':('#245389','#cfe8f1'),'life-secrets':('#53674c','#dce8cf'),
 'man-and-people-guide':('#635079','#e9e0f0'),'lead-without-the-noise':('#326a68','#dcece7'),
 'sneakpeak-ideas':('#68734b','#f5e8b9')}
TITLES={'art-of-attention':'The Art of Attention','life-secrets':'Life Secrets',
 'man-and-people-guide':'Man and People','lead-without-the-noise':'Lead Without the Noise','sneakpeak-ideas':'SneakPeak Ideas'}
SAMPLES={'art-of-attention':[1,5,6,7],'life-secrets':[1,9,10,28],
 'man-and-people-guide':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}
FONTS={k:fitz.Font(fontfile=str(v)) for k,v in S.FONT.items()}
FONTS['fallback']=fitz.Font(fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
ART={}

def words(p):return Counter(re.findall(r'\w+',p.get_text()))
def spans(p):return [s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def color(n):return tuple(((n>>v)&255)/255 for v in (16,8,0))
def image_page(path):
 im=Image.open(path).convert('RGB');buf=BytesIO();im.save(buf,'JPEG',quality=91,optimize=True)
 d=fitz.open();p=d.new_page(width=im.width,height=im.height);p.insert_image(p.rect,stream=buf.getvalue());return d
def symbol(p,stem,index,box):
 d=ART[stem];w=d[0].rect.width/3;h=d[0].rect.height/2
 x=index%3*w;y=index//3*h
 p.show_pdf_page(box,d,0,clip=fitz.Rect(x+10,y+10,x+w-10,y+h-10),keep_proportion=True)

def cover(stem,s):
 d=fitz.open();p=d.new_page(width=420,height=s.rect.height);h=p.rect.height
 S.logo(p,39,16,True);S.center(p,'PHILOSOPHY FOR EVERYDAY LIFE',76,8,'bold',S.GREY)
 if stem=='life-secrets':
  S.center(p,'Life',108,65,'display','#10151b');S.center(p,'Secrets',181,78,'display','#10151b')
  S.center(p,'18 ILLUSTRATED IDEAS',280,8,'bold',PALETTES[stem][0])
  symbol(p,stem,0,fitz.Rect(43,317,377,564))
  S.text(p,'Small philosophical ideas for the choices you make every day.',48,611,324,12,'body',S.NAVY)
 elif stem=='man-and-people-guide':
  S.center(p,'Man and',112,60,'display','#10151b');S.center(p,'People',184,78,'display','#10151b')
  S.center(p,'Notice the expectations shaping your choices.',290,11,'body',S.NAVY)
  symbol(p,stem,4,fitz.Rect(42,328,378,576))
  S.text(p,'Independent OPortals companion to José Ortega y Gasset',46,617,328,10,'body',PALETTES[stem][0])
 elif stem=='lead-without-the-noise':
  S.center(p,'Lead Without',104,56,'display','#10151b');S.center(p,'the Noise',170,64,'display','#10151b')
  S.center(p,'Clarity. Listening. Responsibility.',252,10,'body',PALETTES[stem][0])
  symbol(p,stem,0,fitz.Rect(54,291,366,477))
  S.center(p,'Lead with clarity. Listen with care.',501,11.7,'body',S.NAVY)
 else:
  S.center(p,'SneakPeak',116,63,'display','#10151b');S.center(p,'Ideas',191,84,'display','#10151b')
  # Three different ideas signal the anthology without repeating a cover.
  symbol(p,'life-secrets',0,fitz.Rect(17,347,159,515))
  symbol(p,'man-and-people-guide',1,fitz.Rect(139,333,281,501))
  symbol(p,'lead-without-the-noise',2,fitz.Rect(261,347,403,515))
  S.center(p,'One page. A question to take into your day.',590,12,'body',S.NAVY)
 foot='SELECTED EXCERPTS & CLEARLY MARKED FUTURE PREVIEWS' if stem=='sneakpeak-ideas' else 'ORIGINAL ILLUSTRATIONS · REFLECTIONS · EVERYDAY LIFE'
 p.draw_line((65,h-52),(355,h-52),color=S.rgb('#d8e0e5'),width=.6)
 S.center(p,foot,h-30,7,'bold',S.GREY)
 assert words(p)==words(s),(stem,'cover words',words(s)-words(p),words(p)-words(s))
 return d

def restyle(p,stem):
 """Retain authored line breaks and diagram coordinates; replace font system."""
 ss=spans(p);accent=PALETTES[stem][0]
 # Removing only text preserves vector relations, answer fields and original art.
 for s in ss:p.add_redact_annot(fitz.Rect(s['bbox']),fill=False)
 p.apply_redactions(images=0,graphics=0)
 for s in ss:
  t=s['text'];r=fitz.Rect(s['bbox']);sz=s['size'];old=color(s['color'])
  islogo=r.y0<45 and (t in ['O','Portals.com','OPortals.com'])
  display=sz>=18 and t.strip() not in ['≠','→','+','=','?']
  k='logo' if islogo else 'display' if display else 'bold' if 'Bold' in s['font'] or 'bold' in s['font'] else 'body'
  if not all(FONTS[k].has_glyph(ord(c)) for c in t):k='fallback'
  fn='Collection'+k
  p.insert_font(fontname=fn,fontfile=str(S.FONT[k]) if k!='fallback' else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
  # Preserve existing left/right labels, centred logo and margins without collision.
  avail=max(r.width,p.rect.width-30-r.x0) if display else r.width+.35
  need=FONTS[k].text_length(t,fontsize=sz)
  if need>avail:sz*=avail/need
  if display:
   # Keep the source title envelope: stronger type with the same line spacing.
   sz=min(sz*1.12,s['size']*1.12,sz*avail/max(need,.01))
   sz=min(sz,(r.height+.5)/(FONTS[k].ascender-FONTS[k].descender))
  if min(old)>.78:c=old # Light text on genuine dark diagram/source bands.
  elif islogo:c=S.rgb(S.OLIVE if t=='O' else '#111111')
  elif display:c=S.rgb('#10151b')
  elif r.x0>=313 and 50<r.y0<p.rect.height-35:c=S.rgb(accent)
  elif t.isupper() and sz<10:c=S.rgb(accent)
  else:c=S.rgb(S.INK if sz>=9 else S.GREY)
  # Use identical top alignment and scale line height to stay inside its envelope.
  baseline=r.y0+FONTS[k].ascender*sz
  if k=='logo':baseline=s['origin'][1]
  p.insert_text((s['origin'][0],baseline),t,fontname=fn,fontsize=sz,color=c)

def change_art(p,stem,n):
 if n not in CHAPTERS.get(stem,[]):return 'KEEP — useful diagram or supporting artwork'
 if stem=='art-of-attention' and n==5:return 'KEEP — approved attention artwork'
 # Actual 80/20 edition images have the explicit 1440px production width.
 boxes=[fitz.Rect(i['bbox']) for i in p.get_image_info() if i['width']==1440 and i['bbox'][1]>80]
 if not boxes:return 'KEEP — functional diagram communicates the distinction'
 r=boxes[0];before=words(p)
 # Refuse to cover any caption, prose, title or exercise.
 assert not any(r.intersects(fitz.Rect(s['bbox'])) for s in spans(p)),(stem,n,'art overlaps text')
 p.add_redact_annot(r,fill=(1,1,1));p.apply_redactions(images=2,graphics=0)
 symbol(p,stem,CHAPTERS[stem].index(n),r)
 assert words(p)==before,(stem,n,'art must preserve all words')
 return 'REPLACE — original conceptual editorial illustration'

def build_paid(stem):
 base=fitz.open(BASE/(stem+'.pdf'));d=fitz.open(BASE/(stem+'.pdf'));report=[]
 for i,p in enumerate(d):
  n=i+1
  if stem=='art-of-attention' and n in [1,5,6]:
   report.append(dict(page=n,typography='KEEP — approved design reference',visual='KEEP — approved illustration'));continue
  if n==1:
   c=cover(stem,base[i]);p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,c,0)
   art='REPLACE — distinct book-specific conceptual cover'
  else:
   art=change_art(p,stem,n);restyle(p,stem)
  assert words(p)==words(base[i]),(stem,n,'word preservation',words(base[i])-words(p),words(p)-words(base[i]))
  report.append(dict(page=n,typography='Social-poster display + readable Open Sans',visual=art))
 save(d,base,stem);return report

def save(d,base,stem):
 # Keep type and native diagrams vector-sharp; size raster art for a digital
 # reading edition so Testing and production can coexist within hosting limits.
 d.rewrite_images(dpi_threshold=200,dpi_target=170,quality=82,
                  lossy=True,lossless=True,bitonal=False,color=True,gray=True)
 if stem=='art-of-attention':
  # The previously approved three pages remain pixel-identical, including art.
  for n in [1,5,6]:
   p=d[n-1];p.add_redact_annot(p.rect,fill=False)
   p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,base,n-1)
 # PDF redaction may remove a link whose clickable rectangle touches text.
 # Restore the authoritative navigation after all page content mutations.
 for i,p in enumerate(d):
  for a in p.get_links():p.delete_link(a)
  for a in base[i].get_links():
   item={k:a[k] for k in ['kind','from','uri','page','to','zoom','file','nameddest'] if k in a}
   p.insert_link(item)
 d.set_metadata(base.metadata);d.subset_fonts()
 p=OUT/(stem+'.pdf');d.save(p,garbage=4,clean=True,deflate=True)
 (DEL/p.name).write_bytes(p.read_bytes())

def sampler():
 stem='sneakpeak-ideas';base=fitz.open(BASE/(stem+'.pdf'));d=fitz.open(BASE/(stem+'.pdf'))
 mapping=json.loads((R/'private/books/premium/sampler-source-map.json').read_text())
 lookup={e['sampler_page']:e for e in mapping};report=[]
 for i,p in enumerate(d):
  n=i+1;e=lookup.get(n)
  if n==1:
   c=cover(stem,base[i]);p.add_redact_annot(p.rect,fill=False);p.apply_redactions(images=2,graphics=2);p.show_pdf_page(p.rect,c,0)
   layout='REPLACE — anthology cover'
  elif e and e['book'] in STEMS[:4]:
   book=fitz.open(OUT/(e['book']+'.pdf'));q=book[e['source_page']-1]
   assert abs(p.rect.height-q.rect.height-40)<1,(n,'sampler source dimensions')
   # Source/status strip remains visible; complete excerpt matches the paid edition.
   p.add_redact_annot(fitz.Rect(0,40,420,p.rect.height),fill=(1,1,1));p.apply_redactions(images=2,graphics=2)
   restyle(p,stem);p.show_pdf_page(fitz.Rect(0,40,420,p.rect.height),book,q.number)
   layout='Matching excerpt from revised paid book; source/status retained'
  else:restyle(p,stem);layout='Restyled introduction, exercise, source notes or future preview'
  assert words(p)==words(base[i]),(stem,n,'words',words(base[i])-words(p),words(p)-words(base[i]))
  report.append(dict(page=n,typography='Social-poster display + readable Open Sans',visual=layout))
 save(d,base,stem);return report

def samples():
 for stem,ns in SAMPLES.items():
  book=fitz.open(OUT/(stem+'.pdf'));d=fitz.open()
  for n in ns:d.insert_pdf(book,from_page=n-1,to_page=n-1,links=False)
  d.set_metadata({'title':TITLES[stem]+' — Four-page sample','author':'OPortals','subject':'Cover and three selected pages; original page numbers retained.'})
  p=OUT/(stem+'-sample.pdf');d.save(p,garbage=4,deflate=True);(DEL/p.name).write_bytes(p.read_bytes())

if __name__=='__main__':
 paths=json.loads(Path(sys.argv[1]).read_text())
 for k,v in paths.items():ART[k]=image_page(v)
 reports={stem:build_paid(stem) for stem in STEMS[:4]};reports['sneakpeak-ideas']=sampler();samples()
 (DEL/'page-by-page-design-report.json').write_text(json.dumps(reports,indent=2)+'\n')
 (DEL/'Anton-OFL.txt').write_bytes((R/'public/design-fonts/Anton-OFL.txt').read_bytes())
 print(json.dumps({k:len(v) for k,v in reports.items()}))
