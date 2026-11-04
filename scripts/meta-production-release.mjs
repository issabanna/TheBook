// Production uses the reviewed handler. Keep the existing Testing namespace
// isolated from genuine Meta reporting without changing live PayPal settings.
export function metaProductionRelease(){return `
const productionHandler=createHandler(assets);
export default {fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/Testing'||path.startsWith('/Testing/'))return productionHandler(request,{...env,META_TRACKING_ENABLED:'true',META_TEST_MODE:'true',META_TEST_EVENT_CODE:'TEST10333'},ctx);
 return productionHandler(request,env,ctx);
}};
`;}
