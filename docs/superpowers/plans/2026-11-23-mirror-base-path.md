# Base-Path Support and Old-Copy Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static-page generator work when a site is served from a sub-path, then port the generator to the old copy at `sbenediktson.github.io/emmetsplace/` so it serves the same pages under `/emmetsplace/`.

**Architecture:** A small `site/config.js` holds `siteUrl` (canonical host), `basePath` (prefix for internal links) and `feeds` (whether to write `sitemap.xml` and `llms.txt`). `build-site.js` reads an optional `site.config.json` from the root it builds. Defaults (`https://emmetsplace.com`, `""`, `true`) reproduce today's output byte-for-byte. The old copy gets its own copy of the generator with `basePath: "/emmetsplace"` and `feeds: false`.

**Tech Stack:** Node 20 (CI), built-in `node:test`, plain HTML. No dependencies.

**Spec:** the design agreed in conversation on 2026-11-23, summarised here: canonical URLs (`<link rel="canonical">`, `og:url`) always point at `siteUrl` + the page's path **without** `basePath`; every internal `href`/`src` is prefixed with `basePath`; sitemap and `llms.txt` are skipped when `feeds` is false; the main site's generated output must not change. Builds on `docs/superpowers/specs/2026-11-23-seo-static-pages-design.md`.

## Global Constraints

- No runtime dependencies and no `node_modules`; Node 20. Test command: `node --test` (no path; Node 25 rejects `node --test test/`).
- Defaults must reproduce the current output exactly: after Task 1, `node build-site.js` in this repo leaves `git status` clean.
- Canonical and `og:url` use `siteUrl` + path without `basePath`. Internal links, the `page.css` link and the home link use `basePath` + path. `videos.json` is fetched relatively by `index.html` and must keep working under a sub-path.
- Old copy: `basePath` is `/emmetsplace`, `siteUrl` is `https://emmetsplace.com`, `feeds` is `false`. No `sitemap.xml` or `llms.txt` there.
- Commits end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing is pushed in either repo; the controller asks the owner first.
- In the old copy repo (`/Users/sam.benediktson/Documents/code/sbenediktson.github.io`, branch `master`) only `git add` explicit paths under `emmetsplace/` and `.github/workflows/update-videos.yml`; never `git add -A` (the repo has an untracked `LFEP Short Clips/` folder and a modified `.DS_Store`). Do not use or print its git remote URL.

## Review Focus

- A sub-path build must not contain any root-relative internal link (`href="/episodes/`, `href="/musicians/`, `href="/page.css"`, `href="/"`) in pages, homepage cards or the intro; canonical/og:url must still be `https://emmetsplace.com/...`. Task 1.
- A malformed or unknown `site.config.json` (basePath without a leading slash, with a trailing slash, with `..`, or `siteUrl` with a trailing slash) must fail the build before anything is written. Task 1.
- Defaults unchanged: existing tests pass without edits and regenerated output is identical. Task 1.
- In the old copy, the daily workflow must run the build with `working-directory: emmetsplace` and stage only generated paths under `emmetsplace/`. Task 2.

---

### Task 1: Configurable base path, site URL and feeds

**Files:**
- Create: `site/config.js`, `test/config.test.js`
- Modify: `site/html.js`, `site/pages.js`, `site/home.js`, `site/feeds.js`, `build-site.js`, existing tests only where an import of `SITE_URL` must change

**Interfaces:**
- Produces:
  - `site/config.js`: `DEFAULTS = { siteUrl: 'https://emmetsplace.com', basePath: '', feeds: true }`; `setConfig(partial?: object): void` validates and merges onto `DEFAULTS` (throws `Error` with a clear message for: non-string values, `siteUrl` not starting with `https://` or ending with `/`, `basePath` not `""` and not matching `^/[a-z0-9._-]+(/[a-z0-9._-]+)*$` (so no trailing slash, no `..` segments), `feeds` not boolean, unknown keys); `getConfig(): { siteUrl, basePath, feeds }`; `resetConfig(): void`.
  - `site/html.js` keeps exporting `esc` and drops the `SITE_URL` constant; callers use `getConfig().siteUrl` instead (update `site/feeds.js`, `site/pages.js`, `build-site.js` and any test that imports `SITE_URL`).
  - `site/pages.js`: `episodeUrl(slug)` and `musicianUrl(slug)` keep returning the root-relative path WITHOUT `basePath` (used for canonical and feeds); add `link(path: string): string` = `getConfig().basePath + path`, used for every internal `href`/`src` (`page.css`, home link, episode/musician/prev/next/lineup/appearance links).
  - `site/home.js`: card hrefs use the same prefixing (`/episodes/<slug>/` becomes `basePath + ...`).
  - `build-site.js`: `buildSite({ root })` reads optional `<root>/site.config.json`, calls `resetConfig()` then `setConfig(parsed)` before rendering; when `feeds` is false it adds neither `sitemap.xml` nor `llms.txt` to the output map; a bad config throws before any write.

- [ ] **Step 1: Write failing tests** in `test/config.test.js`: `getConfig()` defaults; `setConfig({basePath:'/emmetsplace'})` accepted; rejected with a clear message: `{basePath:'emmetsplace'}`, `{basePath:'/emmetsplace/'}`, `{basePath:'/../x'}`, `{siteUrl:'http://x'}`, `{siteUrl:'https://x/'}`, `{feeds:'no'}`, `{bogus:1}`. Add to `test/pages.test.js`, `test/home.test.js` and `test/build.test.js` (via a temp root with `site.config.json` `{ "basePath": "/emmetsplace", "feeds": false }`): episode page has `href="/emmetsplace/page.css"`, `href="/emmetsplace/"`, lineup links `href="/emmetsplace/musicians/..."`, prev/next links prefixed, while `<link rel="canonical">` and `og:url` equal `https://emmetsplace.com/episodes/<slug>/`; homepage cards use `/emmetsplace/episodes/<slug>/`; no output contains `href="/episodes/`, `href="/musicians/`, `href="/page.css"`; the output map has no `sitemap.xml` or `llms.txt`; a temp root with an invalid config makes the CLI exit 1 with the temp tree byte-identical.
- [ ] **Step 2: Run** `node --test`. Expected: the new tests FAIL, existing 82 pass.
- [ ] **Step 3: Implement** `site/config.js` and thread it through the modules listed above. Do not change behaviour for default config. Reset config at the start of every `buildSite` call so tests stay isolated.
- [ ] **Step 4: Run** `node --test`. Expected: all PASS (82 existing unchanged plus the new ones).
- [ ] **Step 5: Prove defaults are unchanged:** `node build-site.js` in this repo, then `git status --porcelain` must be empty.
- [ ] **Step 6: Commit** `git add site build-site.js test && git commit -m "feat: configurable base path, site URL and feeds"` (with the Co-Authored-By trailer).

### Task 2: Port to the old copy

**Files (in `/Users/sam.benediktson/Documents/code/sbenediktson.github.io`):**
- Create under `emmetsplace/`: `site/` (all files), `build-site.js`, `page.css`, `content/home-intro.html`, `site.config.json` (`{ "basePath": "/emmetsplace", "feeds": false }`), `test/` (all tests and fixtures), generated `episodes/`, `musicians/`, `slugs.json`
- Modify: `emmetsplace/index.html`, `.github/workflows/update-videos.yml`

**Interfaces:**
- Consumes: Task 1's committed generator files from `/Users/sam.benediktson/Documents/code/emmetsplace-site` (copy them verbatim from that repo's `feat/base-path` HEAD).

- [ ] **Step 1: Copy** the generator files listed above from the main repo into `emmetsplace/`. Replace `emmetsplace/index.html` with the main repo's `index.html` EXCEPT that its generated card content between the `build:cards` markers is emptied and its `build:intro` content is emptied (the old copy's own build fills them). Before replacing, confirm the old `emmetsplace/index.html` is identical to the main repo's pre-change `index.html` (`git -C <main repo> show b01c08d:index.html`); if not, STOP and report the differences. Keep the old copy's `videos.json` (it is newer; do not overwrite it) and `CNAME`/`clips` untouched. Audit the copied `index.html` script for root-relative URLs outside the cards (`fetch("/`, `src="/`, `href="/`); report any, fix by prefixing nothing (they must stay relative) or report BLOCKED.
- [ ] **Step 2: Run the copied tests:** `cd emmetsplace && node --test`. Expected: all PASS.
- [ ] **Step 3: Build:** `cd emmetsplace && node build-site.js`, then again (second run changes nothing: check with `git status --porcelain -- emmetsplace` before/after). Verify: `ls episodes | wc -l`, `ls musicians | wc -l`, no `sitemap.xml`/`llms.txt` exist, `grep -rl 'href="/episodes/' emmetsplace` empty (no root-relative internal links), every generated page has canonical `https://emmetsplace.com/...` (`grep -L 'rel="canonical" href="https://emmetsplace.com/' emmetsplace/episodes/*/index.html` empty), `grep -rc undefined` over episodes/musicians is all zero, and `index.html` contains an episode title.
- [ ] **Step 4: Serve and check:** from `/Users/sam.benediktson/Documents/code/sbenediktson.github.io` run `python3 -m http.server <free port>` in the background (if the sandbox refuses, report it instead of working around); `curl` that `/emmetsplace/`, `/emmetsplace/episodes/<a slug>/`, `/emmetsplace/musicians/<a slug>/` and `/emmetsplace/page.css` return 200 and that the episode page's `page.css` link is `/emmetsplace/page.css`; stop the server afterwards.
- [ ] **Step 5: Workflow:** in `.github/workflows/update-videos.yml` add after "Fetch videos" a step `Build site` with `run: node build-site.js` and `working-directory: emmetsplace`; change the commit step to stage, for each of `emmetsplace/videos.json emmetsplace/slugs.json emmetsplace/index.html emmetsplace/episodes emmetsplace/musicians emmetsplace/writers`, only paths that exist (`[ -e "$p" ] && git add -A -- "$p"`), commit message `chore: update videos.json and generated pages`, keep `git pull --rebase && git push`. Validate the YAML parses (ruby `YAML.load_file` is available).
- [ ] **Step 6: Commit** on `master` with explicit paths only: `git add emmetsplace/site emmetsplace/build-site.js emmetsplace/page.css emmetsplace/content emmetsplace/site.config.json emmetsplace/test emmetsplace/index.html .github/workflows/update-videos.yml` then commit `feat: static pages generator for emmetsplace (sub-path)`. That commit includes `index.html` with EMPTY marker content (stage it before running the build, or `git add` the empty-marker version before step 3's output lands; simplest: commit the generator files first, then build, then commit output). A second commit `chore: generate static pages` stages the regenerated `emmetsplace/index.html`, `emmetsplace/episodes`, `emmetsplace/musicians`, `emmetsplace/slugs.json`. Do not stage `.DS_Store`, `LFEP Short Clips/` or `emmetsplace/backfill-descriptions.js`. Do not push.
