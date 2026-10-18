'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'library.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Info.json'), 'utf8'));

const officialLogo = 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg';
assert.ok(html.includes('<section class="settings-card tmdb-credits" id="about-credits"'));
assert.ok(html.includes(`src="${officialLogo}"`), 'Approved TMDB logo URL must stay unchanged');
assert.ok(html.includes('class="tmdb-credits-logo"'), 'Show logo in Credits');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'));
assert.ok(html.includes('https://www.themoviedb.org/'));
assert.ok(config.allowedDomains.includes('www.themoviedb.org'));
assert.equal(config.ghRepo, 'monroedb/IINA-library');
assert.equal(config.ghVersion, 14);
console.log('PASS: TMDB Credits contain unmodified official-logo URL, disclaimer, and domain permission');
