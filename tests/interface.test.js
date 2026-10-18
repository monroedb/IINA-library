const assert=require('assert'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../library.html'),'utf8');
assert(html.includes('new Set(matchingItems.map(f=>isSeries(f)?f.mediaKey:f.path)).size'),'tabs count distinct TV shows');
assert(!html.includes('id="refresh-english"'),'migration-only English button removed');
assert(html.includes('class="settings-advanced"'),'advanced controls collapsed');
assert(html.includes('iina.onMessage(\'poster-ready\''),'UI listens for downloads completing');
assert(html.includes('retryMissingPosters();send(\'enrich\')'),'retry after refresh metadata');
console.log('PASS: title count, compact Settings and immediate artwork updates');
