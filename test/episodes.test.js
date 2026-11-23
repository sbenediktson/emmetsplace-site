const test = require('node:test');
const assert = require('node:assert');
const { selectEpisodes, pageTitle } = require('../site/episodes');
const data = require('./fixtures/videos.sample.json');

const eps = selectEpisodes(data);
const byId = (id) => eps.find((e) => e.id === id);

test('selects only duration >= 1800', () => {
  const ids = eps.map((e) => e.id);
  assert.ok(!ids.includes('ml4'));
  assert.ok(!ids.includes('short'));
  assert.ok(ids.includes('v134'));
});

test('folds re-streams into canonical', () => {
  assert.strictEqual(eps.filter((e) => e.number === 134).length, 1);
  assert.deepStrictEqual(byId('v134').restreams, [{ id: 'v134r', title: data.v134r.title }]);
  assert.ok(!byId('v134r'));
  assert.strictEqual(byId('sf').restreams.length, 1);
  assert.strictEqual(byId('sf').restreams[0].id, 'sfr');
  assert.ok(!byId('sfr'));
});

test('re-stream without original becomes the page', () => {
  const ep = byId('orph');
  assert.ok(ep);
  assert.deepStrictEqual(ep.restreams, []);
});

test('number parsing', () => {
  assert.strictEqual(byId('v134').number, 134);
  assert.strictEqual(byId('v137').number, 137);
  assert.strictEqual(byId('sf').number, null);
  assert.strictEqual(byId('ml4'), undefined);
});

test('location', () => {
  assert.strictEqual(byId('v136').location, 'Harlem, New York');
  assert.strictEqual(byId('v137').location, 'Power Station at Berklee NYC');
  assert.strictEqual(byId('sf').location, null);
});

test('episode fields', () => {
  const ep = byId('v134');
  assert.strictEqual(ep.guests, 'Kurt Elling');
  assert.strictEqual(ep.year, 2025);
  assert.strictEqual(ep.duration, 7000);
  assert.strictEqual(ep.description, 'Kurt joins the trio.');
  assert.strictEqual(ep.artists.length, 2);
  assert.deepStrictEqual(ep.songs, [{ title: 'Nature Boy', start: 120 }]);
});

test('pageTitle', () => {
  assert.strictEqual(pageTitle(byId('v134')), "Kurt Elling - Live From Emmet's Place Vol. 134 (2025)");
  assert.strictEqual(pageTitle(byId('sf')), 'Emmet Cohen Quintet Celebrates Miles and Coltrane at 100 (Live at @sfjazz) (2026)');
  assert.strictEqual(pageTitle(byId('v137')), 'Emmet’s Place Revival: Joshua Redman Ignites the New Era (2025)');
  const t = pageTitle(byId('v100'));
  assert.strictEqual(byId('v100').year, null);
  assert.ok(!t.includes('undefined') && !/\(\d{4}\)/.test(t));
  assert.strictEqual(t, "Nobody Yet - Live From Emmet's Place Vol. 100");
});

test('sorted newest first', () => {
  const dated = eps.filter((e) => e.streamDate);
  for (let i = 1; i < dated.length; i++) assert.ok(dated[i - 1].streamDate >= dated[i].streamDate);
  assert.strictEqual(eps[eps.length - 1].id, 'v100');
});

test('apostrophe-less "Re-Stream -" title folds into numbered original', () => {
  assert.strictEqual(eps.filter((e) => e.number === 33).length, 1);
  const ep = byId('v33');
  assert.strictEqual(ep.location, 'Harlem, New York');
  assert.deepStrictEqual(ep.restreams.map((r) => r.id), ['v33r']);
  assert.ok(!byId('v33r'));
});

test('pageTitle strips Re-Stream prefix for orphan re-stream', () => {
  const t = pageTitle(byId('orph'));
  assert.ok(!/re-?stream/i.test(t));
  assert.ok(t.endsWith('(2026)'));
});
