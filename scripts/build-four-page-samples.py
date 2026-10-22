"""Canonical four-page sample policy. Full manuscripts and the free sampler stay intact."""
from pathlib import Path
import shutil
from pypdf import PdfReader, PdfWriter
ROOT=Path(__file__).resolve().parents[1]
BOOKS=ROOT/'private/books'
# Cover + three representative pages; PDF positions include the cover.
SAMPLE_PAGES={
 'life-secrets':[1,6,14,28],
 'art-of-attention':[1,5,6,7],
 'man-and-people-guide':[1,19,31,36],
 'lead-without-the-noise':[1,5,9,17],
 'the-philosopher-manager':[1,6,11,18],
 'time-for-what-matters':[1,6,11,18],
 'stand-out-for-something':[1,6,11,18],
}
if __name__=='__main__':
 for stem,pages in SAMPLE_PAGES.items():
  source=PdfReader(BOOKS/(stem+'.pdf'));writer=PdfWriter();writer.append(source,pages=[n-1 for n in pages],import_outline=False)
  for page in writer.pages:
   if '/Annots' in page:del page['/Annots']
  title=(source.metadata or {}).get('/Title',stem.replace('-',' ').title())
  writer.add_metadata({'/Title':title+' — Four-page free sample','/Author':'OPortals','/Subject':'Four-page sample: cover and three selected pages. Original page numbers retained.'+(' Independent OPortals commentary inspired by José Ortega y Gasset; not a translation or authorised edition.' if stem=='man-and-people-guide' else '')})
  writer.compress_identical_objects(remove_identicals=True,remove_orphans=True)
  target=BOOKS/(stem+'-sample.pdf');writer.write(target);assert len(PdfReader(target).pages)==4
  for folder in [BOOKS/'premium',BOOKS/'lead-edition' if stem=='lead-without-the-noise' else BOOKS/'premium/chapter-pilot' if stem=='art-of-attention' else BOOKS/'unused']:
   existing=folder/(stem+'-sample.pdf')
   if existing.exists():shutil.copy2(target,existing)
 shutil.copy2(BOOKS/'life-secrets-sample.pdf',ROOT/'public/Life-Secrets-Sample.pdf')
 print('Seven paid-book samples verified: four pages each. Free SneakPeak Ideas and full books unchanged.')
