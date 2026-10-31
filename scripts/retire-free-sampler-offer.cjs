// Remove the public sampler offer while retaining existing-reader access/data.
const fs=require('node:fs'),{parseHTML}=require('linkedom');
const file='public/testing-next.html';let html=fs.readFileSync(file,'utf8');
const {document}=parseHTML(html);
document.querySelector('#free-book')?.remove();
for(const link of document.querySelectorAll('a[href="/Testing#free-book"]'))link.remove();
document.querySelector('.book-filters [data-filter="free"]')?.remove();
const storeNote=document.querySelector('.store-note');
if(storeNote)storeNote.textContent=storeNote.textContent.replace('SneakPeak Ideas is always free. ','');
for(const detail of document.querySelectorAll('#faq details')){
 const title=detail.querySelector('summary')?.textContent.trim();
 if(title==='Can I see inside before buying?')detail.querySelector('p').textContent='Yes. Each available paid book has a four-page preview: the cover and three selected pages. Explore the actual pages before choosing your book.';
 if(title==='Can I buy a book right now?')detail.querySelector('p').textContent=detail.querySelector('p').textContent.replace(' SneakPeak Ideas is free.','');
}
html=document.toString();
const old="const originalCards=[...shelf.children].map((el,i)=>({el,category:books[i].alwaysFree?'free':'original',completed:!!books[i].completed&&!books[i].reviewOnly}));";
const replacement="const originalCards=[...shelf.children].map((el,i)=>({el,category:books[i].alwaysFree?'free':'original',completed:!!books[i].completed&&!books[i].reviewOnly})).filter(item=>{if(item.category==='free'){item.el.remove();return false}return true});";
if(html.includes(old))html=html.replace(old,replacement);
else if(!html.includes(replacement))throw Error('Catalogue structure changed; do not retire the wrong item.');
html=html.replace("all:'Free collections, OPortals originals and reimagined philosophy books, together.'","all:'OPortals originals and independent illustrated companions. Explore the pages, then choose your book.'");
fs.writeFileSync(file,html);
console.log('Public free-sampler section, navigation, hero action, shelf listing and Free filter removed. Paid samples and existing-reader access retained.');
