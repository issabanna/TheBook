"""Losslessly package the existing embedded typefaces as cached WOFF2 files."""
from pathlib import Path
from io import BytesIO
import re,base64,hashlib,json
from fontTools.ttLib import TTFont
R=Path(__file__).resolve().parents[1];D=R/'public/seo-fonts';D.mkdir(exist_ok=True);manifest={};before=0;after=0
for name in ['testing-next.html','published-storefront.html','social-mirror-shell.html','social-mirror-published.html']:
 for value in re.findall(r'data:font/ttf;base64,([A-Za-z0-9+/=]+)',(R/'public'/name).read_text()):
  raw=base64.b64decode(value);digest=hashlib.sha256(raw).hexdigest()
  if digest in manifest:continue
  font=TTFont(BytesIO(raw),recalcTimestamp=False);order=font.getGlyphOrder();cmap=font.getBestCmap();metrics=dict(font['hmtx'].metrics);font.flavor='woff2';encoded=BytesIO();font.save(encoded);data=encoded.getvalue();file=hashlib.sha256(data).hexdigest()[:20]+'.woff2';(D/file).write_bytes(data)
  check=TTFont(D/file);assert check.getGlyphOrder()==order and check.getBestCmap()==cmap and check['hmtx'].metrics==metrics
  manifest[digest]={'file':file,'type':'font/woff2'};before+=len(raw);after+=(D/file).stat().st_size
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for file in D.glob('*.woff2'):
 if file.name not in {v['file'] for v in manifest.values()}:file.unlink()
print('Same glyphs and metrics verified:',len(manifest),'fonts;',before,'bytes →',after,'bytes in cached WOFF2.')
