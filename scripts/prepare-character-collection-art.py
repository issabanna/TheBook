"""Encode original imagegen masters for the Testing website and digital PDFs.

No scene, character or artwork geometry is changed. PDF layout frames unused
white canvas separately. Original PNG masters stay in version control.
"""
from pathlib import Path
import json
from PIL import Image
R=Path(__file__).resolve().parents[1];OUT=R/'private/character-collection';OUT.mkdir(exist_ok=True)
for key,source in json.loads((R/'brand/character-scenes/manifest.json').read_text()).items():
 image=Image.open(R/source)
 if key!='room':image.save(R/'public/editorial-media'/('testing-collection-character-'+key+'.webp'),'WEBP',quality=88,method=6)
 book=image.convert('RGB');book.thumbnail((600,440));book.save(OUT/(key+'.jpg'),'JPEG',quality=78,optimize=True)
print('Original scene masters encoded for web and digital-book layout.')
