// A reversible Testing-only visual reference: one homepage hero and Attention.
const fs=require('node:fs'),{parseHTML}=require('linkedom');
const file='public/testing-next.html',{document}=parseHTML(fs.readFileSync(file,'utf8'));
const hero=document.querySelector('section.hero');hero.classList.add('social-theme-hero');
if(!hero.querySelector('.social-theme-copy')){
 const copy=document.createElement('div');copy.className='social-theme-copy';
 while(hero.firstChild)copy.append(hero.firstChild);
 const figure=document.createElement('figure');figure.className='social-theme-symbol';
 figure.innerHTML='<img src="/Testing/media/editorial-social-attention-symbol.webp" width="400" height="400" alt="A golden leaf becomes visible within a blue eye-shaped aperture.">';
 hero.append(copy,figure);
}
document.querySelector('#social-theme-preview-style')?.remove();
const font=fs.readFileSync('public/design-fonts/Anton-Regular.ttf').toString('base64');
const license=fs.readFileSync('public/design-fonts/Anton-OFL.txt','utf8').replaceAll('*/','* /').split('\n').map(s=>s.trimEnd()).join('\n');
const style=document.createElement('style');style.id='social-theme-preview-style';
style.textContent='/* Anton font: '+license+' */\n@font-face{font-family:OPortalsSocial;src:url(data:font/ttf;base64,'+font+') format("truetype");font-weight:400;font-style:normal;font-display:swap}\n'+fs.readFileSync('public/social-theme-preview.css','utf8');
document.head.append(style);fs.writeFileSync(file,document.toString());
console.log('Testing hero uses the social-post display font, white background and restrained conceptual artwork.');
