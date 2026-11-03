"""Canonical three-page sample policy: cover plus two selected inside pages."""
from pathlib import Path
import json,fitz,shutil
R=Path(__file__).resolve().parents[1]
SELECTION={'life-secrets':[1,9,10],'art-of-attention':[1,5,6],'man-and-people-guide':[1,5,19],'lead-without-the-noise':[1,5,7],'the-philosopher-manager':[1,6,11],'time-for-what-matters':[1,6,11],'stand-out-for-something':[1,6,11]}
def build():
 catalogue=json.loads((R/'src/testing-catalogue.json').read_text());jobs=[(stem,ns,R/'private/publishing-preview' if (R/'private/publishing-preview'/(stem+'.pdf')).exists() else R/'private/books') for stem,ns in SELECTION.items()]
 jobs += [(b['slug'],[1,4,5],R/'private/catalogue-expansion/pdf') for b in catalogue]
 for stem,ns,folder in jobs:
  src=fitz.open(folder/(stem+'.pdf'));out=fitz.open()
  for n in ns:out.insert_pdf(src,from_page=n-1,to_page=n-1,links=False)
  out.set_metadata({'title':src.metadata.get('title',stem)+' — Three-page sample','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});out.subset_fonts();dest=folder/(stem+'-sample.pdf');out.save(dest,garbage=4,clean=True,deflate=True);assert len(fitz.open(dest))==3
  # Legacy encryption workflows read private/books.
  legacy=R/'private/books'/dest.name
  if folder!=legacy.parent and legacy.exists():shutil.copy2(dest,legacy)
  if stem=='life-secrets':shutil.copy2(dest,R/'public/Life-Secrets-Sample.pdf')
 print('All 17 paid-book samples contain three pages. Complete editions and the retired free anthology are untouched.')
if __name__=='__main__':build()
