const vm=require('vm'),fs=require('fs'),assert=require('assert');
const dir=require('path').resolve(__dirname,'..');
const store={
 '@data/library-v03.json':JSON.stringify({roots:['/Users/demo/infuse'],categories:[{id:'films',name:'Movies',kind:'film'},{id:'series',name:'TV Shows',kind:'series'}],overrides:{},renames:{}})
};
const film='/Users/demo/infuse/films/Black.Swan.2010.mkv';
const ep='/Users/demo/infuse/series/Brooklyn 99/Season 7/S07E10.mkv';
function runGlobal(){
 const handlers={},messages=[],players=[];
 const iina={
 standaloneWindow:{setProperty(){},setFrame(){},loadFile(){},open(){},onMessage(n,cb){handlers[n]=cb},postMessage(n,data){messages.push({n,data})}},
 global:{onMessage(n,cb){handlers['global:'+n]=cb},createPlayerInstance(opts){players.push(opts);return players.length}},
 file:{exists(p){return Object.hasOwn(store,p)},read(p){return store[p]},write(p,v){store[p]=v},delete(p){delete store[p]},handle(){return {readToEnd(){return[]},close(){}}}},
 utils:{exec:async(cmd,args)=>({status:0,stdout:[film,ep].join('\0')+'\0',stderr:''})},
 menu:{addItem(){},item(){return{}}},
 };
 vm.runInNewContext(fs.readFileSync(dir+'/global.js','utf8'),{iina,Date,Number,String,Math,Set,Map,JSON,Promise});
 return {handlers,messages,players};
}
async function flush(){await new Promise(r=>setImmediate(r));}
function runPlayer(initialLabel=''){
 const event={},out=[],pos={p:0,d:6600},seeks=[];
 const iina={
 global:{getLabel(){return initialLabel},postMessage(n,v){out.push({n,...v})}},
 core:{status:{url:film},seekTo(n){seeks.push(n)}},
 mpv:{getNumber(k){return k==='duration'?pos.d:pos.p},getString(k){return k==='path'?film:''}},
 event:{on(n,fn){event[n]=fn}}
 };
 vm.runInNewContext(fs.readFileSync(dir+'/main.js','utf8'),{iina,Date,Number,String,Math,decodeURIComponent});
 return {event,out,pos,seeks};
}
(async()=>{
 const global=runGlobal();global.handlers.ready();await flush();
 assert(global.messages.at(-1).data.items.some(x=>x.path===film),'movie indexed');
 const p=runPlayer();
 p.event['iina.file-loaded'](film);p.event['mpv.file-loaded']();
 // Set the time to 167 sec. Watch progress should be transmitted.
 p.pos.p=167;p.event['mpv.pause.changed']();
 const first=p.out.at(-1);assert.equal(first.position,167);
 global.handlers['global:watch-progress'](first);
 let db=JSON.parse(store['@data/library-watch-v011.json']);assert.equal(db[film].position,167);
 assert(global.messages.at(-1).data.watch?.[film]?.position===167 || global.messages.some(x=>x.n==='watch'&&x.data.watch[film]?.position===167));
 // Closing native window changes mpv time-pos to 0. The last good position must survive.
 p.pos.p=0;p.event['mpv.end-file']();p.event['iina.window-will-close']();
 assert.equal(p.out.at(-1).position,167,'player preserved last good sample on close');
 for(const msg of p.out.slice(-2))global.handlers['global:watch-progress'](msg);
 db=JSON.parse(store['@data/library-watch-v011.json']);assert.equal(db[film].position,167,'watch entry unchanged after closing');
 // Even if IINA sends zero position unexpectedly, global refuses to erase progress.
 global.handlers['global:watch-progress']({path:film,position:0,duration:6600,event:'closed'});
 db=JSON.parse(store['@data/library-watch-v011.json']);assert.equal(db[film].position,167);
 // Restart IINA global entry. The same persisted progress must load automatically.
 const reboot=runGlobal();reboot.handlers.ready();await flush();
 const restored=reboot.messages.filter(x=>x.n==='library').at(-1);
 assert.equal(restored.data.watch[film].position,167,'load saved position after restart');
 assert(restored.data.items.some(x=>x.path===film));
 reboot.handlers.play({path:film});
 assert.equal(reboot.players.at(-1).label,'iinalib-resume:164','resume position minus three seconds');
 const resumed=runPlayer(reboot.players.at(-1).label);resumed.event['iina.file-loaded'](film);resumed.event['mpv.file-loaded']();
 assert(resumed.seeks.some(x=>x===164),'seek restored');
 // Another episode stays separate.
 reboot.handlers['global:watch-progress']({path:ep,position:100,duration:1200,event:'paused'});
 assert.equal(JSON.parse(store['@data/library-watch-v011.json'])[ep].position,100);
 assert.equal(JSON.parse(store['@data/library-watch-v011.json'])[film].position,167);
 // Completion near 93% excludes movie from Continue Watching.
 reboot.handlers['global:watch-progress']({path:film,position:6300,duration:6600,event:'tick'});
 assert(JSON.parse(store['@data/library-watch-v011.json'])[film].completed);
 console.log('PASS: position preserved on close, bogus zero ignored, disk reload, resume label+seek, separate episodes, finished video');
})().catch(err=>{console.error(err);process.exitCode=1});
