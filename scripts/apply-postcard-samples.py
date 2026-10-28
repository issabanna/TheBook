"""Keep four-page sample images and captions identical to the selected PDF pages."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];p=R/'public/testing-next.html';s=p.read_text()
start=s.index('const actualPages=')+len('const actualPages=');data,end=json.JSONDecoder().raw_decode(s[start:])
for slug,nums in {'life-secrets':[1,9,10,28],'man-and-people':[1,5,19,36],'lead-without-the-noise':[1,5,7,10]}.items():
 stem='man-and-people-guide' if slug=='man-and-people' else slug
 data[slug]=[{'src':'/Testing/media/editorial-'+(stem+'-cover.webp' if n==1 else slug+'-page-'+str(n)+'.webp'),'page':n} for n in nums]
s=s[:start]+json.dumps(data,ensure_ascii=False)+s[start+end:]
captions={'life-secrets':['Cover','Action: one considered step','Make the next move visible','Let a good moment remain small'],'man-and-people':['Cover','A personal life: map and lived circumstances','A greeting has a shared shape','Do not confuse a role with the whole person'],'lead-without-the-noise':['Cover','Give direction without pretending','Distinguish confidence from certainty','Ask for the scene before the solution']}
marker='\n Object.assign(pageCaptions,'+json.dumps(captions,ensure_ascii=False)+');\n'
if marker not in s:s=s.replace(" const futurePages=!b.completed?",marker+" const futurePages=!b.completed?")
p.write_text(s);print('Actual image previews and captions match the four-page PDF samples.')
