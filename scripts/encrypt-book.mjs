import { readFile,writeFile } from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for book encryption JSON on stdin (input is hidden).');
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){
 const data=JSON.parse(line);const key=await crypto.subtle.importKey('raw',Buffer.from(data.key,'base64'),'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));const pdf=await readFile(data.path);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,pdf);
 await writeFile(new URL('../src/encrypted-book.json',import.meta.url),JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')}));
 console.log('Encrypted book written. Plaintext is not included in the repository.');rl.close();break;
}
