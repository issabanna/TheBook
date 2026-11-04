import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {buildSeoPages} from './build-seo-pages.mjs';

// A single hosted Worker serves both namespaces. Keep public behavior at the
// approved commit while /Testing runs the reviewed code; share immutable assets.
export async function metaTestingRelease({root,optimizeFonts}){
 const baseline=JSON.parse(await readFile(root+'/design-versions/meta-testing-baseline.json','utf8'));
 if(!/^[a-f0-9]{40}$/.test(baseline.commit))throw Error('Invalid frozen public commit.');
 const source=file=>execFileSync('git',['show',baseline.commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
 const modules=['seo','shared-checkout-books','testing-catalogue','admin-auth','payment','social-mirror-report','social-mirror','free-book-leads','testing-events','contact','visits','sessions','conversions','book-checkout','worker'];
 const code=modules.map(name=>source('src/'+name+'.mjs').replace(/^import .*from .*;\n/gm,'').replace(/^export \{[^\n]+\};?\n?/gm,'').replace(/^export /gm,'')).join('\n');
 const liveDraft=optimizeFonts(source('public/published-storefront.html')),testingDraft=optimizeFonts(source('public/testing-next.html'));
 const overrides={liveDraft,testingDraft,analytics:source('public/analytics.js'),conversionsDashboard:source('public/conversions-dashboard.html'),seo:{live:buildSeoPages(liveDraft,{live:true}),testing:buildSeoPages(testingDraft)}};
 return `
const publicVersion179Factory=(()=>{${code}\nreturn createHandler;})();
const publicVersion179Assets={...assets,...${JSON.stringify(overrides)}};
const publicVersion179=publicVersion179Factory(publicVersion179Assets);
const metaTestingHandler=createHandler(assets);
export default {fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/Testing'||path.startsWith('/Testing/')){
  const testEnv={...env,META_TRACKING_ENABLED:'true',META_TEST_MODE:'true',META_TEST_EVENT_CODE:'TEST10333'};
  return metaTestingHandler(request,testEnv,ctx);
 }
 return publicVersion179(request,env,ctx);
}};
`;
}
