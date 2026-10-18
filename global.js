// IINA Library v0.13 — local library, TMDB, resume playback and privacy-aware cache.
// Pas de serveur. Le scan /usr/bin/find répertorie également les fichiers iCloud visibles dans Finder.
const win = iina.standaloneWindow;
const STORE='@data/library-v03.json', OLD='@data/library-folders.json';
const META_STORE='@data/tmdb-cache-v06.json', SETTINGS='@data/tmdb-settings-v06.json';
const MANUAL_STORE='@data/library-overrides-v08.json';
const SEASON_STORE='@data/library-seasons-v09.json';
const WATCH_STORE='@data/library-watch-v011.json';
const VIDEO=/\.(mkv|mp4|m4v|mov|avi|webm|wmv|flv|mpg|mpeg|ts|mts|m2ts|vob|3gp|ogv)$/i;
const DEFAULTS=[{id:'films',name:'Movies',kind:'film'},{id:'series',name:'TV Shows',kind:'series'}];
const MAX_FILES=25000,MAX_LOOKUPS=160;
const TMDB_CACHE_MAX_AGE_MS=180*24*60*60*1000; // Conservative < six calendar months

let roots=[],categories=DEFAULTS.map(c=>({...c})),overrides={},renames={},items=[],errors=[],report=[],busy=false,loadingMeta=false,metaProgress='';
let tmdbKey='',meta={},manualMeta={},seasonMeta={},watchState={};
function norm(v){if(typeof v==='string')return v.trim();if(v&&typeof v.path==='string')return v.path.trim();return '';}
function key(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function slug(s){return key(s).replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-');}
function uniqueId(){return 'c'+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36);}
// TMDB v3 met la cle dans le parametre api_key; les erreurs HTTP peuvent recopier l'URL.
// Ne jamais afficher le jeton dans les diagnostics de notre interface.
function redact(v){return String(v).replace(/([?&]api_key=)[^&\s]+/gi,'$1[REDACTED]').replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi,'$1[REDACTED]');}
function log(s){report.push(redact(s));if(report.length>120)report.shift();}
function fail(s){errors.push(redact(s));log('ERREUR: '+s);}
function readJSON(path,fallback){try{if(iina.file.exists(path))return JSON.parse(iina.file.read(path));}catch(e){fail('Lecture '+path+': '+String(e));}return fallback;}
function writeJSON(path,value){try{iina.file.write(path,JSON.stringify(value));}catch(e){fail('Sauvegarde '+path+': '+String(e));}}
function load(){let d=readJSON(STORE,null);if(d){roots=(d.roots||[]).map(norm).filter(Boolean);if(Array.isArray(d.categories)&&d.categories.length)categories=d.categories;overrides=d.overrides||{};renames=d.renames||{};}else{let old=readJSON(OLD,[]);roots=(Array.isArray(old)?old:[]).map(norm).filter(x=>x&&x!=='[object Object]');}roots=[...new Set(roots)];meta=readJSON(META_STORE,{});manualMeta=readJSON(MANUAL_STORE,{});seasonMeta=readJSON(SEASON_STORE,{});const settings=readJSON(SETTINGS,{});tmdbKey=String(settings.apiKey||'');watchState=readJSON(WATCH_STORE,{});if(!watchState||typeof watchState!=='object'||Array.isArray(watchState))watchState={};expireTMDBCache();}
function save(){writeJSON(STORE,{roots,categories,overrides,renames});}
function saveMeta(){writeJSON(META_STORE,meta);}
function saveManual(){writeJSON(MANUAL_STORE,manualMeta);}
function saveSeasons(){writeJSON(SEASON_STORE,seasonMeta);}
function saveWatch(){writeJSON(WATCH_STORE,watchState);}
function expireTMDBCache(){
 const now=Date.now(),tooOld=when=>!(Number(when)>0)||now-Number(when)>TMDB_CACHE_MAX_AGE_MS;
 let removed=0;
 for(const k of Object.keys(meta)){
  const record=meta[k];
  if(!record||tooOld(record.cachedAt)){
   // Art belongs to the TMDB cache, not to the user's media collection.
   if(record&&record.id&&record.type){
    try{const poster=posterPathFor(record.type,record.id);if(iina.file.exists(poster))iina.file.delete(poster);}catch(e){log('Failed to remove outdated TMDB image: '+String(e));}
   }
   delete meta[k];removed++;
  }
 }
 let oldSeasons=0;
 for(const k of Object.keys(seasonMeta))if(!seasonMeta[k]||tooOld(seasonMeta[k].createdAt)){delete seasonMeta[k];oldSeasons++;}
 if(removed)saveMeta();
 if(oldSeasons)saveSeasons();
 if(removed||oldSeasons)log('Expired TMDB cache: '+removed+' title(s), '+oldSeasons+' season(s). Manual edits and watch progress were retained.');
}

function sendWatch(){win.postMessage('watch',{watch:watchState});}
function send(){win.postMessage('library',{roots,categories,items,errors,report,busy,loadingMeta,metaProgress,hasKey:!!tmdbKey,meta,manualMeta,watch:watchState});}
function isInside(p,root){return p===root||p.startsWith(root.replace(/\/$/,'')+'/');}
function guessCategory(path,root){let rel=path.slice(root.length).replace(/^\/+/,''),parts=rel.split('/').slice(0,-1);for(let part of parts){let s=key(part);if(/^(films?|movies?|cinema)$/.test(s))return 'films';if(/^(series?|tv shows?|shows?|television|tv)$/.test(s))return 'series';}return /\bS\d{1,2}E\d{1,3}\b|\bseason\s*\d+\b|\bsaison\s*\d+\b/i.test(path)?'series':'films';}
function humanize(text){return String(text||'').replace(/\.[^.]+$/,'').replace(/[._]+/g,' ').replace(/\s+/g,' ').trim();}
function genericDirectory(s){return /^(films?|movies?|cinema|series?|séries?|tv[ -]?shows?|shows?|videos?|media|infuse|season\s*\d+|saison\s*\d+|s\d{1,2})$/i.test(String(s||'').trim());}
function withoutNoise(raw){return String(raw||'').replace(/\.icloud$/i,'').replace(/\.[^.]+$/,'').replace(/[._]+/g,' ').replace(/\b(?:2160p|1080p|720p|480p|dvdrip|dvdscr|dvdscreener|dvd|hdr10|bluray|blu ray|bdrip|brrip|remux|web[ -]?dl|webrip|hdtv|hevc|x264|x265|h264|h265|av1|hdrip|hdr|dv|dts|aac|ac3|atmos|10[ -]?bit|wawacity|ygg|rarbg|yify)\b.*$/i,'').replace(/\s+/g,' ').replace(/[\s_.-]+$/,'').trim();}
function yearFrom(s){const hits=[...String(s||'').matchAll(/(?:^|[\s(\[._-])(19\d{2}|20\d{2})(?=$|[\s)\]._\-])/g)];return hits.length?hits[hits.length-1][1]:'';}
function cleanTitle(s,year){let v=withoutNoise(s);if(year){const index=v.lastIndexOf(year);if(index>1)v=v.slice(0,index);}return v.replace(/[\s\[\]()-]+$/,'').trim();}
function suspicious(s){const v=String(s||'').trim(),compact=v.replace(/\s/g,'');if(!v)return true;if(v.length>78||/^[a-z0-9_-]{29,}$/i.test(v))return true;if(/^[a-z0-9]{22,}(?:\s+[a-z0-9]{16,})+$/i.test(v))return true;if(compact.length>=28&&/^[a-z0-9_-]+$/i.test(compact)&&!v.includes(' '))return true;if(/^[0-9_-]+$/.test(v))return true;return false;}
function parentHint(path,root){const relative=path.slice(root.length).replace(/^\/+/,''),folders=relative.split('/').slice(0,-1);for(let i=folders.length-1;i>=0;i--){const f=humanize(folders[i]);if(f&&!genericDirectory(f)&&!suspicious(f))return f;}return '';}
function parseVideo(path,cat,root){const filename=path.split('/').pop()||'',raw=humanize(filename),parent=parentHint(path,root),fileYear=yearFrom(raw),parentYear=yearFrom(parent),year=fileYear||parentYear;
if(cat==='films'){
let title=cleanTitle(filename,fileYear),folderTitle=cleanTitle(parent,parentYear),source='fichier';
const fileWords=key(title).replace(/[^a-z0-9 ]/g,' ').trim();const dirWords=key(folderTitle).replace(/[^a-z0-9 ]/g,' ').trim();
const fileIsPrefix=Boolean(fileWords.length>=7&&dirWords.startsWith(fileWords)&&dirWords.length>fileWords.length);
if(folderTitle&&(suspicious(title)||fileIsPrefix||title.length<3)){title=folderTitle;source='dossier';}
if(suspicious(title))title='Film à identifier';
const hints=[title,folderTitle,cleanTitle(filename,fileYear)].filter((s,i,all)=>s&&!s.includes('à identifier')&&all.indexOf(s)===i);
return {title:title||'Film à identifier',year,episode:'',parentTitle:folderTitle,matchSource:source,searchHints:hints};}
// Prefer the show directory for episodic releases, and ignore season folder names.
const rel=path.slice(root.length).replace(/^\/+/,''),parts=rel.split('/');
const folders=parts.slice(0,-1).map(humanize);
const stripSeason=s=>String(s||'').replace(/\b(?:season|saison)\s*\d{1,2}\b.*$/i,'').replace(/\bS\d{1,2}\b.*$/i,'').trim();
const folderShows=folders.filter(v=>!genericDirectory(v)&&!/^season\s*\d+/i.test(v)&&!/^saison\s*\d+/i.test(v)&&!/^s\d{1,2}$/i.test(v));
const folderShow=folderShows.length?stripSeason(folderShows[folderShows.length-1]):'';
const ep=raw.match(/\bS(\d{1,2})[ ._-]*E(\d{1,3})\b/i)||raw.match(/\b(\d{1,2})x(\d{1,3})\b/i)||raw.match(/\bSeason[ ._-]*(\d{1,2})[ ._-]*Episode[ ._-]*(\d{1,3})\b/i);
const seasonFolder=folders.slice().reverse().map(v=>v.match(/^(?:season|saison)[ ._-]*(\d{1,2})$/i)||v.match(/^s(\d{1,2})$/i)).find(Boolean);
const fallbackEp=raw.match(/^(?:episode|ep)[ ._-]*(\d{1,3})\b/i);
const seasonNum=ep?Number(ep[1]):seasonFolder?Number(seasonFolder[1]):null;
const episodeNum=ep?Number(ep[2]):fallbackEp?Number(fallbackEp[1]):null;
const fromEpisode=ep?raw.slice(0,ep.index).replace(/[\-._\s]+$/,'').trim():'';
const episodePrefix=stripSeason(fromEpisode);
let showTitle=folderShow||(!suspicious(episodePrefix)&&episodePrefix.length>=3?episodePrefix:'');
if(!showTitle||genericDirectory(showTitle))showTitle=parent;
showTitle=cleanTitle(showTitle,yearFrom(showTitle));
if(suspicious(showTitle))showTitle='Série à identifier';
const episode=seasonNum!==null&&episodeNum!==null?'S'+String(seasonNum).padStart(2,'0')+'E'+String(episodeNum).padStart(2,'0'):'';
return {title:showTitle,year:'',episode,seasonNumber:seasonNum,episodeNumber:episodeNum,parentTitle:folderShow||parent,matchSource:folderShow?'dossier':'fichier',searchHints:[showTitle,folderShow,episodePrefix].filter((v,i,a)=>v&&!v.includes('à identifier')&&a.indexOf(v)===i)};}

function mediaKey(f){return (f.category==='series'?'tv:':'movie:')+slug(f.title)+(f.category==='films'&&f.year?':'+f.year:'');}
function addFile(orig,root,seen){let path=norm(orig),placeholder=/\.icloud$/i.test(path);let apparent=path.replace(/\.icloud$/i,'').replace(/\/\.([^/]+)$/,'/$1');if(!VIDEO.test(apparent)||seen.has(path))return false;seen.add(path);const raw=path.split('/').pop()||'';if(raw.startsWith('.')&&!placeholder)return false;const cat=overrides[path]||guessCategory(path,root),parsed=parseVideo(apparent,cat,root);if(renames[path])parsed.title=renames[path];const f={path,name:humanize(raw.replace(/\.icloud$/i,'')),category:cat,root,icloud:placeholder,...parsed};f.mediaKey=mediaKey(f);items.push(f);return true;}
async function scan(){if(busy)return;busy=true;items=[];errors=[];report=[];log('Scanning folders with /usr/bin/find without downloading or opening media.');send();try{const seen=new Set();for(const root of roots){try{const result=await iina.utils.exec('/usr/bin/find',[root,'-type','f','-print0']);if(result.status!==0)fail('Access to '+root+' : '+String(result.stderr||'Error '+result.status));const paths=String(result.stdout||'').split('\0').filter(Boolean);log(root+': '+paths.length+' files visible');for(const p of paths.slice(0,MAX_FILES))addFile(p,root,seen);if(paths.length>MAX_FILES)fail('Limit of '+MAX_FILES+' files reached for '+root);}catch(e){fail('Scan '+root+': '+String(e));}}items.sort((a,b)=>a.title.localeCompare(b.title,'fr')||a.name.localeCompare(b.name,'fr'));log('Total : '+items.length+' vidéos, '+items.filter(x=>x.category==='series').length+' TV episodes detected.');if(roots.length&&!items.length&&!errors.length)fail('No video files found. Check file extensions and macOS permissions.');}catch(e){fail('Scan : '+String(e));}busy=false;send();}
function addPath(v){const p=norm(v).replace(/\/$/,'');if(!p)return;if(!p.startsWith('/')){fail('Choose an absolute path: '+p);send();return;}if(roots.some(r=>isInside(p,r)))return;if(!roots.includes(p)){roots=roots.filter(r=>!isInside(r,p));roots.push(p);}save();scan();}
function clearMetaFor(f){delete meta[f.mediaKey];saveMeta();}
// Comparaison stricte des titres FR et originaux pour éviter les faux positifs (« My Beautiful Boy » ≠ « Beautiful Boy »).
function comparable(s){return key(s).replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function scoreCandidate(r,name,year){const q=comparable(name),variants=[r.title,r.original_title,r.name,r.original_name].filter(Boolean),want=q.split(' ').filter(Boolean);let best=0;
for(const candidate of variants){const v=comparable(candidate),got=v.split(' ').filter(Boolean);if(v===q){best=Math.max(best,130);continue;}const qs=new Set(want),vs=new Set(got),intersection=[...qs].filter(x=>vs.has(x)).length;
const overlap=intersection/Math.max(qs.size,vs.size,1),coverage=intersection/Math.max(qs.size,1);
const extra=Math.max(vs.size-qs.size,0),missing=Math.max(qs.size-vs.size,0);
const score=92*overlap + 9*coverage-9*extra-14*missing;
best=Math.max(best,score);}
if(year){const candidateYear=Number(String(r.release_date||r.first_air_date||'').slice(0,4));const expected=Number(year);if(candidateYear){const delta=Math.abs(candidateYear-expected);best+=delta===0?25:delta===1?5:delta<=3?-20:-65;}}
return best;}
function rankCandidates(results,name,year){return (Array.isArray(results)?results:[]).map(r=>({r,score:scoreCandidate(r,name,year)})).sort((a,b)=>b.score-a.score||Number(b.r.popularity||0)-Number(a.r.popularity||0));}
function bestResult(results,name,year){const ranked=rankCandidates(results,name,year);if(!ranked.length||ranked[0].score<94)return null;
if(ranked.length>1&&ranked[0].score-ranked[1].score<6&&ranked[0].score<150)return null;
return ranked[0].r;}
async function tmdbJSON(url){const response=await iina.http.get(url,{headers:{Accept:'application/json'}});if(Number(response.statusCode)!==200)throw Error('TMDB HTTP '+response.statusCode);const data=response.data&&typeof response.data==='object'?response.data:JSON.parse(response.text||'{}');if(!data||typeof data!=='object')throw Error('Invalid TMDB response');return data;}
// Load a whole season only when the user opens it, then keep episode titles offline.
async function getSeason(data){
 const path=norm(data&&data.path),f=items.find(x=>x.path===path&&x.category==='series');
 const season=Number(data&&data.season),m=f&&meta[f.mediaKey];
 if(!f||!Number.isInteger(season)||season<0||season>99)return;
 const cacheKey=m&&m.id?'tv:'+m.id+':'+season:'';
 if(cacheKey&&seasonMeta[cacheKey]&&(seasonMeta[cacheKey].language==='en-US'||!tmdbKey)){win.postMessage('season',{path,season,episodes:seasonMeta[cacheKey].episodes||[],cached:true});return;}
 if(!m||!m.id){win.postMessage('season',{path,season,episodes:[],error:'Match this TV series to a TMDB entry to load episode titles.'});return;}
 if(!tmdbKey){win.postMessage('season',{path,season,episodes:[],error:'Episode titles are unavailable offline until this season has been loaded once.'});return;}
 try{
 const base='https://api.themoviedb.org/3/tv/'+encodeURIComponent(m.id)+'/season/'+season+'?api_key='+encodeURIComponent(tmdbKey)+'&language=';
 let d=await tmdbJSON(base+'en-US');
 if(!Array.isArray(d.episodes)||!d.episodes.length)d=await tmdbJSON(base+'fr-FR');
 const episodesSource=Array.isArray(d.episodes)?d.episodes:[];
 // Prefer English episode names and summaries when supplied by TMDB.
 if(episodesSource.some(ep=>!ep.name||/^(?:episode|épisode)\s*\d+$/i.test(ep.name)||!ep.overview)){
  try{const alt=await tmdbJSON(base+'fr-FR');const byNumber=new Map((alt.episodes||[]).map(ep=>[ep.episode_number,ep]));
   d.episodes=episodesSource.map(ep=>{const candidate=byNumber.get(ep.episode_number);if(!candidate)return ep;return {...ep,name:ep.name||candidate.name||'',overview:ep.overview||candidate.overview||''};});
  }catch(e){log('Season fallback details unavailable: '+season);}
 }
 const episodes=(d.episodes||[]).map(ep=>({number:Number(ep.episode_number),name:String(ep.name||''),overview:String(ep.overview||''),airDate:String(ep.air_date||''),stillPath:String(ep.still_path||'')}));
 seasonMeta[cacheKey]={episodes,language:'en-US',createdAt:Date.now()};saveSeasons();
 win.postMessage('season',{path,season,episodes,cached:false});
 }catch(e){win.postMessage('season',{path,season,episodes:[],error:redact(String(e))});}
}
async function searchTMDB(type,query,year,language){let url='https://api.themoviedb.org/3/search/'+type+'?api_key='+encodeURIComponent(tmdbKey)+'&language='+encodeURIComponent(language||'fr-FR')+'&include_adult=false&query='+encodeURIComponent(query);
if(year&&type==='movie')url+='&year='+encodeURIComponent(year);
const data=await tmdbJSON(url);return Array.isArray(data.results)?data.results:[];}
function uniqueResults(groups){const seen=new Set(),results=[];for(const group of groups){for(const r of group){if(!Number.isInteger(Number(r.id))||seen.has(r.id))continue;seen.add(r.id);results.push(r);}}return results;}

function posterPathFor(kind,id){return '@data/poster-v06-'+kind+'-'+String(id)+'.jpg';}
async function downloadPoster(record){if(!record||!record.posterPath)return false;
const dest=posterPathFor(record.type,record.id);if(iina.file.exists(dest))return true;
try{await iina.http.download('https://image.tmdb.org/t/p/w342'+record.posterPath,dest);if(!iina.file.exists(dest))throw Error('Downloaded poster not found');log('Poster cached: '+record.title);return true;}
catch(e){log('Poster unavailable ('+record.title+'): '+String(e));return false;}}
function recordFromTMDB(type,found){return {id:found.id,type,title:found.title||found.name||found.original_title||found.original_name||'Sans titre',year:String(found.release_date||found.first_air_date||'').slice(0,4),overview:found.overview||'',rating:typeof found.vote_average==='number'?found.vote_average:null,posterPath:found.poster_path||'',backdropPath:found.backdrop_path||'',cachedAt:Date.now()};}
async function cacheRecord(k,record){meta[k]=record;saveMeta();send();await downloadPoster(record);send();}
function searchVariations(f){const queries=[];
for(const hint of [f.title,...(f.searchHints||[])]){if(!hint||hint.includes('à identifier'))continue;let cleaned=String(hint).trim();if(!queries.includes(cleaned))queries.push(cleaned);
// A first film can have a folder title ending in " 1" whereas TMDB omits this index.
if(f.category==='films'&&/\s+1$/.test(cleaned)){const stripped=cleaned.replace(/\s+1$/,'');if(stripped&&!queries.includes(stripped))queries.push(stripped);}}
return queries.slice(0,4);}
async function fetchOne(f){const k=f.mediaKey;if(meta[k]&&meta[k].id){await downloadPoster(meta[k]);return;}
const type=f.category==='series'?'tv':'movie',queries=searchVariations(f);if(!queries.length)return;
for(const query of queries){const groups=[await searchTMDB(type,query,f.year,'en-US')];let found=bestResult(groups[0],query,f.year);
if(!found){groups.push(await searchTMDB(type,query,'','fr-FR'));found=bestResult(uniqueResults(groups),query,f.year);}
if(found){await cacheRecord(k,recordFromTMDB(type,found));return;}}
log('Metadata needs confirmation: '+f.title+' — use Edit metadata.');}
async function searchCandidates(data){const path=norm(data&&data.path),f=items.find(x=>x.path===path);if(!f)return;
if(!tmdbKey){win.postMessage('candidates',{path,error:'Set your TMDB key before searching.'});return;}
const type=f.category==='series'?'tv':'movie',query=String(data.query||f.title||'').trim().slice(0,120);if(!query){win.postMessage('candidates',{path,error:'Enter a title to search.'});return;}
try{const [fr,en]=await Promise.all([searchTMDB(type,query,'','fr-FR'),searchTMDB(type,query,'','en-US')]);const results=rankCandidates(uniqueResults([fr,en]),query,f.year).slice(0,14).map(({r,score})=>({id:r.id,title:r.title||r.name||r.original_title||'Sans titre',originalTitle:r.original_title||r.original_name||'',year:String(r.release_date||r.first_air_date||'').slice(0,4),overview:r.overview||'',posterPath:r.poster_path||'',score:Math.round(score)}));
win.postMessage('candidates',{path,query,results});}catch(e){win.postMessage('candidates',{path,error:redact(String(e))});}}
async function applyCandidate(data){const path=norm(data&&data.path),f=items.find(x=>x.path===path);if(!f)return;const id=Number(data&&data.id);
if(!Number.isSafeInteger(id)||id<1||id>999999999){fail('Invalid TMDB ID.');send();return;}
const type=f.category==='series'?'tv':'movie';
try{const url='https://api.themoviedb.org/3/'+type+'/'+id+'?api_key='+encodeURIComponent(tmdbKey)+'&language=en-US';let entry=await tmdbJSON(url);
// Fill missing English metadata from French when TMDB has no English details.
if(!entry.overview){try{const alt=await tmdbJSON('https://api.themoviedb.org/3/'+type+'/'+id+'?api_key='+encodeURIComponent(tmdbKey)+'&language=fr-FR');entry.overview=alt.overview||'';if(!entry.poster_path)entry.poster_path=alt.poster_path;}catch(e){log('English synopsis unavailable: '+String(e));}}
delete manualMeta[f.mediaKey];saveManual();await cacheRecord(f.mediaKey,recordFromTMDB(type,entry));log('Manually matched: '+f.title+' → '+(entry.title||entry.name||''));
win.postMessage('association',{path,ok:true,title:entry.title||entry.name||f.title});send();}
catch(e){fail('TMDB matching: '+String(e));win.postMessage('association',{path,ok:false,error:redact(String(e))});send();}}
async function enrich(){if(loadingMeta)return;if(!tmdbKey){fail('Add a TMDB API key in Settings before fetching metadata.');send();return;}loadingMeta=true;metaProgress='Preparing…';errors=[];send();let attempted=0,updated=0;const unique=new Map();for(const f of items)if(!unique.has(f.mediaKey)&&(!meta[f.mediaKey]?.id||(meta[f.mediaKey]?.posterPath&&!iina.file.exists(posterPathFor(meta[f.mediaKey].type,meta[f.mediaKey].id)))))unique.set(f.mediaKey,f);const queue=[...unique.values()].slice(0,MAX_LOOKUPS);for(const f of queue){attempted++;metaProgress='Metadata '+attempted+'/'+queue.length+' : '+f.title;send();try{const before=!!meta[f.mediaKey]?.id;await fetchOne(f);if(!before&&meta[f.mediaKey]?.id)updated++;}catch(e){fail('TMDB '+f.title+': '+String(e));if(errors.length>8){fail('Too many network errors. Stopping to avoid unnecessary requests.');break;}}}loadingMeta=false;metaProgress=updated+' records fetched (local cache).' ;saveMeta();send();}
// Optional, non-destructive migration of already-cached French metadata into English.
// Retains the TMDB ID, file associations, downloaded posters, and custom local edits.
async function refreshEnglish(){
 if(loadingMeta)return;
 if(!tmdbKey){fail('Add a TMDB API key in Settings before updating descriptions.');send();return;}
 loadingMeta=true;errors=[];
 const targets=Object.keys(meta).filter(k=>meta[k]&&Number.isInteger(Number(meta[k].id))&&meta[k].id).slice(0,MAX_LOOKUPS);
 let updated=0;
 for(let i=0;i<targets.length;i++){
  const k=targets[i],old=meta[k],kind=old.type==='tv'?'tv':'movie';
  metaProgress='Updating English details '+(i+1)+'/'+targets.length;
  send();
  try{
   const url='https://api.themoviedb.org/3/'+kind+'/'+encodeURIComponent(old.id)+'?api_key='+encodeURIComponent(tmdbKey)+'&language=en-US';
   const english=await tmdbJSON(url);
   const record=recordFromTMDB(kind,english);
   meta[k]={...old,...record,overview:record.overview||old.overview};
   updated++;
  }catch(e){fail('Metadata update '+(old.title||k)+': '+String(e));}
 }
 saveMeta();loadingMeta=false;
 metaProgress='English metadata updated for '+updated+' titles. Original manual edits preserved.';
 send();
}
// Encode local JPEG binary as a data URL only when its card becomes visible.
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes){const chunks=[];let part='';for(let i=0;i<bytes.length;i+=3){let a=bytes[i],hasB=i+1<bytes.length,hasC=i+2<bytes.length,b=hasB?bytes[i+1]:0,c=hasC?bytes[i+2]:0;part+=B64[a>>2]+B64[((a&3)<<4)|(b>>4)]+(hasB?B64[((b&15)<<2)|(c>>6)]:'=')+(hasC?B64[c&63]:'=');if(part.length>8192){chunks.push(part);part='';}}chunks.push(part);return chunks.join('');}
function sendPoster(k){const m=meta[k];if(!m||!m.id||!m.posterPath)return;let dest=posterPathFor(m.type,m.id);try{if(!iina.file.exists(dest)){win.postMessage('poster',{key:k,missing:true});return;}const h=iina.file.handle(dest,'read');let data;try{data=h.readToEnd();}finally{h.close();}if(data.length>1400000)return;win.postMessage('poster',{key:k,src:'data:image/jpeg;base64,'+toBase64(data)});}catch(e){log('Affiche '+k+' : '+String(e));}}
// Playback history is keyed by the exact path, so episodes never overwrite one another.
// Updates from native playback are throttled in main.js to prevent excessive disk writes.
function validWatch(path){return items.some(f=>f.path===path);}
function updateWatch(data){
 const path=norm(data&&data.path),position=Number(data&&data.position),duration=Number(data&&data.duration);
 if(!path.startsWith('/')||!validWatch(path)||!Number.isFinite(position)||!Number.isFinite(duration)||duration<90)return;
 const old=watchState[path]||{};
 if(old.dismissed)return;
 const safeDuration=Math.min(duration,172800),safePosition=Math.max(0,Math.min(position,safeDuration));
 // mpv may reset time-pos to 0 when closing its native player window.
 // Never let that transient reset erase an existing Continue Watching entry.
 // This guard also protects the progress loaded from disk during startup.
 if(safePosition<3 && Number(old.position)>=45 && Number(old.duration)>0)return;
 const finished=safePosition/safeDuration>=.92 || (safePosition>=60&&safeDuration-safePosition<=75);
 const completed=(old.completed&&safePosition<45)?true:finished;
 watchState[path]={position:completed?safeDuration:safePosition,duration:safeDuration,
    completed,updatedAt:Date.now(),dismissed:false};
 saveWatch();sendWatch();
}
function setWatch(data){
 const path=norm(data&&data.path);if(!validWatch(path))return;
 const action=String(data.action||'');
 if(action==='clear'){delete watchState[path];}
 else if(action==='watched'){
  const prev=watchState[path]||{},duration=Number(prev.duration)||0;
  watchState[path]={position:duration,duration,completed:true,dismissed:true,updatedAt:Date.now()};
 } else if(action==='restart'){delete watchState[path];}
 else return;
 saveWatch();sendWatch();
}
function playMedia(raw){
 const data=typeof raw==='string'?{path:raw}:raw||{},path=norm(data.path);
 const f=items.find(x=>x.path===path);
 if(!f){fail('File not found in the library.');send();return;}
 if(f.icloud){fail('This video is stored in iCloud. Download it in Finder before playing.');send();return;}
 const restart=!!data.restart;
 if(restart){delete watchState[path];saveWatch();sendWatch();}
 const previous=watchState[path],pos=previous&&!previous.completed&&!previous.dismissed?Number(previous.position):0;
 const resume=!restart&&Number.isFinite(pos)&&pos>=45&&Number(previous.duration)>0&&pos/Number(previous.duration)<.92;
 const label=restart?'iinalib-restart:0':resume?'iinalib-resume:'+Math.round(Math.max(0,pos-3)):undefined;
 try{iina.global.createPlayerInstance({url:f.path,enablePlugins:true,...(label?{label}:{})});}
 catch(e){fail('IINA playback: '+String(e));send();}
}
load();
// On some IINA builds the titlebar flags set BEFORE opening the standalone
// window do not affect its actual native NSWindow. Keep a safe initial setup
// and apply the documented flags once the window has been created.
win.setProperty({title:'IINA Library',resizable:true});
function requestHiddenTitleBar(){
  try {
    win.setProperty({fullSizeContentView:true,hideTitleBar:true});
  } catch (err) {
    // Do not break the library if these properties are unavailable.
    log('Title bar experiment unsupported: '+String(err));
  }
}
win.setFrame(1280,800);win.loadFile('library.html');
win.onMessage('ready',()=>{requestHiddenTitleBar();send();scan();});win.onMessage('scan',scan);
iina.global.onMessage('watch-progress',updateWatch);
win.onMessage('watch-action',setWatch);
win.onMessage('add',()=>{try{const raw=iina.utils.chooseFile('Choose a media folder (e.g., infuse)' ,{chooseDir:true});if(raw&&typeof raw.then==='function')raw.then(addPath).catch(e=>{fail('Folder picker: '+String(e));send();});else addPath(raw);}catch(e){fail('Folder picker: '+String(e));send();}});
win.onMessage('add-path',addPath);
win.onMessage('remove',p=>{roots=roots.filter(r=>r!==norm(p));save();scan();});
win.onMessage('category-add',name=>{name=String(name||'').trim().slice(0,45);if(name){categories.push({id:uniqueId(),name,kind:'custom'});save();send();}});
win.onMessage('category-rename',d=>{const c=categories.find(x=>x.id===d.id),n=String(d.name||'').trim().slice(0,45);if(c&&n){c.name=n;save();send();}});
win.onMessage('category-delete',id=>{if(id==='films'||id==='series')return;categories=categories.filter(x=>x.id!==id);for(const p of Object.keys(overrides))if(overrides[p]===id)delete overrides[p];save();scan();});
win.onMessage('item-category',d=>{if(!categories.some(c=>c.id===d.category))return;const paths=Array.isArray(d.paths)?d.paths:[d.path];let changed=0;for(const p of paths){const f=items.find(x=>x.path===p);if(f){overrides[f.path]=d.category;changed++;}}if(changed){save();scan();}});
win.onMessage('rename-media',d=>{const f=items.find(x=>x.path===d.path),title=String(d.title||'').trim().slice(0,100);if(f&&title){for(const x of items){if(x.path===f.path||(f.category==='series'&&x.mediaKey===f.mediaKey))renames[x.path]=title;}save();scan();}});
win.onMessage('set-key',raw=>{tmdbKey=String(raw||'').trim();writeJSON(SETTINGS,{apiKey:tmdbKey});log(tmdbKey?'TMDB key saved on this Mac only.':'TMDB key removed.');send();});
win.onMessage('season',getSeason);win.onMessage('enrich',enrich);win.onMessage('refresh-english',refreshEnglish);win.onMessage('poster',sendPoster);win.onMessage('search-candidates',searchCandidates);win.onMessage('apply-candidate',applyCandidate);
win.onMessage('diagnose',()=>{log('IINA API ↔ window: OK. Videos '+items.length+', metadata entries '+Object.keys(meta).length+'. Cache: '+META_STORE);send();});
win.onMessage('reveal',async raw=>{const f=items.find(x=>x.path===norm(raw));if(!f){fail('File not found in the library.');send();return;}
try{iina.file.showInFinder(f.path);}catch(e){try{const result=await iina.utils.exec('/usr/bin/open',['-R',f.path]);if(result.status!==0)throw Error('Finder cannot reveal this file (exit code '+result.status+').');}catch(err){fail('Reveal in Finder: '+String(err));send();}}});
win.onMessage('save-local-meta',data=>{const f=items.find(x=>x.path===norm(data&&data.path));if(!f)return;
const title=String(data.title||'').trim().slice(0,150),year=String(data.year||'').trim(),overview=String(data.overview||'').trim().slice(0,5000);
if(!title){fail('The local title cannot be empty.');send();return;}
if(year&&!/^(18|19|20|21)\d{2}$/.test(year)){fail('Invalid release year (example: 1997).');send();return;}
manualMeta[f.mediaKey]={title,year,overview};saveManual();log('Custom metadata saved: '+title);win.postMessage('local-saved',{path:f.path,ok:true});send();});
win.onMessage('reset-local-meta',data=>{const f=items.find(x=>x.path===norm(data&&data.path));if(!f)return;delete manualMeta[f.mediaKey];saveManual();win.postMessage('local-saved',{path:f.path,ok:true});send();});
win.onMessage('play',playMedia);
iina.menu.addItem(iina.menu.item('Open IINA Library',()=>{win.open();requestHiddenTitleBar();scan();}));win.open();requestHiddenTitleBar();
