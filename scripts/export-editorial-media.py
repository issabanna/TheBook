from pathlib import Path
import json,fitz,re
from PIL import Image
R=Path(__file__).resolve().parents[1];p=R/'public/testing-next.html';s=p.read_text();D=R/'public/editorial-media';D.mkdir(exist_ok=True)
alias={'art-of-attention':'art-of-attention','life-secrets':'life-secrets','man-and-people':'man-and-people-guide','lead-without-the-noise':'lead-without-the-noise','sneakpeak-ideas':'sneakpeak-ideas'}
def readconst(name):
 i=s.index('const '+name+'=')+len('const '+name+'=');return json.JSONDecoder().raw_decode(s[i:])[0]
pages=readconst('actualPages');covers=readconst('completedCovers');exported={}
def image(stem,n,url):
 old=Path(url).name;name=old if old.startswith('editorial-') else 'editorial-'+old;doc=fitz.open(R/'private/publishing-preview'/(stem+'.pdf'));pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);im.save(D/name,'WEBP',quality=86,method=6);exported[url]='/Testing/media/'+name
for slug,stem in alias.items():
 for item in pages.get(slug,[]):image(stem,item['page'],item['src'])
for id,slug in {'life':'life-secrets','attention':'art-of-attention','ortega':'man-and-people','lead':'lead-without-the-noise','sneakpeak':'sneakpeak-ideas'}.items():image(alias[slug],1,covers[id])
for slug,stem in alias.items():
 for page in ([3,5,6] if slug=='art-of-attention' else []):image(stem,page,'/Testing/media/'+stem+'-page-'+str(page)+'.webp')
for old,new in exported.items():s=s.replace(old,new)
p.write_text(s);(R/'private/publishing-preview/media-map.json').write_text(json.dumps(exported,indent=2));print(str(len(exported))+' PDF-derived images exported; covers match actual revised PDFs.')
