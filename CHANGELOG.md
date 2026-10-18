# Changelog

## 0.13.1 — UI and artwork refresh fixes

- TV Shows and All counters now display distinct titles rather than video-file counts.
- Simplified Settings; moved maintenance controls into Advanced options.
- Removed the old English metadata migration button from the public interface.
- Fixed the poster download/UI race that could require an IINA restart before showing newly cached artwork.
- Refresh now rescans folders and retries missing TMDB artwork when configured.
- No change to local watch history, manual TMDB matches, or video playback.

## 0.13.0 (public beta candidate)

- Prepared GitHub-installable repository manifest (`ghRepo` and `ghVersion`).
- Added a conservative six-month TMDB cache expiration policy (180 days).
- Added setup, privacy, contributor and pre-release guidance.
- Preserved existing plugin identifier and on-disk watch progress / manual corrections.
- Did **not** change the library design or native video player behaviour.

## 0.12 (private working version)

- Protected last known playback position on IINA window close.
- Persistent Continue Watching and Resume; existing library UI and filters.

## v0.13.0 — Public beta readiness

- Add TMDB official logo and attribution in About & Credits.
- Configure GitHub plugin installation and auto-update metadata.
- Add improved README, screenshot and release notes.
