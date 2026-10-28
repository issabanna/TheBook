import {readFile,writeFile,readdir} from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for Testing edition key JSON on stdin (hidden).');
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){
 const {key}=JSON.parse(line),k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);
 const files={};for(const file of (await readdir('private/publishing-preview')).filter(n=>n.endsWith('.pdf'))){
  const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=await readFile('private/publishing-preview/'+file);
  files[file]={keyEnv:'PREMIUM_EDITION_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,bytes)).toString('base64')};
 }
 await writeFile('src/encrypted-testing-editions.json',JSON.stringify(files));console.log(Object.keys(files).length+' revised PDFs encrypted; published book assets untouched.');rl.close();break;
}
