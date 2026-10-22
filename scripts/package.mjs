import { execFileSync } from 'node:child_process';
execFileSync('tar',['-czf','/workspace/thebook-deploy.tar.gz','.openai/hosting.json','dist/server/index.js','drizzle'],{stdio:'inherit'});
console.log('/workspace/thebook-deploy.tar.gz');
