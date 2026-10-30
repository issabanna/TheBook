import {execFileSync} from 'node:child_process';
import { readFile, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>readFile(path.join(root,p),'utf8');
await rm(path.join(root,'dist'),{recursive:true,force:true});
const bookManifest=JSON.parse(await read('src/encrypted-preview-books.json'));
const previewBooks=Object.fromEntries(await Promise.all(Object.entries(bookManifest).map(async([name,record])=>[name,record.assetFile?JSON.parse(await read('src/'+record.assetFile)):record])));
const publishedEditions=JSON.parse(await read('src/encrypted-published-editions.json'));
const publishedMedia={};
for(const file of await readdir(path.join(root,'public/published-editorial-media')))publishedMedia[file]=(await readFile(path.join(root,'public/published-editorial-media',file))).toString('base64');
const socialMirrorPublished=await read('public/social-mirror-published.html');
execFileSync(process.execPath,['scripts/integrate-social-mirror-shell.cjs'],{cwd:root,stdio:'inherit'});
const testingDraft=await read('public/testing-next.html');const draftMedia=Object.fromEntries(await Promise.all(['attention','choices','leadership','meaning'].map(async(name)=>['weekly-'+name+'.webp',(await readFile(path.join(root,'public/weekly-ideas/'+name+'.webp'))).toString('base64')])));
const testingEditionBooks=JSON.parse(await read('src/encrypted-testing-editions.json'));
for(const file of await readdir(path.join(root,'public/editorial-media')))draftMedia[file]=(await readFile(path.join(root,'public/editorial-media',file))).toString('base64');
const assets={testingEditionBooks,publishedMedia,socialMirrorPublished,socialMirror:await read('public/social-mirror-shell.html'),liveDraft:await read('public/published-storefront.html'),publishedDraft:true,testingDraft,draftMedia,previewMedia:JSON.parse(await read('src/encrypted-preview-media.json')),completedBooks:{...previewBooks,...publishedEditions},testing:JSON.parse(await read('src/encrypted-preview.json')),analytics:await read('public/analytics.js'),logo:await read('public/oportals-mark.svg'),home:await read('public/index.html'),sample:(await readFile(path.join(root,'public/Life-Secrets-Sample.pdf'))).toString('base64'),book:JSON.parse(await read('src/encrypted-book.json'))};
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
const payment=await read('src/payment.mjs');
const worker=(await read('src/worker.mjs')).replace(/^import .*from '\.\/(?:payment|testing-events|contact|free-book-leads|social-mirror|social-mirror-report).mjs';\n/gm,'');
await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
const bundle=payment+'\n'+(await read('src/social-mirror-report.mjs'))+'\n'+(await read('src/social-mirror.mjs')).replace(/^import .*from .*;\n/gm,'')+'\n'+(await read('src/free-book-leads.mjs'))+'\n'+(await read('src/testing-events.mjs'))+'\n'+(await read('src/contact.mjs'))+'\n'+worker+'\nconst bookAssetRecords='+JSON.stringify(bookAssetRecords)+';\nconst assets='+JSON.stringify(assets)+';\nassets.testingEditionBooks='+testingBookTable+';\nassets.completedBooks='+publishedBookTable+';\nexport default { fetch: createHandler(assets) };\n';
if(Buffer.byteLength(bundle)>63*1024*1024)throw new Error('Worker exceeds the safe deployment size budget: '+(Buffer.byteLength(bundle)/1024/1024).toFixed(1)+' MiB.');
await writeFile(path.join(root,'dist/server/index.js'),bundle);
await writeFile(path.join(root,'dist/.openai/hosting.json'),await read('.openai/hosting.json'));
console.log('Built Worker: public sales page, free sample, verified checkout and encrypted book.');
