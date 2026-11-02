import {readFile,writeFile} from 'node:fs/promises';
import readline from 'node:readline';
console.log('Ready for Testing catalogue key JSON on stdin (hidden).');
for await(const line of readline.createInterface({input:process.stdin})){
 const {key}=JSON.parse(line),bytes=Buffer.from(key,'base64');if(bytes.length!==32)throw Error('Invalid encryption key.');
 const k=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);
 const catalogue=JSON.parse(await readFile('src/testing-catalogue.json','utf8')),records=JSON.parse(await readFile('src/encrypted-testing-editions.json','utf8'));
 for(const b of catalogue)for(const suffix of ['.pdf','-sample.pdf']){
  const name=b.slug+suffix,iv=crypto.getRandomValues(new Uint8Array(12)),pdf=await readFile('private/catalogue-expansion/pdf/'+name);
  records[name]={keyEnv:'TESTING_CATALOGUE_KEY',iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,pdf)).toString('base64')};
 }
 await writeFile('src/encrypted-testing-editions.json',JSON.stringify(records));console.log('Twenty new Testing PDFs encrypted; existing edition records preserved.');break;
}

process.exit(0);
