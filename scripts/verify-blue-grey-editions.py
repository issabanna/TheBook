"""Check every complete edition, sample and rollback baseline before publication."""
from pathlib import Path
from collections import Counter
import json,re,hashlib,fitz
R=Path(__file__).resolve().parents[1];base=R/'private/checkpoints/before-blue-grey';out=R/'private/blue-grey-editions'
s=(R/'public/testing-next.html').read_text();actual=json.JSONDecoder().raw_decode(s.split('const actualPages=',1)[1])[0]
words=lambda p:Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
records=json.loads((R/'src/encrypted-testing-editions.json').read_text());published=json.loads((R/'src/encrypted-published-editions.json').read_text());report=[]
for b in json.loads((base/'manifest.json').read_text()):
 original=fitz.open(base/b['file']);styled=fitz.open(out/b['file']);sample_name=b['file'][:-4]+'-sample.pdf';sample=fitz.open(out/sample_name)
 assert len(original)==len(styled)==b['pages'];assert len(sample)==3
 assert all(words(a)==words(c) for a,c in zip(original,styled)),b['slug']
 assert original[0].get_pixmap().samples==styled[0].get_pixmap().samples,b['slug']
 assert sum(len(p.get_links()) for p in original)==sum(len(p.get_links()) for p in styled)
 for i,info in enumerate(actual[b['slug']]):
  assert words(sample[i])==words(styled[info['page']-1]),(b['slug'],i)
  assert sample[i].get_pixmap().samples==styled[info['page']-1].get_pixmap().samples,(b['slug'],'sample pixels',i)
 for name in [b['file'],sample_name]:assert records[name]==published[name] and records[name]['keyEnv']=='BLUE_GREY_EDITION_KEY'
 assert records[sample_name]['pageCount']==3
 report.append({'slug':b['slug'],'file':b['file'],'pages':b['pages'],'samplePages':3,'sha256':hashlib.sha256((out/b['file']).read_bytes()).hexdigest(),'sampleSha256':hashlib.sha256((out/sample_name).read_bytes()).hexdigest()})
(out/'verification-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'books':len(report),'pages':sum(b['pages'] for b in report),'coversUnchanged':True,'textAndLinksPreserved':True,'samplesMatchFullPdfExactly':True,'publishedAndTestingMatch':True}))
