// Explicit promotion only: freeze the approved Testing storefront and editions.
// The ordinary build never takes a new live snapshot from Testing.
const fs=require('node:fs'),path=require('node:path');
const testing=fs.readFileSync('public/testing-next.html','utf8').replace(' · Live purchases still deliver the published edition.','');
fs.writeFileSync('public/testing-next.html',testing);
// Studio-only review tools do not belong on the customer storefront.
let published=testing;
const reviewStart=published.indexOf('<section class="character-preview"');
if(reviewStart>=0){const reviewEnd=published.indexOf('</section>',reviewStart);if(reviewEnd<0)throw Error('Unclosed character review section');published=published.slice(0,reviewStart)+published.slice(reviewEnd+'</section>'.length);}
fs.writeFileSync('public/published-storefront.html',published);
fs.copyFileSync('src/encrypted-testing-editions.json','src/encrypted-published-editions.json');
fs.mkdirSync('public/published-editorial-media',{recursive:true});
for(const file of fs.readdirSync('public/editorial-media'))fs.copyFileSync(path.join('public/editorial-media',file),path.join('public/published-editorial-media',file));
const editions=JSON.parse(fs.readFileSync('src/encrypted-testing-editions.json','utf8'));
const sampleFolders={CHARACTER_COLLECTION_KEY:'character-collection',CHARACTER_PREVIEW_KEY:'character-preview',WHITE_PAPER_EDITION_KEY:'white-interiors',BLUE_GREY_EDITION_KEY:'blue-grey-editions'};
const folder=sampleFolders[editions['life-secrets-sample.pdf']?.keyEnv];
const sample=folder?'private/'+folder+'/life-secrets-sample.pdf':'private/publishing-preview/life-secrets-sample.pdf';
if(!fs.existsSync(sample))throw Error('Current full-edition sample source is missing: '+sample);
fs.copyFileSync(sample,'public/Life-Secrets-Sample.pdf');
// The approved Social Mirror UI is frozen separately from its future drafts.
const mirror=fs.readFileSync('public/social-mirror-shell.html','utf8').replaceAll('/Testing#','/#').replaceAll('href="/Testing"','href="/"').replaceAll('/Testing','');
fs.writeFileSync('public/social-mirror-published.html',mirror);
console.log('Approved storefront, book editions, previews and Social Mirror saved as a separate production release.');
