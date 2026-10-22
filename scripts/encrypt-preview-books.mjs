import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import readline from 'node:readline';
import {execFileSync} from 'node:child_process';
execFileSync('python3',[new URL('./build-four-page-samples.py',import.meta.url).pathname],{stdio:['ignore','inherit','inherit']});
console.log('Ready for preview encryption JSON on stdin (input is hidden).');
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){
 const {key,preserveLifeSecrets=false,keyEnv='PREVIEW_V3_KEY',onlyBooks=null,onlyMedia=null}=JSON.parse(line);
 const previousBooks=preserveLifeSecrets||onlyBooks?JSON.parse(await readFile(new URL('../src/encrypted-preview-books.json',import.meta.url),'utf8')):{};
 const previousMedia=preserveLifeSecrets||onlyMedia?JSON.parse(await readFile(new URL('../src/encrypted-preview-media.json',import.meta.url),'utf8')):{};
 const imported=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);
 async function encrypt(path){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await readFile(new URL('../'+path,import.meta.url));const result=await crypto.subtle.encrypt({name:'AES-GCM',iv},imported,bytes);return {keyEnv,iv:Buffer.from(iv).toString('base64'),data:Buffer.from(result).toString('base64')}}
 const books={};for(const name of ['life-secrets.pdf','life-secrets-sample.pdf','sneakpeak-ideas.pdf','art-of-attention.pdf','man-and-people-guide.pdf','art-of-attention-sample.pdf','man-and-people-guide-sample.pdf'])books[name]=(onlyBooks&&!onlyBooks.includes(name))||(preserveLifeSecrets&&name.startsWith('life-secrets'))?previousBooks[name]:await encrypt('private/books/'+name);
 for(const stem of ["the-philosopher-manager", "lead-without-the-noise", "time-for-what-matters", "stand-out-for-something"])for(const suffix of ['.pdf','-sample.pdf'])books[stem+suffix]=onlyBooks&&!onlyBooks.includes(stem+suffix)?previousBooks[stem+suffix]:await encrypt('private/books/'+stem+suffix);
 const media={};for(const name of await readdir(new URL('../private/books/web-media/',import.meta.url)))media[name]=(onlyMedia&&!onlyMedia.includes(name))||(preserveLifeSecrets&&name.startsWith('life-secrets'))?previousMedia[name]:await encrypt('private/books/web-media/'+name);await writeFile(new URL('../src/encrypted-preview-media.json',import.meta.url),JSON.stringify(media));
 await mkdir(new URL('../src/encrypted-preview-books/',import.meta.url),{recursive:true});
 const manifest={};for(const [name,record]of Object.entries(books)){if(record.assetFile){manifest[name]=record;continue}const assetFile='encrypted-preview-books/'+name+'.json';await writeFile(new URL('../src/'+assetFile,import.meta.url),JSON.stringify(record));manifest[name]={keyEnv:record.keyEnv,assetFile};}
 await writeFile(new URL('../src/encrypted-preview-books.json',import.meta.url),JSON.stringify(manifest));
 await writeFile(new URL('../src/encrypted-preview.json',import.meta.url),JSON.stringify({...await encrypt('private/Testing.html'),publicPreview:true,liveStorefront:JSON.parse(await readFile(new URL('../src/encrypted-preview.json',import.meta.url),'utf8')).liveStorefront===true,temporaryDownloads:JSON.parse(await readFile(new URL('../src/encrypted-preview.json',import.meta.url),'utf8')).temporaryDownloads===true}));
 console.log('Private page, completed books, and samples encrypted.');rl.close();break;
}
