import {readFile,writeFile} from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for preview encryption JSON on stdin (input is hidden).');
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){
 const {key}=JSON.parse(line);
 const imported=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);
 async function encrypt(path){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await readFile(new URL('../'+path,import.meta.url));const result=await crypto.subtle.encrypt({name:'AES-GCM',iv},imported,bytes);return {keyEnv:'PREVIEW_CONTENT_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(result).toString('base64')}}
 const books={};for(const name of ['sneakpeak-ideas.pdf','art-of-attention.pdf','man-and-people-guide.pdf','art-of-attention-sample.pdf','man-and-people-guide-sample.pdf'])books[name]=await encrypt('private/books/'+name);
 books['life-secrets-sample.pdf']=await encrypt('public/Life-Secrets-Sample.pdf');
 await writeFile(new URL('../src/encrypted-preview-books.json',import.meta.url),JSON.stringify(books));
 await writeFile(new URL('../src/encrypted-preview.json',import.meta.url),JSON.stringify(await encrypt('private/Testing.html')));
 console.log('Private page, completed books, and samples encrypted.');rl.close();break;
}
