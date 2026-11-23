'use strict';

const MIN_DURATION = 1800;

function stripEmoji(s) {
  return String(s).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/\s+/g, ' ').trim();
}

function normalizeApos(s) {
  return s.replace(/[‘’ʼ`´]/g, "'");
}

const RESTREAM_PREFIX = /^\s*re-?stream\b\s*[:\-\u2013\u2014]?\s*/i;
const isRestream = (title) => RESTREAM_PREFIX.test(title);
const stripRestream = (title) => title.replace(RESTREAM_PREFIX, '');

// Series number, or null. "Masters Legacy Series" is a different series.
function parseNumber(title) {
  const t = normalizeApos(title);
  if (/masters legacy/i.test(t)) return null;
  const ep = t.match(/\(\s*Ep(?:isode|\.)?\s*(\d+)\s*\)/i);
  if (ep) return Number(ep[1]);
  if (/emmets?'?\s*place/i.test(t)) {
    const vol = t.match(/\b(?:Vol(?:ume)?|Ep(?:isode)?)\.?\s*(\d+)/i);
    if (vol) return Number(vol[1]);
  }
  return null;
}

function parseGuests(title) {
  const m = stripRestream(stripEmoji(title)).match(/\bVol\.?\s*\d+\s*[-–—]\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

function locationFor(number) {
  if (number === null) return null;
  return number <= 136 ? 'Harlem, New York' : 'Power Station at Berklee NYC';
}

function groupKey(title, number) {
  if (number !== null) return 'n:' + number;
  return 't:' + normalizeApos(stripRestream(stripEmoji(title))).toLowerCase().replace(/\s+/g, ' ');
}

// Earliest date first; missing dates last.
function byDateAsc(a, b) {
  if (a.streamDate === b.streamDate) return 0;
  if (!a.streamDate) return 1;
  if (!b.streamDate) return -1;
  return a.streamDate < b.streamDate ? -1 : 1;
}

function selectEpisodes(data) {
  const groups = new Map();
  for (const [id, v] of Object.entries(data || {})) {
    if (!v || !(v.duration >= MIN_DURATION)) continue;
    const number = parseNumber(v.title);
    const key = groupKey(v.title, number);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id, v, number });
  }

  const episodes = [];
  for (const members of groups.values()) {
    members.sort((a, b) => byDateAsc(a.v, b.v));
    const originals = members.filter((m) => !isRestream(m.v.title));
    const canonical = (originals.length ? originals : members)[0];
    const { id, v, number } = canonical;
    const streamDate = v.streamDate || null;
    episodes.push({
      id,
      title: v.title,
      number,
      guests: number !== null ? parseGuests(v.title) : null,
      streamDate,
      year: streamDate ? new Date(streamDate).getUTCFullYear() : null,
      duration: v.duration,
      location: locationFor(number),
      artists: v.artists || [],
      songs: v.songs || [],
      description: v.description || '',
      restreams: members.filter((m) => m !== canonical).map((m) => ({ id: m.id, title: m.v.title })),
    });
  }
  episodes.sort((a, b) => {
    if (!a.streamDate || !b.streamDate) return byDateAsc(a, b);
    return byDateAsc(b, a);
  });
  return episodes;
}

function pageTitle(ep) {
  let base;
  if (ep.number !== null && ep.guests) {
    base = `${ep.guests} - Live From Emmet's Place Vol. ${ep.number}`;
  } else {
    base = stripRestream(stripEmoji(ep.title))
      .replace(/\(\s*Ep(?:isode|\.)?\s*\d+\s*\)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return ep.year ? `${base} (${ep.year})` : base;
}

module.exports = { selectEpisodes, pageTitle, stripEmoji };
