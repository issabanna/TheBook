const fs=require('node:fs'),{parseHTML}=require('linkedom');
const path='public/social-mirror.html',html=fs.readFileSync(path,'utf8'),{document}=parseHTML(html);
const results=document.querySelector('#results');
if(!results.querySelector('.sm-results-intro')){
 const intro=document.createElement('div');intro.className='sm-results-intro';
 for(const selector of [':scope>.eyebrow','#results-title','#result-summary'])intro.append(results.querySelector(selector));
 results.prepend(intro);
}
const icons={
 'share-result':'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
 'download-card':'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
 'paid-analysis':'<path d="M5 20V10m7 10V4m7 16v-7"/><path d="M3 20h18"/>',
 'back-dashboard':'<path d="m10 5-7 7 7 7M3 12h18"/>'
};
const labels={'share-result':'Share','download-card':'Save card','paid-analysis':'Insights · $4','back-dashboard':'Back'};
const titles={'share-result':'Share my results card','download-card':'Download my results card as an image','paid-analysis':'Detailed analysis and practical advice — $4 USD','back-dashboard':'Back to my reflection and invitation link'};
let toolbar=results.querySelector('.sm-results-toolbar');
if(!toolbar){toolbar=document.createElement('div');toolbar.className='sm-results-toolbar';results.insertBefore(toolbar,results.querySelector('#share-status'));}
toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Results card actions');
for(const [id,icon] of Object.entries(icons)){
 const button=results.querySelector('#'+id);if(!button)throw Error('Missing result action '+id);
 button.className='sm-result-action'+(id==='share-result'?' sm-result-share':'');button.type='button';
 button.setAttribute('aria-label',titles[id]);button.title=titles[id];
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+icon+'</svg><span>'+labels[id]+'</span>';
 toolbar.append(button);
}
for(const actions of results.querySelectorAll(':scope>.actions')){if(!actions.children.length)actions.remove();}
fs.writeFileSync(path,document.toString());
console.log('Results now have one compact icon toolbar: Share, Save card, Insights $4, Back.');
