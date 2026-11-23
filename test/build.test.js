const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { selectEpisodes } = require('../site/episodes');
const { buildSite, writeSite } = require('../build-site');

const REPO = path.join(__dirname, '..');
const MINI_HOME = '<html><body><!-- build:intro:start --><!-- build:intro:end --><div><!-- build:cards:start --><!-- build:cards:end --></div></body></html>';

function project(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'));
  fs.mkdirSync(path.join(root, 'content'));
  const sample = JSON.parse(fs.readFileSync(path.join(REPO, 'test/fixtures/videos.sample.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'videos.json'), opts.videos ?? JSON.stringify({ data: sample }));
  fs.writeFileSync(path.join(root, 'index.html'), opts.home ?? MINI_HOME);
  fs.writeFileSync(path.join(root, 'content/home-intro.html'), '<p>INTRO TEXT</p>');
  return root;
}

function snapshot(dir, rel = '') {
  const out = {};
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) { out[r + '/'] = 1; Object.assign(out, snapshot(dir, r)); } else out[r] = fs.readFileSync(path.join(dir, r), 'utf8');
  }
  return out;
}

function cli(root) {
  return spawnSync(process.execPath, [path.join(REPO, 'build-site.js'), '--root', root], { encoding: 'utf8' });
}

test('buildSite: outputs, marker replacement, no writes', () => {
  const root = project();
  const before = snapshot(root);
  const { files } = buildSite({ root });
  assert.deepStrictEqual(snapshot(root), before);
  const home = files.get('index.html');
  assert.ok(home.includes('INTRO TEXT') && home.includes('class="video-card"'));
  const eps = [...files.keys()].filter((k) => k.startsWith('episodes/'));
  const expected = selectEpisodes(JSON.parse(fs.readFileSync(path.join(root, 'videos.json'), 'utf8')).data).length;
  assert.ok(expected > 1);
  assert.strictEqual(eps.length, expected);
  assert.ok(files.has('sitemap.xml') && files.has('llms.txt') && files.has('slugs.json'));
  assert.ok([...files.keys()].every((k) => !k.includes('undefined')));
  assert.ok([...files.values()].every((v) => !v.includes('/undefined')));
  assert.ok(files.get('sitemap.xml').includes('<loc>https://emmetsplace.com/</loc>'));
  assert.ok(files.get('sitemap.xml').includes('<lastmod>2025-06-02</lastmod>'));
});

test('buildSite: second run with written slugs.json is identical; writeSite is idempotent', () => {
  const root = project();
  const first = buildSite({ root });
  writeSite(root, first.files);
  const second = buildSite({ root });
  assert.deepStrictEqual([...second.files], [...first.files]);
  const f = path.join(root, 'sitemap.xml');
  const old = new Date(2020, 0, 1);
  fs.utimesSync(f, old, old);
  writeSite(root, second.files);
  assert.strictEqual(fs.statSync(f).mtimeMs, old.getTime());
});

test('buildSite: pinned slug is respected', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'slugs.json'), JSON.stringify({ episodes: { v134: 'custom-slug' }, musicians: {} }));
  assert.ok(buildSite({ root }).files.has('episodes/custom-slug/index.html'));
});

test('buildSite: missing marker throws', () => {
  assert.throws(() => buildSite({ root: project({ home: '<html></html>' }) }), /marker/);
});

test('writers: page only under /writers/, nowhere else', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'content/writers.json'), JSON.stringify([{ slug: 'jane-doe', name: 'Jane Doe', episodeIds: ['v134'] }]));
  const { files } = buildSite({ root });
  assert.ok(files.get('writers/jane-doe/index.html').includes('Jane Doe'));
  for (const [k, v] of files) {
    if (k.startsWith('writers/')) continue;
    assert.ok(!v.includes('writers/') && !v.includes('Jane Doe'), k);
  }
});

test('CLI failures exit 1 and leave the tree untouched', () => {
  const cases = {
    malformed: project({ videos: '{nope' }),
    missing: project(),
    noData: project({ videos: '{}' }),
    zero: project({ videos: JSON.stringify({ data: {} }) }),
  };
  fs.rmSync(path.join(cases.missing, 'videos.json'));
  for (const [name, root] of Object.entries(cases)) {
    const before = snapshot(root);
    const r = cli(root);
    assert.strictEqual(r.status, 1, name);
    assert.ok(r.stderr.startsWith('build-site:'), name);
    assert.deepStrictEqual(snapshot(root), before, name);
  }
});

test('CLI: marker failure writes nothing', () => {
  const root = project({ home: '<html></html>' });
  const before = snapshot(root);
  assert.strictEqual(cli(root).status, 1);
  assert.deepStrictEqual(snapshot(root), before);
});

test('CLI: writes site, removes stale generated dirs, keeps hand-written ones', () => {
  const root = project();
  fs.mkdirSync(path.join(root, 'episodes/old'), { recursive: true });
  fs.writeFileSync(path.join(root, 'episodes/old/index.html'), '<!-- generated by build-site.js -->old');
  fs.mkdirSync(path.join(root, 'musicians/hand'), { recursive: true });
  fs.writeFileSync(path.join(root, 'musicians/hand/index.html'), '<html>mine</html>');
  const r = cli(root);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(root, 'episodes/old')));
  assert.ok(fs.existsSync(path.join(root, 'musicians/hand/index.html')));
  assert.ok(fs.existsSync(path.join(root, 'sitemap.xml')) && fs.existsSync(path.join(root, 'slugs.json')));
  assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('INTRO TEXT'));
});
