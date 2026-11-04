"""Create smaller WebP variants from the existing approved cover artwork."""
from pathlib import Path
from PIL import Image
import hashlib,json,re

root=Path(__file__).resolve().parents[1]
templates=[root/'public/published-storefront.html',root/'public/testing-next.html']
text=templates[0].read_text()
covers=json.loads(re.search(r'const completedCovers=(\{[^;]+\});',text).group(1))
variants={}
for source in sorted(set(covers.values())):
    name=source.rsplit('/',1)[-1]
    originals=[root/'public/published-editorial-media'/name,root/'public/editorial-media'/name]
    images=[]
    for original in originals:
        image=Image.open(original);image.load()
        width,height=image.size
        thumb=original.with_name(original.stem+'-thumb-320.webp')
        image.resize((320,round(height*320/width)),Image.Resampling.LANCZOS).save(thumb,'WEBP',quality=85,method=6)
        images.append((original,thumb,width,height))
    # The current cover snapshots agree. Fail rather than silently make Testing
    # point to different bytes under a production immutable URL.
    assert originals[0].read_bytes()==originals[1].read_bytes(),name
    original,thumb,width,height=images[0]
    version=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()[:20]
    variants[source]={'thumb':'/Testing/media/'+thumb.name+'?v='+version(thumb),'full':source+'?v='+version(original),'width':width,'height':height,'originalBytes':original.stat().st_size,'thumbnailBytes':thumb.stat().st_size}

helper="""function coverImageAttrs(source,role='grid'){const v=coverVariants[source];if(!v)return 'src="'+source+'"';const sizes=role==='related'?'60px':role==='hero'?'(max-width:760px) 118px, 310px':role==='promo'?'100px':'(max-width:760px) 44vw, 280px';return 'src="'+v.thumb+'" srcset="'+v.thumb+' 320w, '+v.full+' '+v.width+'w" sizes="'+sizes+'"';}
"""
for template in templates:
    html=template.read_text()
    definition='const coverVariants='+json.dumps(variants,separators=(',',':'))+';\n'
    if re.search(r'^const coverVariants=',html,re.M):html=re.sub(r'^const coverVariants=.*\n',lambda _:definition,html,flags=re.M)
    else:html=re.sub(r'(const completedCovers=\{[^;]+\};\n)',lambda m:m[1]+definition+helper,html,count=1)
    html=html.replace('src="${completedCovers[b.id]}"','${coverImageAttrs(completedCovers[b.id])}')
    html=html.replace('<img src="\'+completedCovers[item.id]+\'" width="84"','<img \'+coverImageAttrs(completedCovers[item.id],\'related\')+\' width="84"')
    # Above-the-fold featured cover and the small bottom promotion are static.
    for role,marker in [('hero','width="630" height="1080"'),('promo','class="secrets-thumb"')]:
        def replace_image(match):
            tag=match[0]
            if marker not in tag:return tag
            v=variants['/Testing/media/editorial-art-of-attention-cover.webp']
            sizes='(max-width:760px) 118px, 310px' if role=='hero' else '100px'
            tag=re.sub(r'\s+srcset="[^"]*"|\s+sizes="[^"]*"','',tag)
            return re.sub(r'src="[^"]*"',lambda _:'src="'+v['thumb']+'" srcset="'+v['thumb']+' 320w, '+v['full']+' '+str(v['width'])+'w" sizes="'+sizes+'"',tag,count=1)
        html=re.sub(r'<img\b[^>]*editorial-art-of-attention-cover[^>]*>',replace_image,html)
    template.write_text(html)

(root/'public/cover-thumbnails.json').write_text(json.dumps(variants,indent=2)+'\n')
print(json.dumps({'covers':len(variants),'originalBytes':sum(v['originalBytes'] for v in variants.values()),'thumbnailBytes':sum(v['thumbnailBytes'] for v in variants.values())}))
