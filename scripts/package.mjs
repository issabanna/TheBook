import { execFileSync } from 'node:child_process';
execFileSync('tar',['-czf','/workspace/thebook-deploy.tar.gz','-C','dist','.'],{stdio:'inherit'});
console.log('/workspace/thebook-deploy.tar.gz');
