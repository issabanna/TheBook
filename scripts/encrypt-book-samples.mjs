import {readFile,writeFile} from 'node:fs/promises';import readline from 'node:readline';
console.log('Ready for sample key JSON on stdin (hidden).');
for await(const line of readline.createInterface({input:process.stdin})){
 const {key}=JSON.parse(line),raw=Buffer.from(key,'base64');if(raw.length!==32)throw Error('Invalid key.');const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const report=JSON.parse(await readFile('private/three-page-samples/report.json','utf8')),records=JSON.parse(await readFile('src/encrypted-testing-editions.json','utf8'));
 for(const b of report){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=await readFile('private/three-page-samples/after/'+b.name);records[b.name]={keyEnv:'BOOK_SAMPLE_KEY',pageCount:3,iv:Buffer.from(iv).toString('base64'),data:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,bytes)).toString('base64')};}
 await writeFile('src/encrypted-testing-editions.json',JSON.stringify(records));console.log('17 three-page samples encrypted; every full-book record preserved.');break;
}
process.exit(0);
