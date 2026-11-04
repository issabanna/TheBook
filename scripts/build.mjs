import {BOOK_PRODUCTS} from '../src/payment.mjs';
import {metaProductionRelease} from './meta-production-release.mjs';
import {buildSeoPages} from './build-seo-pages.mjs';
import {execFileSync} from 'node:child_process';
import { readFile, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const readRaw=p=>readFile(path.join(root,p),'utf8');
const fontManifest=JSON.parse(await readRaw('public/seo-fonts/manifest.json')),fonts={};
for(const record of Object.values(fontManifest))fonts[record.file]={type:record.type,data:(await readFile(path.join(root,'public/seo-fonts',record.file))).toString('base64')};
function optimizeFonts(html){return html.replace(/@font-face\s*\{[^}]+\}/g,face=>face.replace(/url\((['"]?)data:font\/ttf;base64,([A-Za-z0-9+/=]+)\1\)(?:\s*format\([^)]*\))?/g,(original,_quote,value)=>{const record=fontManifest[createHash('sha256').update(Buffer.from(value,'base64')).digest('hex')];return record?`url('/fonts/${record.file}') format('woff2')`:original;}));}
const read=async p=>{const value=await readRaw(p);return p.endsWith('.html')?optimizeFonts(value):value;};
await rm(path.join(root,'dist'),{recursive:true,force:true});
const bookManifest=JSON.parse(await read('src/encrypted-preview-books.json'));
const previewBooks=Object.fromEntries(await Promise.all(Object.entries(bookManifest).map(async([name,record])=>[name,record.assetFile?JSON.parse(await read('src/'+record.assetFile)):record])));
async function editionRecords(file){const records=JSON.parse(await read(file));return Object.fromEntries(await Promise.all(Object.entries(records).map(async([name,record])=>[name,record.assetFile?JSON.parse(await read('src/'+record.assetFile)):record])));}
const publishedEditions=await editionRecords('src/encrypted-published-editions.json');
const publishedMedia={};
for(const file of await readdir(path.join(root,'public/published-editorial-media')))publishedMedia[file]=(await readFile(path.join(root,'public/published-editorial-media',file))).toString('base64');
const socialMirrorPublished=await read('public/social-mirror-published.html');
execFileSync(process.execPath,['scripts/integrate-social-mirror-shell.cjs'],{cwd:root,stdio:'inherit'});
const testingDraft=await read('public/testing-next.html');const draftMedia=Object.fromEntries(await Promise.all(['attention','choices','leadership','meaning'].map(async(name)=>['weekly-'+name+'.webp',(await readFile(path.join(root,'public/weekly-ideas/'+name+'.webp'))).toString('base64')])));
const testingEditionBooks=await editionRecords('src/encrypted-testing-editions.json');
for(const file of await readdir(path.join(root,'public/editorial-media')))draftMedia[file]=(await readFile(path.join(root,'public/editorial-media',file))).toString('base64');
const liveDraft=await read('public/published-storefront.html');
const seo={live:buildSeoPages(liveDraft,{live:true}),testing:buildSeoPages(testingDraft)};
const assets={commerceProducts:Object.fromEntries(Object.entries(BOOK_PRODUCTS).filter(([,b])=>!b.service).map(([id,b])=>[id,{title:b.title,price:b.price}])),conversionsDashboard:await read('public/conversions-dashboard.html'),fonts,seo,seoNavigation:await read('public/seo-navigation.js'),artworkLoading:await read('public/artwork-loading.js'),sessionsDashboard:await read('public/sessions-dashboard.html'),visitsDashboard:await read('public/visits-dashboard.html'),visitsTracking:await read('public/visits-tracking.js'),testingEditionBooks,publishedMedia,socialMirrorPublished,socialMirror:await read('public/social-mirror-shell.html'),liveDraft,publishedDraft:true,testingDraft,draftMedia,previewMedia:JSON.parse(await read('src/encrypted-preview-media.json')),completedBooks:{...previewBooks,...publishedEditions},testing:JSON.parse(await read('src/encrypted-preview.json')),metaPixel:await read('public/meta-pixel.js'),analytics:await read('public/analytics.js'),logo:await read('public/oportals-mark.svg'),home:await read('public/index.html'),sample:(await readFile(path.join(root,'public/Life-Secrets-Sample.pdf'))).toString('base64'),book:JSON.parse(await read('src/encrypted-book.json'))};
// Production and Testing have separate snapshots but can contain identical
// ciphertext. Emit that immutable record once, with independent file tables.
const bookAssetRecords=[],recordIndex=new Map();
function bookTable(files){return '{'+Object.entries(files).map(([name,record])=>{
 const serialized=JSON.stringify(record),digest=createHash('sha256').update(serialized).digest('hex');
 if(!recordIndex.has(digest)){recordIndex.set(digest,bookAssetRecords.length);bookAssetRecords.push(record);}
 return JSON.stringify(name)+':bookAssetRecords['+recordIndex.get(digest)+']';
}).join(',')+'}';}
const testingBookTable=bookTable(assets.testingEditionBooks),publishedBookTable=bookTable(assets.completedBooks);
delete assets.testingEditionBooks;delete assets.completedBooks;
// Keep independent media snapshots while sharing identical immutable byte strings.
const mediaAssetRecords=[],mediaIndex=new Map();
function mediaTable(files){return '{'+Object.entries(files).map(([name,data])=>{
 const digest=createHash('sha256').update(data).digest('hex');
 if(!mediaIndex.has(digest)){mediaIndex.set(digest,mediaAssetRecords.length);mediaAssetRecords.push(data);}
 return JSON.stringify(name)+':mediaAssetRecords['+mediaIndex.get(digest)+']';
}).join(',')+'}';}
const testingMediaTable=mediaTable(assets.draftMedia),publishedMediaTable=mediaTable(assets.publishedMedia);
delete assets.draftMedia;delete assets.publishedMedia;
const payment=(await read('src/payment.mjs')).replace(/^import .*from .*;\n/gm,'');
const worker=(await read('src/worker.mjs')).replace(/^import .*from '\.\/(?:payment|testing-events|contact|free-book-leads|social-mirror|social-mirror-report|visits|sessions|admin-auth|testing-catalogue|book-checkout|seo|conversions|meta).mjs';\n/gm,'');
await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
const bundle=(await read('src/seo.mjs')).replace(/^export .*;$/gm,'')+'\n'+(await read('src/shared-checkout-books.mjs'))+'\n'+(await read('src/testing-catalogue.mjs'))+'\n'+(await read('src/admin-auth.mjs'))+'\n'+payment+'\n'+(await read('src/social-mirror-report.mjs'))+'\n'+(await read('src/social-mirror.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/free-book-leads.mjs'))+'\n'+(await read('src/testing-events.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/contact.mjs'))+'\n'+(await read('src/visits.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/sessions.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/conversions.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/meta.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/book-checkout.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+worker+'\nconst bookAssetRecords='+JSON.stringify(bookAssetRecords)+';\nconst mediaAssetRecords='+JSON.stringify(mediaAssetRecords)+';\nconst assets='+JSON.stringify(assets)+';\nassets.draftMedia='+testingMediaTable+';\nassets.publishedMedia='+publishedMediaTable+';\nassets.testingEditionBooks='+testingBookTable+';\nassets.completedBooks='+publishedBookTable+';\n'+metaProductionRelease();
if(Buffer.byteLength(bundle)>63*1024*1024)throw new Error('Worker exceeds the safe deployment size budget: '+(Buffer.byteLength(bundle)/1024/1024).toFixed(1)+' MiB.');
await writeFile(path.join(root,'dist/server/index.js'),bundle);
await writeFile(path.join(root,'dist/.openai/hosting.json'),await read('.openai/hosting.json'));
console.log('Built Worker: public sales page, free sample, verified checkout and encrypted book.');
