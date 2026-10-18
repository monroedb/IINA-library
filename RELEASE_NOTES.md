# IINA Library v0.13.0 — First public beta

IINA Library brings a visual local movie and TV collection to the IINA player on macOS.

### Features
- Browse local films and TV shows with TMDB artwork and metadata.
- Organize episodes by show and season; fix mismatched titles manually.
- Continue Watching and resume playback after closing IINA.
- Search, sort, and filter your library; keep IINA's native playback controls.
- Local cache for metadata and artwork; no media server or account required.

### Public-beta improvements
- TMDB attribution and an unchanged approved TMDB logo in **Settings & advanced tools → About & Credits**.
- TMDB's non-endorsement disclaimer remains visible in the footer.
- GitHub installation/update metadata configured in `Info.json` (`ghRepo`, `ghVersion`).
- Basic automated tests and documentation included.

### Installation
1. Install a current IINA version with plugin support (IINA 1.4 or later).
2. Open **IINA → Settings → Plugins → Install from GitHub**.
3. Enter `https://github.com/monroedb/IINA-library`.
4. Open IINA Library, add your media folder, and enter **your own** [TMDB API v3 key](https://www.themoviedb.org/settings/api).

**Manual package:** if a `.iinaplgz` file has been attached to this release, use **Install from local package**. Do not rename an ordinary ZIP to `.iinaplgz`.

### Known limitations / testing needed
- Fresh GitHub installation and updates need confirmation on another Mac before announcing full compatibility.
- macOS may require file permissions; iCloud-only files must be downloaded before playback.
- Metadata accuracy depends on names; manual TMDB corrections are available.
- The official TMDB logo is loaded from TMDB's website and requires network access; legal notice is also shown as text.

### Credits
This product uses the TMDB API but is not endorsed or certified by TMDB.
IINA Library is independent of and not endorsed by the IINA team.

Please [report issues](https://github.com/monroedb/IINA-library/issues) with your IINA version, macOS version and non-sensitive reproduction steps. Never include a TMDB API key or personal file paths.
