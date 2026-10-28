from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
data=json.loads((R/'content/weekly-editorial.json').read_text())
s=(R/'private/Testing.html').read_text()
css='''
/* Reading-first editorial experiment: Testing only. */
.weekly-reading{padding:24px 0 28px;border-bottom:1px solid #e1e5dc;scroll-margin-top:24px}.weekly-intro{display:flex;justify-content:space-between;align-items:end;gap:22px;margin-bottom:15px}.weekly-intro h2{font:400 clamp(29px,3.6vw,43px)/1.1 OPortalsBook,Georgia,serif;letter-spacing:-.6px;margin:8px 0}.weekly-intro p{max-width:620px;font-size:14px;color:#626975;margin:8px 0;line-height:1.45}.weekly-intro>a{white-space:nowrap;font-size:12px;color:#52603c}.weekly-review{border-left:3px solid #68734b;padding:9px 12px;background:#f7f8f2;margin:0 0 14px;font-size:11px;line-height:1.4;color:#59614f}.weekly-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 17px}.weekly-tabs button{border:1px solid #dce1d4;border-radius:5px;padding:9px 12px;background:white;font-size:12px;color:#59614f;line-height:1.25}.weekly-tabs button[aria-pressed=true]{background:#68734b;color:white;border-color:#68734b}.weekly-tabs button span{display:block;font-size:9px;opacity:.8;margin-bottom:3px}.weekly-heading h3{font:400 clamp(25px,3vw,34px)/1.15 OPortalsBook,Georgia,serif;margin:5px 0 9px;letter-spacing:-.4px}.weekly-heading>p{font-size:13px;line-height:1.5;max-width:760px;color:#626975;margin:0 0 17px}.weekly-feature{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:26px;border:1px solid #e2e5db;border-radius:8px;padding:23px;align-items:center;background:white}.weekly-scene{margin:0}.weekly-scene img{width:100%;height:auto;display:block}.weekly-scene figcaption{font-size:10px;color:#737b6a;line-height:1.4;margin:9px 0 0}.weekly-number{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#68734b;font-weight:700}.weekly-feature h4,.weekly-mini h4{font:400 27px/1.15 OPortalsBook,Georgia,serif;letter-spacing:-.4px;margin:8px 0 10px}.weekly-lead{font-size:14px;font-weight:600;color:#4e5940;line-height:1.45;margin:8px 0 13px}.weekly-body p{font-size:13px;line-height:1.6;color:#535c4d;margin:9px 0}.weekly-practice{border-left:2px solid #c8d0ba;margin:15px 0;padding:0 0 0 12px}.weekly-practice strong{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#68734b}.weekly-practice p{font-size:13px;line-height:1.5;margin:4px 0 9px}.weekly-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px 13px;margin-top:13px}.weekly-actions .secrets-buy{font-size:11px;padding:10px 13px;line-height:1.3;border-radius:5px}.weekly-sample{font-size:11px;color:#52603c;text-decoration:underline;text-underline-offset:3px}.weekly-companions{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px}.weekly-mini{border:1px solid #e2e5db;border-radius:8px;padding:19px}.weekly-mini h4{font-size:24px}.weekly-mini details summary{font-size:12px;font-weight:600;color:#52603c;cursor:pointer;padding:6px 0;list-style-position:inside}.weekly-mini .weekly-practice{margin-bottom:10px}.weekly-book-note{font-size:10px;color:#727b68;margin:12px 0 0}.weekly-bridge{display:flex;align-items:center;gap:15px;border:1px solid #e1e5d8;background:#f7f8f2;border-radius:6px;padding:15px 18px;margin-top:19px}.weekly-bridge img{width:48px;height:auto;flex-shrink:0}.weekly-bridge h3{font:400 22px/1.15 OPortalsBook,Georgia,serif;margin:4px 0 6px}.weekly-bridge p{font-size:12px;line-height:1.45;margin:0;color:#626975}.weekly-bridge>div{flex:1}.weekly-bridge>a{font-size:11px;white-space:nowrap;padding:11px 13px;border-radius:5px}.weekly-reading :focus-visible{outline:3px solid #68734b;outline-offset:3px}@media(max-width:760px){.weekly-reading{padding:20px 0}.weekly-intro{display:block}.weekly-intro>a{display:inline-block;margin-top:5px}.weekly-feature{grid-template-columns:1fr;gap:17px;padding:17px}.weekly-scene{max-width:560px;width:100%;margin:auto}.weekly-scene img{max-height:230px;object-fit:contain}.weekly-companions{grid-template-columns:1fr}.weekly-mini{padding:17px}.weekly-feature h4{font-size:27px}.weekly-tabs{gap:6px}.weekly-tabs button{flex:1;min-width:110px}.weekly-bridge{flex-wrap:wrap;padding:14px}.weekly-bridge>div{min-width:170px}.weekly-bridge>a{margin-left:63px}.weekly-body p{font-size:14px;line-height:1.55}}
'''
css += '''
.weekly-tabs{flex-wrap:nowrap;overflow-x:auto;gap:7px;padding-bottom:3px;scrollbar-width:thin;overscroll-behavior-x:contain}.weekly-tabs button{flex:1 0 0;min-width:0;padding:9px 8px;white-space:nowrap}@media(max-width:760px){.weekly-tabs{flex-wrap:nowrap;gap:6px}.weekly-tabs button{flex:1 0 0;min-width:70px;padding:9px 6px;font-size:11px}}
'''
s=s.replace('</style>',css+'</style>',1)
s=s.replace('<a href="/Testing#books">Books</a>','<a href="/Testing#weekly-ideas">Weekly ideas</a><a href="/Testing#books">Books</a>',1)
s=s.replace('<div class="hero-actions"><a class="secrets-buy" href="/Testing#books">Explore the Books ↗</a>', '<div class="hero-actions"><a class="secrets-buy" href="/Testing#weekly-ideas">Read this week’s ideas ↓</a><a class="hero-link" href="/Testing#books">Explore the Books ↗</a>',1)
section='''<section class="weekly-reading" id="weekly-ideas" aria-labelledby="weekly-title"><div class="weekly-intro"><div><span class="eyebrow">A little philosophy. Something to try.</span><h2 id="weekly-title">Ideas for the week you have.</h2><p>Read a thought. Recognise a moment from your own life. Take one question into the rest of your day.</p></div><a href="/Testing/book/sneakpeak-ideas">Prefer a PDF? Get the free collection ↗</a></div><aside class="weekly-review"><strong>Testing · Month 1 editorial preview</strong><br>Four draft weeks for your review. No dates are scheduled and nothing rotates onto the live website until you approve the month.</aside><div class="weekly-tabs" role="group" aria-label="Preview a week"></div><div id="weekly-content" aria-live="polite"></div><div class="weekly-bridge"><img src="/Testing/media/life-secrets-cover.webp" alt="Life Secrets digital book cover" width="48" height="82" loading="lazy"><div><span class="weekly-number">Stay with a useful question</span><h3>Take the idea further.</h3><p>Life Secrets brings together 18 illustrated ideas about attention, choices, relationships, progress and meaning.</p></div><a class="secrets-buy" href="/Testing/book/life-secrets">Explore Life Secrets · $15 ↗</a></div></section>'''
s=s.replace('<div id="home-content">','<div id="home-content">'+section,1)
js='''
// Original OPortals reading drafts. This preview is deliberately not date-driven.
const weeklyEdition=__DATA__;
function weeklyEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function weeklyActions(idea){return `<div class="weekly-actions"><a class="secrets-buy" href="/Testing/book/${idea.book}">Explore ${weeklyEscape(idea.bookTitle)} ↗</a><a class="weekly-sample" href="/Testing/books/${idea.sample}" data-sample="${idea.book}" target="_blank" rel="noopener">Read 4 pages free ↗</a></div>`}
function weeklyText(idea){return `<div class="weekly-body">${idea.body.map(p=>`<p>${weeklyEscape(p)}</p>`).join('')}</div><div class="weekly-practice"><strong>A question to keep</strong><p>${weeklyEscape(idea.question)}</p><strong>Try it today</strong><p>${weeklyEscape(idea.experiment)}</p></div>`}
function renderWeekly(id){const week=weeklyEdition.weeks.find(w=>w.id===id)||weeklyEdition.weeks[0],first=week.ideas[0];document.querySelector('.weekly-tabs').innerHTML=weeklyEdition.weeks.map((w,i)=>`<button type="button" data-week="${w.id}" aria-pressed="${w.id===week.id}"><span>Week ${i+1}</span>${weeklyEscape(w.label)}</button>`).join('');document.querySelector('#weekly-content').innerHTML=`<div class="weekly-heading"><span class="weekly-number">${weeklyEscape(week.label)} · Three ideas to explore</span><h3>${weeklyEscape(week.title)}</h3><p>${weeklyEscape(week.intro)}</p></div><article class="weekly-feature"><figure class="weekly-scene"><img src="/Testing/media/weekly-${week.art}" alt="${weeklyEscape(week.alt)}" width="1100" height="600" decoding="async"><figcaption>An OPortals illustration · A way into the question, not its final answer.</figcaption></figure><div><span class="weekly-number">01 · A minute to look again</span><h4>${weeklyEscape(first.title)}</h4><p class="weekly-lead">${weeklyEscape(first.lead)}</p>${weeklyText(first)}${weeklyActions(first)}</div></article><div class="weekly-companions">${week.ideas.slice(1).map((idea,i)=>`<article class="weekly-mini"><span class="weekly-number">0${i+2} · Another way in</span><h4>${weeklyEscape(idea.title)}</h4><p class="weekly-lead">${weeklyEscape(idea.lead)}</p><details><summary>Read the idea and try it</summary>${weeklyText(idea)}</details>${weeklyActions(idea)}</article>`).join('')}</div><p class="weekly-book-note">Original OPortals reflections connected to themes in our books. These are not quotations from source authors. Free reading requires no account or subscription.</p>`;document.querySelectorAll('[data-week]').forEach(button=>button.addEventListener('click',()=>renderWeekly(button.dataset.week)));}
renderWeekly('attention');
'''.replace('__DATA__',json.dumps(data,ensure_ascii=False))
s=s.replace('</script>',js+'</script>',1)
(R/'public/testing-next.html').write_text(s)
# Concrete review document for monthly approval.
report=['# OPortals — Month 1 editorial review','Status: DRAFT. No automatic schedule or live publication.','Approve or amend the four weeks as a set before release. Original reflections; not attributed quotations.','']
for i,w in enumerate(data['weeks'],1):
 report += [f'## Week {i}: {w["label"]}',w['title'],w['intro'],'']
 for a in w['ideas']:
  report += ['### '+a['title'],a['lead'],'']+a['body']+['','**A question to keep:** '+a['question'],'**Try it today:** '+a['experiment'],'**Related book:** '+a['bookTitle'],'']
(R/'content/month-1-review.md').write_text('\n\n'.join(report))
print('Built Testing-only reading experience: four weeks, twelve original ideas, twelve experiments, book and sample links.')

import runpy
runpy.run_path(str(R/'scripts/add-free-book-form.py'))

import subprocess
subprocess.run(['node',str(R/'scripts/organize-testing-home.cjs')],check=True)

subprocess.run(["node",str(R/"scripts/refine-book-offers.cjs"),str(R/"public/testing-next.html")],check=True,cwd=R)

subprocess.run(["node",str(R/"scripts/connect-book-payments.cjs")],check=True,cwd=R)

p=R/"public/testing-next.html"
s=p.read_text().replace('<nav aria-label="Main navigation">','<nav aria-label="Main navigation"><a href="/Testing/SocialMirror">Social Mirror</a>',1)
p.write_text(s)

# Testing-only invitation bar. The published storefront is kept separate.
p=R/"public/testing-next.html"
s=p.read_text().replace("<body>","<body>"+'<aside class="social-mirror-bar" aria-label="Social Mirror"><a href="/Testing/SocialMirror">Social Mirror · How do people see you? <strong>Try it free →</strong></a></aside>',1).replace("</head>",'<style>.social-mirror-bar{background:#f1f3ec;border-bottom:1px solid #dce1d4;text-align:center;padding:9px 16px;font:12px/1.4 Arial,Helvetica,sans-serif;color:#52603c}.social-mirror-bar a{color:inherit;text-decoration:none;display:inline-block}.social-mirror-bar strong{margin-left:9px;text-decoration:underline;text-underline-offset:3px}@media(max-width:450px){.social-mirror-bar{font-size:11px;padding:9px 12px}.social-mirror-bar strong{margin-left:5px}}</style>'+"</head>",1)
p.write_text(s)

subprocess.run(["node",str(R/"scripts/apply-readability.cjs")],check=True,cwd=R)

subprocess.run(["node",str(R/"scripts/apply-cx.cjs")],check=True,cwd=R)

subprocess.run(["node",str(R/"scripts/apply-editorial-preview.cjs")],check=True,cwd=R)

subprocess.run(["python3",str(R/"scripts/apply-postcard-samples.py")],check=True,cwd=R)
