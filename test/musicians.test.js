const { test } = require('node:test');
const assert = require('node:assert');
const { collectMusicians, isNoiseName } = require('../site/musicians');

const ep = (id, artists) => ({ id, artists });
const a = (name, instrument) => ({ name, instrument });

test('isNoiseName flags empty, colon, @, http, and long names', () => {
  assert.strictEqual(isNoiseName(''), true);
  assert.strictEqual(isNoiseName("Charlie Parker: Now's the Time"), true);
  assert.strictEqual(isNoiseName('@someone'), true);
  assert.strictEqual(isNoiseName('see http://x.com'), true);
  assert.strictEqual(isNoiseName('one two three four five'), true);
  assert.strictEqual(isNoiseName('Joe Farnsworth'), false);
});

test('noise names are dropped', () => {
  const out = collectMusicians([ep('1', [a("Charlie Parker: Now's the Time", ''), a('', 'x'), a('Ann', 'bass')])]);
  assert.deepStrictEqual(out.map((m) => m.name), ['Ann']);
});

test('aliases merge variants', () => {
  const eps = [ep('2', [a('Joe Farnsworth Jr.', 'drums')]), ep('1', [a('Joe Farnsworth', 'drums')])];
  const out = collectMusicians(eps, { 'Joe Farnsworth Jr.': 'Joe Farnsworth' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'Joe Farnsworth');
  assert.deepStrictEqual(out[0].appearances.map((e) => e.id), ['2', '1']);
});

test('a name listed twice in one episode counts once', () => {
  const out = collectMusicians([ep('1', [a('Ann', 'bass'), a('Ann', 'vocals')])]);
  assert.strictEqual(out[0].appearances.length, 1);
});

test('instruments dedupe in first-seen order', () => {
  const eps = [ep('2', [a('Ann', 'bass')]), ep('1', [a('Ann', 'vocals'), a('Ann', 'bass'), a('Ann', '')])];
  assert.deepStrictEqual(collectMusicians(eps)[0].instruments, ['bass', 'vocals']);
});

test('sorted by appearance count desc then name', () => {
  const eps = [
    ep('2', [a('Zed', 'x'), a('Bob', 'y'), a('Cy', 'z')]),
    ep('1', [a('Cy', 'z'), a('Amy', 'w')]),
  ];
  assert.deepStrictEqual(collectMusicians(eps).map((m) => m.name), ['Cy', 'Amy', 'Bob', 'Zed']);
});
