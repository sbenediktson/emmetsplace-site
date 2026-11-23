const MUSICIAN_ALIASES = {};

function isNoiseName(name) {
  const n = String(name).trim();
  if (!n) return true;
  if (/[:@]/.test(n) || n.includes('http')) return true;
  return n.split(/\s+/).length > 4;
}

function collectMusicians(episodes, aliases = MUSICIAN_ALIASES) {
  const byName = new Map();
  for (const ep of episodes) {
    for (const artist of ep.artists) {
      const raw = String(artist.name).trim();
      if (isNoiseName(raw)) continue;
      const name = aliases[raw] || raw;
      let m = byName.get(name);
      if (!m) {
        m = { name, instruments: [], appearances: [] };
        byName.set(name, m);
      }
      const instrument = String(artist.instrument || '').trim();
      if (instrument && !m.instruments.includes(instrument)) m.instruments.push(instrument);
      if (!m.appearances.includes(ep)) m.appearances.push(ep);
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.appearances.length - a.appearances.length || a.name.localeCompare(b.name)
  );
}

module.exports = { MUSICIAN_ALIASES, isNoiseName, collectMusicians };
