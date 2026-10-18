const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
const dir=path.resolve(__dirname,'..'),now=Date.now(),day=86400000;
const old={id:1,type:'movie',title:'Old',year:'2001',posterPath:'/old.jpg',cachedAt:now-190*day};
const fresh={id:2,type:'movie',title:'New',year:'2024',posterPath:'/new.jpg',cachedAt:now-10*day};
const store={
 '@data/library-v03.json':JSON.stringify({roots:[],categories:[{id:'films',name:'Movies',kind:'film'}],overrides:{},renames:{}}),
 '@data/tmdb-cache-v06.json':JSON.stringify({'old':old,'new':fresh}),
 '@data/library-seasons-v09.json':JSON.stringify({'old-season':{episodes:[],createdAt:now-190*day},'new-season':{episodes:[],createdAt:now-10*day}}),
 '@data/library-watch-v011.json':JSON.stringify({'/movie.mkv':{position:230,duration:500,updatedAt:now}}),
 '@data/library-overrides-v08.json':JSON.stringify({'movie:mine':{title:'My own title',overview:'Hand-written'}}),
 '@data/poster-v06-movie-1.jpg':'image old',
 '@data/poster-v06-movie-2.jpg':'image new'
};
const win={setProperty(){},setFrame(){},loadFile(){},onMessage(){},postMessage(){},open(){}};
const iina={standaloneWindow:win,file:{exists(p){return Object.hasOwn(store,p)},read(p){return store[p]},write(p,v){store[p]=v},delete(p){delete store[p]}},global:{onMessage(){},createPlayerInstance(){}},menu:{addItem(){},item(){return{}}}};
vm.runInNewContext(fs.readFileSync(dir+'/global.js','utf8'),{iina,Date,Number,String,Math,Set,Map,JSON,Promise});
const m=JSON.parse(store['@data/tmdb-cache-v06.json']),s=JSON.parse(store['@data/library-seasons-v09.json']);
assert(!m.old&&m.new&&s['new-season']&&!s['old-season'],'expired cache purged, fresh cache kept');
assert(!store['@data/poster-v06-movie-1.jpg']&&store['@data/poster-v06-movie-2.jpg'],'stale poster deleted');
assert(JSON.parse(store['@data/library-watch-v011.json'])['/movie.mkv'].position===230,'user watch state preserved');
assert(JSON.parse(store['@data/library-overrides-v08.json'])['movie:mine'].title==='My own title','custom metadata preserved');
console.log('PASS: 180-day metadata/season/poster expiration preserves local overrides and Continue Watching');
