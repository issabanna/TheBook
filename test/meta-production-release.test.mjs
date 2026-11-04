import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {metaProductionRelease} from '../scripts/meta-production-release.mjs';
import {createHandler} from '../src/worker.mjs';
const origin='https://oportals.com';
test('production release routes public requests through the reviewed handler with live Meta settings',async()=>{
 const calls=[],context={assets:{},Request,Response,URL,createHandler:()=>async(request,env)=>{calls.push({path:new URL(request.url).pathname,env});return new Response('reviewed');}};
 vm.runInNewContext(metaProductionRelease().replace('export default','globalThis.worker='),context);
 const env={META_TRACKING_ENABLED:'true',META_TEST_MODE:'false',PAYPAL_ENV:'live',DOWNLOAD_SIGNING_KEY:'unchanged'};
 for(const path of ['/','/book/art-of-attention','/checkout?book=art-of-attention','/api/paypal/verify','/download?t=fixture','/Conversions/meta']){await context.worker.fetch(new Request(origin+path),env);assert.equal(calls.at(-1).env,env);assert.equal(calls.at(-1).env.META_TEST_MODE,'false');}
});
test('production promotion preserves isolated Testing flags and leaves live PayPal configuration intact',async()=>{
 const calls=[],context={assets:{},Request,Response,URL,createHandler:()=>async(request,env)=>{calls.push(env);return new Response('reviewed');}};
 vm.runInNewContext(metaProductionRelease().replace('export default','globalThis.worker='),context);const env={META_TRACKING_ENABLED:'true',META_TEST_MODE:'false',PAYPAL_ENV:'live',PAYPAL_PDT_TOKEN:'unchanged'};
 await context.worker.fetch(new Request(origin+'/Testing/Meta'),env);assert.equal(calls.at(-1).META_TEST_MODE,'true');assert.equal(calls.at(-1).META_TEST_EVENT_CODE,'TEST10333');assert.equal(calls.at(-1).PAYPAL_ENV,env.PAYPAL_ENV);assert.equal(calls.at(-1).PAYPAL_PDT_TOKEN,env.PAYPAL_PDT_TOKEN);assert.equal(env.META_TEST_MODE,'false');
});
test('public output provides the consent choice and configured existing dataset without exposing server secrets',async()=>{
 const h=createHandler({commerceProducts:{'art-of-attention':{title:'The Art of Attention',price:'8.99'}}});const response=await h(new Request(origin+'/paypal/return'),{META_TRACKING_ENABLED:'true',META_TEST_MODE:'false',META_CAPI_ACCESS_TOKEN:'CANARY-SERVER-ONLY'}),html=await response.text();
 assert.match(html,/id="meta-marketing-consent"/);assert.match(html,/"pixelId":"4490808921236945","enabled":true,"testMode":false/);assert.ok(!html.includes('CANARY-SERVER-ONLY'));assert.equal((html.match(/src="\/meta-pixel.js/g)||[]).length,1);assert.match(response.headers.get('Content-Security-Policy'),/https:\/\/connect.facebook.net/);
});
