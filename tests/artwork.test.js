const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const handlers={},messages=[],storage={
  '@data/library-v03.json':JSON.stringify({roots:['/Videos'],categories:[{id:'films',name:'Movies',kind:'film'},{id:'series',name:'TV Shows',kind:'series'}],overrides:{},renames:{}}),
  '@data/tmdb-settings-v06.json':JSON.stringify({apiKey:'test-key'})
};
let releaseDownload;
const downloadGate=new Promise(resolve=>releaseDownload=resolve);
const mock={
 standaloneWindow:{setProperty(){},setFrame(){},loadFile(){},open(){},onMessage(k,cb){handlers[k]=cb},postMessage(k,data){messages.push({k,data})}},
 file:{exists:k=>Object.hasOwn(storage,k),read:k=>storage[k],write:(k,v)=>storage[k]=v,delete:k=>delete storage[k],handle:(k)=>({readToEnd(){return Uint8Array.from([255,216,255,0,42])},close(){}})},
 http:{get:async url=>({statusCode:200,data:{results:[{id:999,title:'Black Swan',original_title:'Black Swan',release_date:'2010-12-03',overview:'Summary',poster_path:'/x.jpg',vote_average:7.7,backdrop_path:''}]}}),download:async(url,dest)=>{await downloadGate;storage[dest]='jpeg payload'}},
 utils:{exec:async()=>({status:0,stdout:'/Videos/films/Black.Swan.2010.mkv\0',stderr:''})},
 global:{onMessage(){},createPlayerInstance(){}},menu:{addItem(){},item(){return{}}}
};
const ctx=vm.createContext({iina:mock,Date,Number,String,Math,Set,Map,JSON,Promise,Uint8Array});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../global.js'),'utf8'),ctx);
(async()=>{
 await vm.runInContext('scan()',ctx);
 const enrichPromise=vm.runInContext('enrich()',ctx);
 // Await until the HTTP image request is in flight.
 for(let i=0;i<20&&!vm.runInContext('posterDownloads.size>0',ctx);i++)await new Promise(r=>setTimeout(r,0));
 assert(vm.runInContext('posterDownloads.size===1',ctx),'poster download is in flight');
 assert(messages.some(m=>m.k==='library'&&m.data.meta['movie:black-swan:2010']),'metadata arrives before artwork download');
 // A front-end request during the download should wait, not mark the poster missing.
 handlers.poster('movie:black-swan:2010');
 assert(!messages.some(m=>m.k==='poster'&&m.data.missing),'premature missing poster response');
 releaseDownload();await enrichPromise;
 await new Promise(r=>setTimeout(r,0));
 assert(messages.some(m=>m.k==='poster-ready'&&m.data.key==='movie:black-swan:2010'),'poster-ready triggers immediate retry');
 assert(messages.some(m=>m.k==='poster'&&m.data.src.startsWith('data:image/jpeg;base64,')),'poster bytes sent to UI without restart');
 console.log('PASS: first-time TMDB poster downloaded and delivered without a restart');
})().catch(e=>{console.error(e);process.exit(1)});
