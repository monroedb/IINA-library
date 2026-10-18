// IINA Library v0.12 — player entry; conserves last good position on close.
// Watch state is stored by global.js in @data/library-watch-v011.json.
let currentPath='';
let lastPosted=0;
let lastPosition=0;
let lastDuration=0;
let seekApplied=false;
let label='';
try {label=String(iina.global.getLabel()||'');}catch(_){}
const resumeMatch=label.match(/^iinalib-(resume|restart):([0-9]+(?:\.[0-9]+)?)$/);
const seekTarget=resumeMatch?Number(resumeMatch[2]):null;
function getPath(){
 let value='';
 try {value=String(iina.core.status.url||'');}catch(_){}
 if(!value){try{value=String(iina.mpv.getString('path')||'');}catch(_){}}
 if(value.startsWith('file://')){
  try{value=decodeURIComponent(value.substring(7));}catch(_){value=value.substring(7);}
 }
 return value;
}
function sample(eventName,force){
 const ending=eventName==='closed'||eventName==='ended'||eventName==='switch';
 // On teardown, mpv's current path / time-pos can already be reset.
 const path=ending?(currentPath||getPath()):(getPath()||currentPath);
 if(!path||!path.startsWith('/'))return;
 currentPath=path;
 if(!ending){
  try{const n=iina.mpv.getNumber('duration');if(Number.isFinite(n)&&n>0)lastDuration=n;}catch(_){}
  try{
   const n=iina.mpv.getNumber('time-pos');
   if(Number.isFinite(n)&&n>=0){
    // A zero value after playback has advanced is usually a transient
    // unload reset, not a genuine user seek. Start Over is handled explicitly.
    if(!(n<3&&lastPosition>=45))lastPosition=n;
   }
  }catch(_){}
 }
 if(!(lastDuration>0))return;
 const now=Date.now();
 // Collect the latest reading even if this event is throttled, so close
 // uses the most recent position rather than the last posted sample.
 if(!force&&now-lastPosted<6000)return;
 lastPosted=now;
 try{iina.global.postMessage('watch-progress',{path,position:lastPosition,duration:lastDuration,event:eventName||'tick',updatedAt:now});}catch(_){}
}
function doInitialSeek(){
 if(seekApplied||seekTarget===null||!Number.isFinite(seekTarget))return;
 const path=getPath();if(!path||!path.startsWith('/'))return;
 let length=0;
 try{length=iina.mpv.getNumber('duration');}catch(_){}
 if(!(length>0))return;
 seekApplied=true;
 const target=resumeMatch[1]==='restart'?0:Math.max(0,Math.min(seekTarget,length-10));
 try{iina.core.seekTo(target);}catch(_){try{iina.mpv.set('time-pos',target);}catch(__){}}
}
iina.event.on('iina.file-loaded',url=>{
 if(currentPath)sample('switch',true);
 currentPath=getPath()||String(url||'');
 lastPosted=0;lastPosition=0;lastDuration=0;seekApplied=false;
 doInitialSeek();
});
iina.event.on('mpv.file-loaded',()=>{doInitialSeek();sample('loaded',true);});
iina.event.on('mpv.time-pos.changed',()=>{doInitialSeek();sample('tick',false);});
iina.event.on('mpv.pause.changed',()=>sample('paused',true));
iina.event.on('mpv.end-file',()=>sample('ended',true));
iina.event.on('iina.window-will-close',()=>sample('closed',true));
