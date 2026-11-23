# Emmet's Place Static Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate crawlable static HTML (episode pages, musician pages, pre-rendered homepage cards, sitemap, `llms.txt`, hidden writer template) from `videos.json`, without breaking the homepage's filters, search, tunes and shuffle.

**Architecture:** A dependency-free Node generator (`build-site.js` + small modules in `site/`) reads `videos.json`, computes every output in memory, and only then writes files. The generated files are committed, so GitHub Pages keeps serving from the branch. `index.html` stays hand-edited; the generator replaces only the content between marker comments. The homepage script adopts the pre-rendered cards instead of building them.

**Tech Stack:** Node 20 (CI version), built-in `node:test` and `node:assert`, plain HTML/CSS. No `node_modules`.

**Spec:** `docs/superpowers/specs/2026-11-23-seo-static-pages-design.md`

## Global Constraints

- No runtime dependencies and no `node_modules`; plain Node 20 (CI uses `node-version: "20"`).
- Hosting stays GitHub Pages from the branch with custom domain `emmetsplace.com` (`CNAME`). Absolute URLs use `https://emmetsplace.com`.
- Episode = any video with `duration >= 1800` seconds. Numbered if the title contains "Emmet's Place" (straight or curly apostrophe) plus `Vol.`/`Ep.`/`Episode` followed by a number; "Masters Legacy Series Vol. N" is never numbered.
- One page per episode. Canonical = the upload whose title lacks "Re-Stream"; re-streams are listed on the canonical page. Non-numbered re-streams match their original by normalized title (title minus `Re-Stream:` prefix, lowercased); with no original, the re-stream is the page.
- Location, numbered episodes only: Vol. 136 and earlier "Harlem, New York"; Vol. 137 onward "Power Station at Berklee NYC". Non-numbered concerts get no location. Never guess.
- Slugs: `/episodes/vol-134-kurt-elling/` (numbered), cleaned-title slug for non-numbered, year suffix only on collision. Pinned in a committed `slugs.json`; never changed once written.
- Page titles: numbered `<Guest(s)> - Live From Emmet's Place Vol. N (YYYY)`; non-numbered `<cleaned video title> (YYYY)`; year from `streamDate`.
- Episodes without parsed lineup or setlist render without that section. Musician pages: every musician with at least one appearance on a canonical episode; each episode counts once.
- A failed build (missing or malformed `videos.json`, zero episodes) exits non-zero before writing any file.
- Hidden writer page: `noindex`, never linked, not in `sitemap.xml` or `llms.txt`, only generated if `content/writers.json` exists.
- The homepage intro text lives in `content/home-intro.html` (marker content is overwritten on every build); placeholder text until the owner sends the real text.

## Review Focus

- HTML-special characters in titles, names and descriptions (`&`, `<`, `"`, curly quotes, emoji) must be escaped and must not break attributes or JSON. Tests in Tasks 4 and 5.
- Accented names ("Cyrille Aimée") must slug to ASCII without collisions or empty slugs. Task 2.
- Two episodes producing the same slug (same guests, different Vol. or concert title) must get distinct, stable slugs. Task 2.
- Episode with missing `streamDate`, empty `artists`, empty `songs` or empty description: page still renders, title omits the year, no empty sections or `undefined` text. Tasks 1 and 4.
- Parse-noise artist names (colon, over four words, empty) must never become musician pages. Task 3.
- Build must not delete or overwrite hand-written content in `index.html` outside the markers, and must be idempotent (second run changes no files). Tasks 5 and 7.

---

## File Structure

- `site/episodes.js`: episode selection, numbering, re-stream folding, location, titles.
- `site/slugs.js`: slugify, pinned slug allocation.
- `site/musicians.js`: musician aggregation.
- `site/html.js`: `esc()` plus shared head/layout helpers.
- `site/pages.js`: episode, musician and writer page HTML.
- `site/home.js`: homepage cards, quarter headers, marker replacement.
- `site/feeds.js`: `sitemap.xml` and `llms.txt` text.
- `build-site.js`: orchestration, fail-safe write.
- `page.css`: shared stylesheet for the new pages.
- `test/*.test.js` and `test/fixtures/videos.sample.json`: tests (`node --test test/`).
- Modify: `index.html` (markers, head meta, script), `.github/workflows/update-videos.yml`.
- Create content: `content/home-intro.html`, `slugs.json` (generated).

---

### Task 1: Episode selection

**Files:**
- Create: `site/episodes.js`, `test/fixtures/videos.sample.json`, `test/episodes.test.js`

**Interfaces:**
- Produces:
  - `selectEpisodes(data: Record<string, Video>): Episode[]`, sorted by `streamDate` descending. `Video` is the `videos.json` `data` entry shape (`title, duration, isLive, streamDate, description, artists, songs`).
  - `Episode = { id, title, number: number|null, guests: string|null, streamDate: string|null, year: number|null, duration: number, location: string|null, artists: {name, instrument}[], songs: {title, start}[], description: string, restreams: {id, title}[] }`
  - `pageTitle(ep: Episode): string`

- [ ] **Step 1: Write the fixture and failing tests.** The fixture is a small hand-made `data` object covering: a numbered original plus its "Re-Stream:" copy (Vol. 134 - Kurt Elling); an `Ep. 137` style title; a "Masters Legacy Series Vol. 4" 9-minute clip; a 26-minute video; a non-numbered concert with a "Re-Stream:" copy ("Emmet Cohen Quintet Celebrates Miles and Coltrane at 100 (Live at @sfjazz)"); a non-numbered re-stream with no original; a numbered episode with empty artists/songs and a null `streamDate`. Tests:
  - `selects only duration >= 1800`: Masters Legacy and the 26-minute video are absent.
  - `folds re-streams into canonical`: Vol. 134 appears once, its `restreams` holds the re-stream id; the non-numbered concert likewise.
  - `re-stream without original becomes the page`.
  - `number parsing`: Vol. 134 → 134, `(Ep. 137)` → 137, concert → null, Masters Legacy → null (and excluded).
  - `location`: 136 → "Harlem, New York", 137 → "Power Station at Berklee NYC", concert → null.
  - `pageTitle`: Vol. 134 with a 2025 stream date → `Kurt Elling - Live From Emmet's Place Vol. 134 (2025)`; concert → `<title> (YYYY)`; null `streamDate` → no parenthesised year and no "undefined".
  - `sorted newest first`.
- [ ] **Step 2: Run** `node --test test/episodes.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `selectEpisodes` and `pageTitle` in `site/episodes.js`. Guests = text after `Vol. N - ` (trimmed, emoji stripped); when absent, strip the `Vol.`/`(Ep. N)` tokens from the title and use what remains in `pageTitle`. If two numbered originals share a number (not present today), the earliest `streamDate` wins.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `git add site/episodes.js test && git commit -m "feat: select episodes from videos.json"`

### Task 2: Slugs

**Files:**
- Create: `site/slugs.js`, `test/slugs.test.js`

**Interfaces:**
- Consumes: `Episode` from Task 1.
- Produces:
  - `slugify(text: string): string`: lowercase ASCII, diacritics folded, non-alphanumerics to single hyphens, trimmed; never returns an empty string (falls back to `"untitled"`).
  - `episodeSlugBase(ep: Episode): string`: `vol-134-kurt-elling` for numbered (`vol-N` alone if no guests); `slugify(cleaned title)` for non-numbered.
  - `allocateSlugs(items: {key: string, base: string}[], pinned: Record<string,string>): Record<string,string>`: returns `key → slug`. A key already in `pinned` keeps its slug. Otherwise `base`, or `base-2`, `base-3` on collision with any pinned or allocated slug. Returned map includes the pinned entries.

- [ ] **Step 1: Write failing tests:** `slugify("Cyrille Aimée")` → `cyrille-aimee`; `slugify("Béla Fleck & Friends!")` → `bela-fleck-friends`; `slugify("😀")` → `untitled`; `episodeSlugBase` for Vol. 134 → `vol-134-kurt-elling`; `allocateSlugs` keeps a pinned slug even if its base would now differ; two items with the same base get `x` and `x-2`; a new item colliding with a pinned slug gets `-2`; running twice with the first result as `pinned` returns identical output.
- [ ] **Step 2: Run** `node --test test/slugs.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `site/slugs.js` (use `String.prototype.normalize("NFKD")` and strip combining marks).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: slug allocation with pinned slugs"`

### Task 3: Musicians

**Files:**
- Create: `site/musicians.js`, `test/musicians.test.js`

**Interfaces:**
- Consumes: `Episode[]` (Task 1), `slugify`/`allocateSlugs` (Task 2).
- Produces:
  - `MUSICIAN_ALIASES: Record<string,string>` (variant name → canonical name; starts empty in code, seeded in the test).
  - `isNoiseName(name: string): boolean`: true for empty names, names containing `:`, `@`, `http`, or more than 4 words.
  - `collectMusicians(episodes: Episode[], aliases = MUSICIAN_ALIASES): Musician[]` where `Musician = { name, instruments: string[], appearances: Episode[] }`, appearances newest first, one entry per episode even if the name is listed twice in a lineup, sorted by appearance count desc then name.

- [ ] **Step 1: Write failing tests:** noise names ("Charlie Parker: Now's the Time", "") are dropped; an alias merges "Joe Farnsworth Jr." into "Joe Farnsworth"; a musician listed twice in one episode counts once; instruments are deduplicated and kept in first-seen order; ordering by count then name.
- [ ] **Step 2: Run** `node --test test/musicians.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `site/musicians.js`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: aggregate musicians from lineups"`

### Task 4: Page templates (episode, musician, writer)

**Files:**
- Create: `site/html.js`, `site/pages.js`, `page.css`, `test/pages.test.js`

**Interfaces:**
- Consumes: `Episode`, `Musician`, slug maps (`Record<string,string>` from `allocateSlugs`).
- Produces:
  - `esc(s: string): string`: escapes `& < > " '`.
  - `renderEpisodePage(ep: Episode, ctx: { slugs: Record<string,string>, musicianSlugs: Record<string,string>, prev?: Episode, next?: Episode }): string`: full HTML document.
  - `renderMusicianPage(m: Musician, ctx): string`.
  - `renderWriterPage(w: { slug, name, bio?: string, episodeIds: string[] }, episodes: Episode[], ctx): string`.
  - `episodeUrl(slug)` → `/episodes/<slug>/`; `musicianUrl(slug)` → `/musicians/<slug>/`.

Requirements for the output (the tests check them):
- Every page has `<title>` (the page title), `<meta name="description">` (150-160 chars, built from the lineup, date and location, with a fallback when there is no lineup), `<link rel="canonical">` with the absolute URL, and Open Graph title/description/URL.
- Episode page: YouTube embed (`youtube.com/embed/<id>`), a plain link to the YouTube watch URL, human-readable date, location when known, lineup linking each musician to their page, setlist where each song links to `https://www.youtube.com/watch?v=<id>&t=<start>`, re-stream links, prev/next links, link back to `/`.
- Musician page: name, instruments, list of appearances linking to episode pages.
- Writer page: `<meta name="robots" content="noindex,nofollow">`, name, bio, linked list of their episodes. No other page links to it.
- Pages link to `/page.css`; the page looks like the site (dark theme, same fonts and colours as `index.html`'s `:root`/body styles).

- [ ] **Step 1: Write failing tests** (string assertions on the output): episode page contains the exact title `Kurt Elling - Live From Emmet's Place Vol. 134 (2025)` (HTML-escaped in `<title>`), a canonical of `https://emmetsplace.com/episodes/vol-134-kurt-elling/`, the embed URL, a song link with `&t=` seconds, and "Harlem, New York"; an episode with empty artists/songs/null date has no "Lineup" or "Setlist" heading and no "undefined"; a title containing `<script>&"` is escaped everywhere it appears (title, description, JSON text, attributes); the description meta is at most 160 characters; the musician page lists each appearance once; the writer page contains `noindex` and no other page output contains `writers/`.
- [ ] **Step 2: Run** `node --test test/pages.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `site/html.js`, `site/pages.js`, and `page.css` (copy the colour variables and fonts from `index.html`; keep it under ~150 lines).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: episode, musician and writer page templates"`

### Task 5: Homepage cards and markers

**Files:**
- Create: `site/home.js`, `content/home-intro.html`, `test/home.test.js`
- Modify: `index.html` (markers and head only; the script changes are Task 6)

**Interfaces:**
- Consumes: `Episode[]`, slug map, `esc`.
- Produces:
  - `stripEmoji(s: string): string` and `cardType(ep: Episode): "studio"|"road"|"other"`, ported from `index.html` (`studio` if the title matches `/\b(vol|ep)\b/i` or the id is `mX912vvfmdo`; else `road` if it matches `/live at/i`; else `other`).
  - `renderCards(episodes: Episode[], slugs): string`: the grid content. Must reproduce the structure `index.html` currently builds at lines ~1836-1880 so the existing CSS, search and filters keep working: `.episode-year-header` divs (`id="eqsec-YYYY-MM"`, `data-year`, classes `tune-section-header episode-year-header` plus `year-start` on the first header of each year, text = year for year-start and the quarter text otherwise) inserted whenever the quarter changes, then `.video-card` divs with `data-type`, `data-id`, `data-titles`, `data-artists`, thumbnail link, `h2 > a.title-link`, `.stream-date`, and the collapsible lineup/setlist block with the `Show more` button (setlist overflow after 6 songs as in `buildCardInner`).
  - Difference from today (deliberate): the thumbnail and title anchors get a real `href` (the episode page) and keep `onclick="playInHero(...);return false;"`; song links get a real `href` (`https://www.youtube.com/watch?v=<id>&t=<start>`) and keep their `onclick`.
  - `replaceBetweenMarkers(html: string, name: string, content: string): string`: replaces the text between `<!-- build:NAME:start -->` and `<!-- build:NAME:end -->`; throws if either marker is missing or appears more than once.
- `index.html` gets markers `cards` (inside `<div class="video-grid" id="grid">`) and `intro` (first child of `#episodes-view`, above the grid), a real `<title>`, `<meta name="description">` and `<link rel="canonical" href="https://emmetsplace.com/">` in `<head>`. The intro marker's content is the contents of `content/home-intro.html` (placeholder: one plain sentence describing Emmet's Place as a jazz livestream series hosted by Emmet Cohen; marked as placeholder in an HTML comment).

- [ ] **Step 1: Write failing tests:** `cardType` for "Live From Emmet's Place Vol. 134 - Kurt Elling" → studio, "Emmet Cohen Trio - Live at Birdland 2023" → road, "Emmet Cohen Trio feat. Houston Person" → other; `renderCards` for the fixture episodes contains the episode title text, one `.episode-year-header` per quarter change with `year-start` only on the first of each year, `data-artists` lowercased and space-joined, songs after the sixth inside `id="more-<id>"`; an apostrophe or `&` in a title is escaped in text and in `data-text`; `replaceBetweenMarkers` leaves everything outside the markers byte-identical, is idempotent, and throws on a missing marker.
- [ ] **Step 2: Run** `node --test test/home.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `site/home.js`. Add the markers, head tags and intro file to `index.html`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: static homepage cards with marker replacement"`

### Task 6: Homepage script adopts static cards

**Files:**
- Modify: `index.html` (`render()` and `loadData()` region, ~lines 1575-1896; `clearSearch`/search handler only if needed)

**Interfaces:**
- Consumes: the static markup from Task 5 (`#grid .video-card[data-id]`, `.episode-year-header`).
- Produces: unchanged globals the rest of the script uses (`allCards`, `allTunes`, `allVideoData`, `episodeYearPositions`, `activeFilter`).

Behavior to implement:
- `render()` no longer clears `#grid` or builds cards. It collects `allCards = [...grid.querySelectorAll(".video-card")]`, still fetches `videos.json`, takes the episode id list from the cards' `data-id` (DOM order, newest first), and builds `allTunes` from `videoData[id].songs` for those ids exactly as today (including `isNonSong`). The hero, live/upcoming embed, quarter-position computation, tunes tab and shuffle continue to use the fetched data.
- If the fetch fails the cards stay visible and the page remains usable (tunes and shuffle show their existing empty states); the "Failed to load videos" message must not replace the grid.
- `passesFilter` is deleted; the generator's episode rule is now the only definition. The latest-episode hero fallback uses the first card's `data-id`.

- [ ] **Step 1: Run the generator output through the old and new script.** Build once (Task 7 provides the full builder; until then use `node -e` with `renderCards` on the real `videos.json` to write the marker content) and open `index.html` via `python3 -m http.server`.
- [ ] **Step 2: Modify `render()`** per the behavior above; remove the card-building loop and the now-unused `buildCardInner` only if nothing else references it (`grep` first; `renderTunes` does not use it).
- [ ] **Step 3: Verify in a browser** (use the `run` skill or claude-in-chrome); each must hold: (a) View Source of `/` contains "Kurt Elling" and the intro text; (b) "In Studio", "On the Road" and "All" pills show/hide cards and the quarter index on the right updates; (c) typing "Kurt" in search highlights matches and clearing restores the cards; (d) the Show more button expands a card and song links start the hero video at the right timestamp; (e) the Tunes tab lists tunes and the Random tab's Randomize button plays a tune; (f) with `videos.json` blocked in devtools the cards still render; (g) no console errors.
- [ ] **Step 4: Commit** `git commit -m "feat: homepage script adopts pre-rendered cards"`

### Task 7: Sitemap, llms.txt and the build orchestrator

**Files:**
- Create: `site/feeds.js`, `build-site.js`, `test/feeds.test.js`, `test/build.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `renderSitemap(urls: {loc: string, lastmod?: string}[]): string`: valid `urlset` XML, absolute `https://emmetsplace.com` URLs, XML-escaped.
  - `renderLlmsTxt(episodes: Episode[], musicians: Musician[], slugs): string`: Markdown: `# Emmet's Place`, a short plain-language summary, `## Episodes` list (title, URL, date), `## Musicians` list (name, URL, appearance count), pointer to `/sitemap.xml`.
  - `buildSite(opts: { root: string, dryRun?: boolean }): { files: Map<string,string> }`: reads `<root>/videos.json`, `<root>/slugs.json`, optional `<root>/content/writers.json`, and `<root>/index.html`; returns every output file (path relative to root → content) without writing. The CLI (`node build-site.js`) writes them, updates `slugs.json`, and removes previously generated `episodes/*` and `musicians/*` directories no longer in the output (only directories whose `index.html` contains the `<!-- generated by build-site.js -->` comment).
  - Home URL, every episode and musician page are in the sitemap with `lastmod` from the episode `streamDate` date part (musician: its newest episode); the writer page is not.

- [ ] **Step 1: Write failing tests:** sitemap output parses as XML-ish (starts with `<?xml`, one `<url>` per input, `&` escaped); `llms.txt` contains every episode URL and no writer URL; `buildSite` against a temp dir with the fixture returns `index.html` with the marker content replaced, one `episodes/<slug>/index.html` per episode, `sitemap.xml`, `llms.txt`; running it twice with the written `slugs.json` returns identical files; malformed `videos.json`, a missing `videos.json`, or zero episodes makes the CLI exit non-zero and leaves the temp dir byte-identical; with `content/writers.json` present a writer page appears under `/writers/<slug>/` and in no sitemap/llms/other page; a generated directory that is no longer in the output is removed while a hand-written directory without the generated comment is left alone.
- [ ] **Step 2: Run** `node --test test/`. Expected: FAIL.
- [ ] **Step 3: Implement** `site/feeds.js` and `build-site.js` (all outputs computed in memory first; write only after everything succeeded; exit code 1 with a clear message on any failure).
- [ ] **Step 4: Run** `node --test test/`. Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: sitemap, llms.txt and build orchestrator"`

### Task 8: Workflow, first build and verification

**Files:**
- Modify: `.github/workflows/update-videos.yml`
- Generated and committed: `episodes/`, `musicians/`, `sitemap.xml`, `llms.txt`, `slugs.json`, updated `index.html`

- [ ] **Step 1: Add a step** after "Fetch videos" in `update-videos.yml`: `run: node build-site.js`. Extend the commit step to `git add videos.json slugs.json index.html sitemap.xml llms.txt episodes musicians writers` (only paths that exist; use `git add -A -- <paths>` so a missing `writers` directory does not fail it). Do not change `check-live.yml` (it only updates `liveVideoId`, which the page reads client-side).
- [ ] **Step 2: Run** `node build-site.js` on the real data, then `node build-site.js` again. Expected: second run changes no files (`git status` shows nothing new after committing the first run).
- [ ] **Step 3: Verify the outputs** with commands and report the numbers in the commit message: `ls episodes | wc -l` (about 260), `ls musicians | wc -l` (about 183), `grep -c "<url>" sitemap.xml`, `grep -l "Kurt Elling" index.html episodes/*/index.html | head`, `grep -R "noindex" -l .` (empty unless writers exist), `grep -c "undefined" -r episodes musicians | grep -v ":0"` (empty). Spot-check three generated pages in a browser for layout on a phone-width window.
- [ ] **Step 4: Commit and report** `git add -A && git commit -m "feat: generate static pages, sitemap and llms.txt"`. Tell the owner about the open items: placeholder intro text in `content/home-intro.html`, the committed API key in `config.js`, and the `robots.txt` that was not requested.
