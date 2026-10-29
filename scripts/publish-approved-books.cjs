// Explicit promotion only: freeze the approved Testing storefront and editions.
// The ordinary build never takes a new live snapshot from Testing.
const fs=require('node:fs'),path=require('node:path');
const testing=fs.readFileSync('public/testing-next.html','utf8').replace(' · Live purchases still deliver the published edition.','');
fs.writeFileSync('public/testing-next.html',testing);
fs.writeFileSync('public/published-storefront.html',testing);
fs.copyFileSync('src/encrypted-testing-editions.json','src/encrypted-published-editions.json');
fs.mkdirSync('public/published-editorial-media',{recursive:true});
for(const file of fs.readdirSync('public/editorial-media'))fs.copyFileSync(path.join('public/editorial-media',file),path.join('public/published-editorial-media',file));
fs.copyFileSync('private/publishing-preview/life-secrets-sample.pdf','public/Life-Secrets-Sample.pdf');
// The approved Social Mirror UI is frozen separately from its future drafts.
const mirror=fs.readFileSync('public/social-mirror-shell.html','utf8').replaceAll('/Testing#','/#').replaceAll('href="/Testing"','href="/"').replaceAll('/Testing','');
fs.writeFileSync('public/social-mirror-published.html',mirror);
console.log('Approved storefront, book editions, previews and Social Mirror saved as a separate production release.');
