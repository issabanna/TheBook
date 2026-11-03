import {readFile,writeFile} from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for edition key JSON on stdin (hidden).');
for await(const line of readline.createInterface({input:process.stdin})){
 const {key}=JSON.parse(line),raw=Buffer.from(key,'base64');if(raw.length!==32)throw Error('Invalid edition key');
 const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 const jobs=JSON.parse(await readFile('private/blue-grey-editions/encryption-jobs.json','utf8'));
 const records=JSON.parse(await readFile('src/encrypted-testing-editions.json','utf8'));
 for(const job of jobs){
  const bytes=await readFile(job.path),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,bytes);
  const decrypted=Buffer.from(await crypto.subtle.decrypt({name:'AES-GCM',iv},k,encrypted));
  if(!decrypted.equals(bytes))throw Error('Edition encryption round-trip failed');
  records[job.name]={keyEnv:'BLUE_GREY_EDITION_KEY',...(job.pageCount?{pageCount:job.pageCount}:{}),iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')};
 }
 await writeFile('src/encrypted-testing-editions.json',JSON.stringify(records));
 console.log(jobs.length+' verified edition records encrypted; unrelated records preserved.');break;
}
process.exit(0);
