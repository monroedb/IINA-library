# First public beta — release checklist

## Blockers before widespread promotion

- [x] **TMDB**: added an approved official-logo URL in About & Credits, unmodified; verify that it loads on the target Mac and that TMDB terms are satisfied.
- [ ] **License**: repository owner confirms they want MIT licensing before using the provided `LICENSE`.
- [ ] **Credentials**: rotate any key previously posted in a screenshot; never publish a key, `@data` cache, logs, or personal paths.
- [ ] **Fresh Mac install**: install directly from GitHub on a second Mac / clean IINA profile, using a DIFFERENT user-provided API key.
- [ ] **Cross-platform within macOS**: test one Apple Silicon and one Intel Mac if possible; test different macOS versions supported by installed IINA.
- [ ] **Permissions**: test `~/Movies`, Desktop, external drive, nested films/series folders, and unavailable iCloud placeholders.
- [ ] **Playback**: test `.mkv` and `.mp4`, subtitle/audio switching in the native IINA window, Resume, close/reopen, and finish threshold.
- [ ] **TMDB**: valid/invalid API keys, offline use of already cached metadata, manual corrections, album art, decade sorting, TV-season loading, and throttling.
- [ ] **Privacy**: verify that no personal data, API key or watch history is committed to GitHub.
- [ ] **Cache**: simulate cached TMDB records older than 180 days, confirm they expire without erasing user-created edits/watch history; test failed network re-fetch.
- [ ] **GitHub install/update**: `ghRepo` and `ghVersion` are set; CONFIRM a clean install from GitHub on a test Mac. Increment `ghVersion` for every future update.

## Suggested first GitHub publish

1. Upload the **contents** of this folder to the root of the repository `monroedb/IINA-library` (not a ZIP file by itself).
2. On a second Mac, use IINA Settings > Plugins > Install from GitHub.
3. Fix anything reported during the beta test.
4. Publish **GitHub Releases > Draft a new release**, tag `v0.13.1` and mark **Pre-release** until verified.
5. Use community feedback for beta fixes; avoid advertising full compatibility without cross-machine tests.

Notes: IINA 1.4.0+ provides the packaging CLI. On your own Mac, use `/Applications/IINA.app/Contents/MacOS/iina-plugin pack <directory>` for a `.iinaplgz` if you want a downloadable release asset. Use the official CLI rather than renaming random ZIP files.
