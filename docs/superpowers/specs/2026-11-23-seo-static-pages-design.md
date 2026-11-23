# Emmet's Place: static, crawlable site (design)

Date: 2026-11-23

## Intent and why

emmetsplace.com is a static GitHub Pages site. `index.html` fetches `videos.json` in the browser and builds every episode card with JavaScript, so View Source shows no episode, musician or link. Search engines and AI tools therefore see an empty page. The owner wants the content to be in the static HTML the server sends, with a page per episode and per musician, proper titles and descriptions, a sitemap and `llms.txt`, a homepage intro, and a hidden writer-page template for future liner notes. The existing filters and shuffle must keep working.

## Goals

1. Every episode (numbered or full-length concert), every musician and every link appears in the HTML as served (verify: View Source on `/` contains episode titles).
2. One page per episode at a clean URL, with video, date, location, lineup and setlist.
3. One page per musician listing all their appearances, derived from episode lineups.
4. A homepage intro paragraph above the episode browser (text supplied later by the owner; placeholder until then).
5. Unique `<title>` and meta description per page, e.g. `Kurt Elling - Live From Emmet's Place Vol. 134 (2025)`.
6. `sitemap.xml` and `llms.txt` at the site root.
7. A hidden writer page template for liner-note bylines.
8. Filters, search and shuffle on the homepage keep working on top of the static HTML.

## Non-goals

- Pages for clips: videos under 30 minutes (solos, soundchecks, Masters Legacy shorts, EPKs). They stay in the data but get no pages.
- Rewriting the site's design or moving to a framework.
- Writing liner notes or real writer data.
- Rotating the YouTube API key (flagged to the owner separately; `config.js` has a key committed to a public repo).

## Anti-goals

- A build that can break the live site when `videos.json` is missing or malformed.
- Duplicate pages for one episode (re-streams) or inflated musician appearance counts.
- Guessed lineups or locations presented as fact.

## Constraints

- Hosting stays GitHub Pages serving from the branch, custom domain `emmetsplace.com` (CNAME). No Pages-from-Actions switch.
- No runtime dependencies or `node_modules`; plain Node (v20 in CI), like `fetch-videos.js`.
- Data source is `videos.json` (YouTube API output: title, duration, streamDate, description, parsed `artists` and `songs`). The existing daily workflow (`update-videos.yml`) fetches it.
- The homepage script is ~2,000 lines of inline JS in `index.html` that currently builds cards client-side.

## Approaches considered

- **A. Dependency-free Node generator, output committed (chosen).** `build-site.js` reads `videos.json` and writes HTML, sitemap and `llms.txt` into the repo; the daily workflow runs it after `fetch-videos.js` and commits the output. Smallest change to how the site runs today. Trade-off: generated files live in the repo.
- **B. Static site framework (Eleventy/Astro).** Cleaner templating, but adds a toolchain, requires switching Pages to Actions deploys, and means reworking `index.html`. Rejected as too much churn.
- **C. Build at deploy time, output not committed.** Smaller repo, but needs the same Pages switch as B and a failed build would take the site down. Rejected.

The owner picked A.

## Decisions (as agreed with the owner)

- **Episodes** are all full-length performances, 30 minutes or longer, whether or not they carry a Vol./Ep. number (owner wants non-numbered concerts such as "Emmet Cohen Quintet Celebrates Miles and Coltrane at 100 (Live at @sfjazz)" included, but not clips). Numbered ones are the Live From Emmet's Place series; the rest are concerts at other venues.
- **One page per episode number.** Where a number has several videos (original plus "Re-Stream:" uploads), the original stream is the canonical page and re-streams appear as secondary links on it. Musician appearance counts count each number once.
- **Location (numbered episodes only):** Vol. 136 and earlier: "Harlem, New York". Vol. 137 onward: "Power Station at Berklee NYC" (owner confirmed 137 was the first episode there). Location is not in the data, so this is a rule in the generator. Non-numbered concerts get no location field unless the title names one (e.g. "Live at ..."), which the builder may extract; otherwise it is omitted rather than guessed.
- **Slugs:** `/episodes/vol-134-kurt-elling/` for numbered episodes; non-numbered concerts slug from the cleaned title, e.g. `/episodes/emmet-cohen-quintet-miles-and-coltrane-at-100-sfjazz/`. Year suffix only added on a collision.
- **Titles:** numbered: `<Guest(s)> - Live From Emmet's Place Vol. N (YYYY)`; non-numbered: `<cleaned video title> (YYYY)`. Year from the stream date.
- **Homepage browser** shows only episodes as static cards. Clips are removed from it (owner: "I don't want to include clips"), so the client-side card builder goes away.
- **Episodes with no parsed lineup or setlist** render without that section instead of a guess.
- **Hidden writer page:** `noindex`, not linked from anywhere, not in the sitemap or `llms.txt`, and only generated when a writers data file exists.
- **Homepage intro:** placeholder paragraph until the owner sends the text.

## Calls I made (not yet checked by the owner)

- Directory-style URLs (`/episodes/<slug>/index.html`) so GitHub Pages serves clean addresses.
- Musician slugs derive from the name as it appears in the lineup; minor spelling variants are merged by a small alias map, which the builder can seed.
- The homepage's static cards are the source of truth; the existing JS is changed to show, hide and reorder them instead of creating them.

## Resolved after builder check

Settled from the data and project (checked against `videos.json`):

- **Episode rule:** duration of 1800s or more. Numbered if the title contains "Emmet's Place" (straight or curly apostrophe) plus a `Vol.`/`Ep.`/`Episode` number; "Masters Legacy Series Vol. N" is a different series and is never numbered (all its videos are under 10 minutes anyway). Data has a clear gap: 132 non-numbered videos are 40 min or longer and the rest are 26 min or shorter. The 26-minute "Portrait of Fats Waller" is therefore excluded; the owner can lower the threshold. (My call.)
- **Canonical video:** every numbered episode with several uploads has a non-"Re-Stream:" original, so canonical = the upload whose title lacks "Re-Stream". For non-numbered concerts, a "Re-Stream:" upload is matched to its original by normalized title; if no original exists, the re-stream becomes the page. Re-streams link from the canonical page. (My call.)
- **Musicians:** `artists` entries are clean `{name, instrument}` pairs. From canonical episodes there are 183 distinct musicians, 133 of them with a single appearance. Emmet Cohen (131), Kyle Poole (85) and Russell Hall (77) are the house trio. Every musician gets a page, so about 183 pages, many thin. Each page shows name, instruments and the appearance list. A small alias map merges spelling variants. Names containing a colon or over four words are dropped as parse noise (e.g. "Charlie Parker: Now's the Time"). (My call.)
- **`index.html` generation:** `index.html` stays hand-edited. The generator replaces only the content between marker comments (cards, intro) and never rewrites the rest. If anything fails (missing or malformed `videos.json`, zero episodes found), the build exits non-zero before writing any file, so the last good output stays live and the workflow does not commit. (My call.)
- **Stable URLs:** slugs are pinned by episode number in a committed `slugs.json`. A slug is generated once and never changes, even if the YouTube title changes. (My call.)
- **Static cards must carry the fields the JS reads:** `data-artists` (lowercased names), the card inner markup from `buildCardInner` (artists and instruments, songs), video id, title and date. The builder reads the current JS to get the full list.

## Left to the builder

- Template and CSS details for the new pages (reuse the site's existing look).
- Title-parsing rules for guest names from episode titles, and the musician alias map.
- Exact structure of structured data (e.g. JSON-LD VideoObject / MusicGroup), if any.
- Workflow changes to run the build and commit the output.
- Tests/verification approach (e.g. checking generated HTML for expected titles, a link check, and a manual filter/shuffle check in a browser).
