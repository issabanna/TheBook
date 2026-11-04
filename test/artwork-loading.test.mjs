import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHandler} from '../src/worker.mjs';
const require=createRequire(import.meta.url);
const {parseHTML}=require('linkedom');

test('failed artwork retries twice, offers manual recovery outside links and clears on success',()=>{
 const {window,document}=parseHTML('<html><body><a href="/books/sample.pdf"><img src="/media/cover.webp" srcset="/media/cover.webp 320w, /media/cover-large.webp 640w" alt="Book cover"></a></body></html>');
 const timers=new Map();let next=0;const listeners={};
 // Linkedom does not propagate image resource events through the capture phase.
 document.addEventListener=(type,fn)=>{listeners[type]=fn;};
 const context={window,document,HTMLImageElement:window.HTMLImageElement,URL,location:new URL('https://oportals.com/'),Date,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(readFileSync('public/artwork-loading.js','utf8'),context);
 const image=document.querySelector('img'),fail=()=>listeners.error({target:image}),tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
 fail();fail();assert.equal(timers.size,1);tick();assert.match(image.src,/artwork-retry=/);assert.equal(image.hasAttribute('srcset'),false,'The failed responsive candidate must not override the retry URL');
 fail();tick();fail();assert.equal(timers.size,0);
 const button=document.querySelector('.artwork-reload');assert.ok(button);assert.equal(button.closest('a'),null);
 fail();assert.equal(document.querySelectorAll('.artwork-reload').length,1);
 button.click();assert.equal(document.querySelector('.artwork-reload'),null);
 fail();assert.equal(timers.size,1);listeners.load({target:image});assert.equal(timers.size,0);
 const foreign=document.createElement('img');foreign.src='https://example.com/image.webp';listeners.error({target:foreign});assert.equal(timers.size,0);
});

test('Testing, production and book sample pages all receive the artwork recovery script',async()=>{
 const body='<html><head></head><body><script></script></body></html>';
 const h=createHandler({artworkLoading:'/* recovery */',testing:{liveStorefront:true,publicPreview:true,keyEnv:'PREVIEW_V5_KEY'},publishedDraft:true,testingDraft:body,liveDraft:body});
 for(const route of ['/','/Testing','/book/art-of-attention','/Testing/book/art-of-attention']){
  const response=await h(new Request('https://oportals.com'+route),{PREVIEW_V5_KEY:'configured'});
  assert.equal(response.status,200);assert.match(await response.text(),/src="\/artwork-loading.js\?v=1" defer/);
 }
 assert.equal(await(await h(new Request('https://oportals.com/artwork-loading.js'),{})).text(),'/* recovery */');
 assert.equal((await h(new Request('https://oportals.com/artwork-loading.js',{method:'POST'}),{})).status,405);
});
