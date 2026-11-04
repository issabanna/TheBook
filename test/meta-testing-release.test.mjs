import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {metaTestingRelease} from '../scripts/meta-testing-release.mjs';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com';
const release=await metaTestingRelease({root:process.cwd(),optimizeFonts:s=>s});
const calls=[],assets={publishedDraft:true,testing:{liveStorefront:true,keyEnv:'PREVIEW_V5_KEY',publicPreview:true}},context={assets,Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,crypto,atob,btoa,Date,JSON,fetch:async()=>{throw Error('No external calls in release tests');},createHandler:()=>async(request,env)=>{calls.push({path:new URL(request.url).pathname,env});return new Response('Testing handler');}};
vm.runInNewContext(release.replace('export default','globalThis.releaseWorker='),context);const worker=context.releaseWorker;
test('Testing deployment retains the exact approved public analytics and excludes new Meta endpoints',async()=>{
 const expected=execFileSync('git',['show','a1f34252bb4eb5d6d9eab210e88c8f587bace5f9:public/analytics.js'],{encoding:'utf8'});
 const analytics=await worker.fetch(new Request(origin+'/analytics.js'),{});assert.equal(await analytics.text(),expected);
 const publicHome=await worker.fetch(new Request(origin+'/'),{PREVIEW_V5_KEY:'fixture'}),html=await publicHome.text();assert.equal(publicHome.status,200);assert.ok(html.includes('Big ideas.'));assert.ok(!html.includes('meta-marketing-consent'));assert.ok(!html.includes('/meta-pixel.js'));assert.ok(!publicHome.headers.get('Content-Security-Policy').includes('facebook'));
 assert.equal((await worker.fetch(new Request(origin+'/Conversions/meta'),{})).status,404);assert.equal((await worker.fetch(new Request(origin+'/meta-pixel.js'),{})).status,404);
});
test('only the exact Testing namespace receives test flags; live PayPal/environment values are preserved',async()=>{
 const env={PAYPAL_ENV:'live',META_TEST_MODE:'false',META_TRACKING_ENABLED:'false',META_TEST_EVENT_CODE:'none',DOWNLOAD_SIGNING_KEY:'not-logged'};
 for(const path of ['/Testing','/Testing/Meta','/Testing/book/art-of-attention','/Testing/analytics.js']){
  assert.equal(await(await worker.fetch(new Request(origin+path),env)).text(),'Testing handler');const call=calls.at(-1);assert.equal(call.env.META_TEST_MODE,'true');assert.equal(call.env.META_TEST_EVENT_CODE,'TEST10333');assert.equal(call.env.PAYPAL_ENV,'live');assert.equal(call.env.DOWNLOAD_SIGNING_KEY,env.DOWNLOAD_SIGNING_KEY);
 }
 const n=calls.length;await worker.fetch(new Request(origin+'/Testing-other'),env);assert.equal(calls.length,n);assert.equal(env.META_TEST_MODE,'false');
});
test('Testing review keeps login origin intact and new script assets use the Testing namespace',async()=>{
 const h=createHandler({analytics:'testing-analytics',metaPixel:'testing-meta'}),r=await h(new Request(origin+'/Testing/Meta'),{});assert.equal(r.status,401);assert.equal(r.headers.get('Referrer-Policy'),'same-origin');assert.match(r.headers.get('X-Robots-Tag'),/noindex/);assert.match(await r.text(),/name="next" value="\/Testing\/Meta"/);
 assert.equal(await(await h(new Request(origin+'/Testing/analytics.js'),{})).text(),'testing-analytics');assert.equal(await(await h(new Request(origin+'/Testing/meta-pixel.js'),{})).text(),'testing-meta');assert.equal((await h(new Request(origin+'/Testing/Conversions/meta'),{})).status,401);
});
