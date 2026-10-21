import {readFile,writeFile} from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for preview encryption JSON on stdin (input is hidden).');
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){const {key}=JSON.parse(line);const k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await readFile(new URL('../private/Testing.html',import.meta.url));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,bytes);await writeFile(new URL('../src/encrypted-preview.json',import.meta.url),JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')}));console.log('Preview encrypted; plaintext remains outside tracked source.');rl.close();break;}
