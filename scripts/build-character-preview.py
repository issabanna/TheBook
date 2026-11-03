"""Prepare a Testing-only recurring-character book proof and future-post concept."""
from pathlib import Path
from collections import Counter
import fitz,json,re,hashlib,shutil
from PIL import Image
R=Path(__file__).resolve().parents[1];OUT=R/'private/character-preview';OUT.mkdir(exist_ok=True);MEDIA=R/'public/editorial-media';BASE=R/'private/checkpoints/before-character-preview';BASE.mkdir(exist_ok=True)
source=R/'private/white-interiors/art-of-attention.pdf';scene=R/'brand/references/oportals-character-room.png';before=fitz.open(source);doc=fitz.open(source);page=doc[5]
images=page.get_images();assert len(images)==1;image_id=images[0][0];assert [i+1 for i,p in enumerate(doc) if any(x[0]==image_id for x in p.get_images())]==[6]
# The old photograph has a clipping window. Clear only that illustration slot,
# then fit the complete character scene so heads and feet are never cropped.
page.delete_image(image_id);page.draw_rect(fitz.Rect(22,159,398,332),color=None,fill=(1,1,1),overlay=True);page.insert_image(fitz.Rect(30,160,390,331),filename=str(scene),keep_proportion=True,overlay=True)
dest=OUT/'art-of-attention.pdf';doc.save(dest,garbage=4,deflate=True);revised=fitz.open(dest)
words=lambda p:Counter(re.findall(r'\w+',p.get_text(),flags=re.U))
assert len(revised)==len(before)==32
for i,(a,b) in enumerate(zip(before,revised)):
 assert words(a)==words(b),(i+1,'Text changed')
 if i!=5:assert a.get_pixmap().samples==b.get_pixmap().samples,(i+1,'Unrelated page changed')
assert sum(len(p.get_links()) for p in before)==sum(len(p.get_links()) for p in revised)
sample=fitz.open()
for n in [1,5,6]:sample.insert_pdf(revised,from_page=n-1,to_page=n-1,links=False)
sample.set_metadata({'title':'The Art of Attention — Character illustration preview','author':'OPortals','subject':'Cover and two selected pages. Original page numbers retained.'});sample.subset_fonts();sample_path=OUT/'art-of-attention-sample.pdf';sample.save(sample_path,garbage=4,deflate=True);assert len(fitz.open(sample_path))==3
for i,n in enumerate([1,5,6]):assert fitz.open(sample_path)[i].get_pixmap().samples==revised[n-1].get_pixmap().samples
for name in ['art-of-attention.pdf','art-of-attention-sample.pdf']:
 if not (BASE/name).exists():shutil.copy2(R/'private/white-interiors'/name,BASE/name)
# Format conversion only. The illustration itself comes from image generation.
Image.open(scene).save(MEDIA/'testing-collection-character-room.webp','WEBP',quality=93,method=6)
p=revised[5];pix=p.get_pixmap(matrix=fitz.Matrix(630/p.rect.width,630/p.rect.width),alpha=False);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(MEDIA/'editorial-art-of-attention-page-6.webp','WEBP',quality=91,method=6)
# A typeset 4:5 post concept: OPortals fonts and wordmark, with the same new scene.
fonts={'display':R/'public/design-fonts/Anton-Regular.ttf','body':Path('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'),'logo':Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')};ff={k:fitz.Font(fontfile=str(v)) for k,v in fonts.items()}
post=fitz.open();p=post.new_page(width=540,height=675)
for k,v in fonts.items():p.insert_font(fontname='Post'+k,fontfile=str(v))
def text(t,x,y,size=12,k='body',color=(.12,.14,.15)):p.insert_text((x,y),t,fontname='Post'+k,fontsize=size,color=color)
def centered(t,y,size=12,k='body',color=(.12,.14,.15)):
 text(t,(540-ff[k].text_length(t,fontsize=size))/2,y,size,k,color)
logo_size=22;ox=(540-ff['logo'].text_length('OPortals.com',fontsize=logo_size))/2;text('O',ox,35,logo_size,'logo',(.4078,.451,.2941));text('Portals.com',ox+ff['logo'].text_length('O',fontsize=logo_size),35,logo_size,'logo')
centered('FIELD NOTES / ATTENTION',66,8)
centered('SAME ROOM.',119,43,'display');centered('DIFFERENT WORLDS.',170,43,'display')
p.insert_image(fitz.Rect(30,183,510,520),filename=str(scene),keep_proportion=True)
centered('A familiar place holds more than one person notices.',550,12)
centered('Attention helps determine which details come forward.',570,12)
centered('WHAT DID YOU WALK PAST',619,19,'display');centered('WITHOUT NOTICING TODAY?',644,19,'display')
post.save(OUT/'next-post-concept.pdf',garbage=4,deflate=True);pix=p.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);assert (pix.width,pix.height)==(1080,1350);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(MEDIA/'testing-collection-character-next-post.webp','WEBP',quality=95,method=6);pix.save(OUT/'next-post-concept.png')
jobs=[{'name':'art-of-attention.pdf','path':str(dest.relative_to(R))},{'name':'art-of-attention-sample.pdf','path':str(sample_path.relative_to(R)),'pageCount':3}];(OUT/'encryption-jobs.json').write_text(json.dumps(jobs,indent=2))
report={'book':'art-of-attention','pageCount':32,'changedPages':[6],'samplePages':[1,5,6],'samplePageCount':3,'textAndOtherPagesPreserved':True,'postDimensions':[1080,1350],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sampleSha256':hashlib.sha256(sample_path.read_bytes()).hexdigest()};(OUT/'verification-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
