# IINA Library

A local movie & TV library for [IINA](https://iina.io/) on macOS. Browse posters, filter titles, organize seasons and episodes, edit TMDB matches, and resume video in IINA's native player.

**Public beta candidate · Version 0.13.0** — please test on more than one Mac before announcing a stable release.

## Features

- Movie and TV catalogs from one or more local folders (including subfolders)
- Automatic movie and TV show recognition with manual TMDB correction
- Posters, overviews, release years, ratings, and season/episode details (cached on your Mac)
- Continue Watching, individual episode progress, and Resume
- Fast sorting/search; native IINA player handles subtitles and audio controls
- Dark UI with the macOS system font (San Francisco)
- No accounts, telemetry, or external media server

## Requirements

- **macOS** with a current version of **IINA 1.4+** (1.5 recommended)
- Internet access for first-time TMDB metadata requests
- Your own **TMDB API v3 key** to load posters and summaries: [request a free key](https://www.themoviedb.org/settings/api). TMDB's non-commercial usage and attribution terms apply.
- Media in readable folders; macOS may ask for Desktop, Documents, external-drive, or iCloud permissions

## Install

**Recommended (GitHub):** In IINA open **Settings > Plugins > Install from GitHub** and enter:

`https://github.com/monroedb/IINA-library`

IINA can install from this GitHub repository and offer updates. **For the initial beta, check that installation works on a Mac that did not previously have IINA Library installed.**

**Manual:** IINA can open a `.iinaplgz` created with its official `iina-plugin pack` utility, or load an `.iinaplugin` folder copied into:

`~/Library/Application Support/com.colliderli.iina/plugins`

Do not install two versions with the same plugin identifier side by side.

## First run

1. Open IINA Library from IINA.
2. Add a folder containing your movies and TV series (e.g. `Movies/films` and `Movies/series`).
3. Expand **Settings & advanced tools > TMDB metadata**, enter *your own* TMDB API v3 key and save it.
4. Select **Refresh metadata & artwork**. Match incorrectly identified items in the movie/show details.
5. Click the play icon to open the file in IINA. Close it, then use **Continue Watching > Resume**.

Files visible only through iCloud may be listed but must be downloaded in Finder before playback. For remote/NAS shares or unusual layouts, see [Testing & release checklist](RELEASE_CHECKLIST.md).

## Privacy and data

Video files are not uploaded by this plugin. To retrieve metadata, it sends movie/show search titles and your TMDB key to `api.themoviedb.org`; artwork comes from `image.tmdb.org`. The plugin scans only directories you choose. TMDB credentials, folder paths, cached posters, manual matches, and watch history are stored in the plugin's local `@data/` directory; **do not commit or share that directory**. The key is stored as local plaintext, not in the macOS Keychain.

Cached TMDB details and artwork are removed after a conservative 180-day retention window when the plugin runs, to comply with TMDB's six-month maximum; they can be retrieved again with the user's key. Manual local edits and playback progress remain untouched.

## Attribution and trademarks

This product uses the TMDB API but is not endorsed or certified by TMDB.

**Before a public announcement:** add an [approved TMDB logo](https://www.themoviedb.org/about/logos-attribution) to the plugin UI in an About/Credits or footer area. The current footer provides text attribution but is **not yet complete** under TMDB's branding policy. Do not use an invented or altered logo.

IINA is a separate project, available under the GPL-3.0 license. This plugin is independent of and not endorsed by the IINA developers. TMDB artwork and trademarks are not covered by this project's source-code license.

## Contributing and bugs

Please file [GitHub issues](https://github.com/monroedb/IINA-library/issues) with your macOS and IINA versions, folder structure (without identifying paths), and reproduction steps. Never post TMDB API keys or personal folder paths in screenshots or logs.

## License

The source code in this repository is offered under the [MIT License](LICENSE), subject to confirmation by the repository owner. Third-party IINA and TMDB assets are excluded.
