const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'collection.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PENDING_TRADES_FILE = path.join(DATA_DIR, 'pending-trades.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Teams data ────────────────────────────────────────────────────────────
const TEAMS = [
  { code: 'MEX', name: 'Mexico',               group: 'A', color: '#2E7D32' },
  { code: 'RSA', name: 'South Africa',          group: 'A', color: '#2E7D32' },
  { code: 'KOR', name: 'Korea Republic',        group: 'A', color: '#2E7D32' },
  { code: 'CZE', name: 'Czechia',               group: 'A', color: '#2E7D32' },
  { code: 'CAN', name: 'Canada',                group: 'B', color: '#00695C' },
  { code: 'BIH', name: 'Bosnia & Herzegovina',  group: 'B', color: '#00695C' },
  { code: 'QAT', name: 'Qatar',                 group: 'B', color: '#00695C' },
  { code: 'SUI', name: 'Switzerland',           group: 'B', color: '#00695C' },
  { code: 'BRA', name: 'Brazil',                group: 'C', color: '#9E9D24' },
  { code: 'MAR', name: 'Morocco',               group: 'C', color: '#9E9D24' },
  { code: 'HAI', name: 'Haiti',                 group: 'C', color: '#9E9D24' },
  { code: 'SCO', name: 'Scotland',              group: 'C', color: '#9E9D24' },
  { code: 'USA', name: 'USA',                   group: 'D', color: '#1565C0' },
  { code: 'PAR', name: 'Paraguay',              group: 'D', color: '#1565C0' },
  { code: 'AUS', name: 'Australia',             group: 'D', color: '#1565C0' },
  { code: 'TUR', name: 'Turkey',                group: 'D', color: '#1565C0' },
  { code: 'GER', name: 'Germany',               group: 'E', color: '#BF360C' },
  { code: 'CUW', name: 'Curaçao',               group: 'E', color: '#BF360C' },
  { code: 'CIV', name: "Côte d'Ivoire",         group: 'E', color: '#BF360C' },
  { code: 'ECU', name: 'Ecuador',               group: 'E', color: '#BF360C' },
  { code: 'NED', name: 'Netherlands',           group: 'F', color: '#0277BD' },
  { code: 'JPN', name: 'Japan',                 group: 'F', color: '#0277BD' },
  { code: 'SWE', name: 'Sweden',                group: 'F', color: '#0277BD' },
  { code: 'TUN', name: 'Tunisia',               group: 'F', color: '#0277BD' },
  { code: 'BEL', name: 'Belgium',               group: 'G', color: '#4527A0' },
  { code: 'EGY', name: 'Egypt',                 group: 'G', color: '#4527A0' },
  { code: 'IRN', name: 'IR Iran',               group: 'G', color: '#4527A0' },
  { code: 'NZL', name: 'New Zealand',           group: 'G', color: '#4527A0' },
  { code: 'ESP', name: 'Spain',                 group: 'H', color: '#283593' },
  { code: 'CPV', name: 'Cape Verde',            group: 'H', color: '#283593' },
  { code: 'KSA', name: 'Saudi Arabia',          group: 'H', color: '#283593' },
  { code: 'URU', name: 'Uruguay',               group: 'H', color: '#283593' },
  { code: 'FRA', name: 'France',                group: 'I', color: '#6A1B9A' },
  { code: 'SEN', name: 'Senegal',               group: 'I', color: '#6A1B9A' },
  { code: 'IRQ', name: 'Iraq',                  group: 'I', color: '#6A1B9A' },
  { code: 'NOR', name: 'Norway',                group: 'I', color: '#6A1B9A' },
  { code: 'ARG', name: 'Argentina',             group: 'J', color: '#880E4F' },
  { code: 'ALG', name: 'Algeria',               group: 'J', color: '#880E4F' },
  { code: 'AUT', name: 'Austria',               group: 'J', color: '#880E4F' },
  { code: 'JOR', name: 'Jordan',                group: 'J', color: '#880E4F' },
  { code: 'POR', name: 'Portugal',              group: 'K', color: '#AD1457' },
  { code: 'COD', name: 'Congo DR',              group: 'K', color: '#AD1457' },
  { code: 'UZB', name: 'Uzbekistan',            group: 'K', color: '#AD1457' },
  { code: 'COL', name: 'Colombia',              group: 'K', color: '#AD1457' },
  { code: 'ENG', name: 'England',               group: 'L', color: '#C62828' },
  { code: 'CRO', name: 'Croatia',               group: 'L', color: '#C62828' },
  { code: 'GHA', name: 'Ghana',                 group: 'L', color: '#C62828' },
  { code: 'PAN', name: 'Panama',                group: 'L', color: '#C62828' },
];

// ─── Data helpers ───────────────────────────────────────────────────────────
function initCollection() {
  const data = {};
  for (const team of TEAMS) {
    data[team.code] = {};
    for (let i = 1; i <= 20; i++) data[team.code][String(i)] = 0;
  }
  // FWC Special: une seule carte 00 + FWC1-FWC19
  data['FWC'] = { '00': 0 };
  for (let i = 1; i <= 19; i++) data['FWC'][String(i)] = 0;
  return data;
}

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const data = initCollection();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Migration : supprimer '00' des équipes (déplacé dans FWC Special)
  let migrated = false;
  for (const team of TEAMS) {
    if (data[team.code] && '00' in data[team.code]) {
      delete data[team.code]['00'];
      migrated = true;
    }
  }
  if (!data['FWC']) { data['FWC'] = { '00': 0 }; migrated = true; }
  if (!('00' in data['FWC'])) { data['FWC']['00'] = 0; migrated = true; }
  if (migrated) saveData(data);

  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadHistory() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) return [];

  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(history) ? history : [];
  } catch (err) {
    console.warn('Invalid history.json ignored:', err.message);
    return [];
  }
}

function saveHistory(history) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function saveJsonAtomic(file, value) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function loadPendingTrades() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PENDING_TRADES_FILE)) return [];

  try {
    const trades = JSON.parse(fs.readFileSync(PENDING_TRADES_FILE, 'utf8'));
    return Array.isArray(trades) ? trades : [];
  } catch (err) {
    console.warn('Invalid pending-trades.json ignored:', err.message);
    return [];
  }
}

function savePendingTrades(trades) {
  saveJsonAtomic(PENDING_TRADES_FILE, trades);
}

function createHistoryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function cardCode(team, card) {
  if (team === 'FWC') return card === '00' ? '00' : `FWC${card}`;
  return `${team}${card}`;
}

function collectionStats(data) {
  let owned = 0;
  let total = 0;
  let doubles = 0;

  for (const cards of Object.values(data)) {
    for (const count of Object.values(cards)) {
      total++;
      if (count > 0) owned++;
      if (count >= 2) doubles += count - 1;
    }
  }

  const progress = total === 0 ? 0 : Math.round((owned / total) * 100);
  return { owned, total, doubles, progress };
}

function buildTradeImpact(before, after, counters) {
  return {
    newReceived: counters.newReceived,
    receivedAsDoubles: counters.receivedAsDoubles,
    duplicateGiven: counters.duplicateGiven,
    uniqueBlocked: counters.uniqueBlocked,
    uniqueGiven: counters.uniqueGiven,
    before,
    after
  };
}

function trackDelta(deltaMap, data, parsed) {
  const key = `${parsed.team}:${parsed.card}`;
  if (!deltaMap.has(key)) {
    deltaMap.set(key, {
      team: parsed.team,
      card: parsed.card,
      code: cardCode(parsed.team, parsed.card),
      before: data[parsed.team][parsed.card] || 0,
      after: data[parsed.team][parsed.card] || 0,
      delta: 0
    });
  }
  return deltaMap.get(key);
}

function finalizeDeltas(deltaMap, data) {
  return [...deltaMap.values()].map(delta => {
    const after = data[delta.team][delta.card] || 0;
    return {
      ...delta,
      after,
      delta: after - delta.before
    };
  });
}

function changedDeltas(deltas) {
  return (Array.isArray(deltas) ? deltas : []).filter(delta => delta.delta !== 0);
}

function appendHistoryEntry(entry) {
  const history = loadHistory();
  history.push(entry);
  saveHistory(history.slice(-200));
}

function buildHistoryEntry(type, payload) {
  const deltas = changedDeltas(payload.deltas);
  const cards = deltas.map(delta => ({
    team: delta.team,
    card: delta.card,
    code: delta.code || cardCode(delta.team, delta.card),
    before: delta.before,
    after: delta.after,
    delta: delta.delta
  }));

  return {
    id: createHistoryId(),
    date: new Date().toISOString(),
    type,
    source: payload.source || type,
    cards,
    deltas,
    ...payload
  };
}

function appendCollectionHistory(type, payload) {
  const deltas = changedDeltas(payload.deltas);
  if (!deltas.length) return null;

  const entry = buildHistoryEntry(type, {
    ...payload,
    deltas
  });
  appendHistoryEntry(entry);
  return entry;
}

function isReversibleHistoryEntry(entry) {
  return Boolean(
    entry &&
    !entry.reverted &&
    !['undo', 'revert'].includes(entry.type) &&
    Array.isArray(entry.deltas) &&
    changedDeltas(entry.deltas).length > 0
  );
}

function revertHistoryEntry(history, entryIndex, data) {
  const entry = history[entryIndex];
  if (!entry) return { status: 404, error: 'History entry not found' };
  if (entry.reverted) return { status: 400, error: 'History entry already reverted' };
  if (!isReversibleHistoryEntry(entry)) {
    return { status: 400, error: 'History entry is not reversible' };
  }

  const inverseByKey = new Map();
  for (const delta of changedDeltas(entry.deltas)) {
    if (!data[delta.team] || !(delta.card in data[delta.team])) {
      return { status: 400, error: 'History entry references an invalid card' };
    }
    const key = `${delta.team}:${delta.card}`;
    const existing = inverseByKey.get(key) || {
      team: delta.team,
      card: delta.card,
      code: delta.code || cardCode(delta.team, delta.card),
      delta: 0
    };
    existing.delta -= Number(delta.delta) || 0;
    inverseByKey.set(key, existing);
  }

  const revertDeltas = [];
  for (const inverse of inverseByKey.values()) {
    const before = data[inverse.team][inverse.card] || 0;
    const after = before + inverse.delta;
    if (after < 0) {
      return {
        status: 409,
        error: `Impossible d’annuler cette action : ${inverse.code} descendrait sous 0.`,
        code: inverse.code
      };
    }
    if (after !== before) {
      revertDeltas.push({
        team: inverse.team,
        card: inverse.card,
        code: inverse.code,
        before,
        after,
        delta: after - before
      });
    }
  }

  if (!revertDeltas.length) {
    return { status: 400, error: 'Revert would not change the collection' };
  }

  for (const delta of revertDeltas) {
    data[delta.team][delta.card] = delta.after;
  }

  const revertEntry = buildHistoryEntry('revert', {
    source: 'history_revert',
    revertedHistoryId: entry.id,
    revertedType: entry.type,
    summary: `Annulation de ${entry.summary || entry.type}`,
    deltas: revertDeltas
  });

  history[entryIndex] = {
    ...entry,
    reverted: true,
    revertedAt: revertEntry.date,
    revertedByHistoryId: revertEntry.id
  };
  history.push(revertEntry);

  return { entry: history[entryIndex], revertEntry };
}

function processImport(data, body) {
  const { cards } = body || {};
  if (!Array.isArray(cards) && typeof cards !== 'string') {
    return { error: 'cards must be an array or a string' };
  }

  const inputCards = extractCardCodes(cards);
  const deltaMap = new Map();
  const results = { ok: [], unknown: [], deltas: [] };

  for (const raw of inputCards) {
    const parsed = parseCardCode(raw);
    if (!parsed || !data[parsed.team] || !(parsed.card in data[parsed.team])) {
      results.unknown.push(raw);
      continue;
    }

    trackDelta(deltaMap, data, parsed);
    data[parsed.team][parsed.card]++;
    results.ok.push(raw);
  }

  results.deltas = finalizeDeltas(deltaMap, data);
  return results;
}

function processTrade(data, body) {
  const { received = [], given = [], allowUniqueGiven = false } = body || {};
  const receivedCards = extractCardCodes(received);
  const givenCards = extractCardCodes(given);
  const before = collectionStats(data);
  const deltaMap = new Map();
  const counters = {
    newReceived: 0,
    receivedAsDoubles: 0,
    duplicateGiven: 0,
    uniqueBlocked: 0,
    uniqueGiven: 0
  };
  const results = {
    received: { ok: [], unknown: [] },
    given: { ok: [], unknown: [], refused: [], uniqueBlocked: [], uniqueGiven: [], duplicateGiven: [] }
  };

  for (const raw of receivedCards) {
    const parsed = parseCardCode(raw);
    if (!parsed || !data[parsed.team] || !(parsed.card in data[parsed.team])) {
      results.received.unknown.push(raw);
      continue;
    }
    const count = data[parsed.team][parsed.card] || 0;
    if (count <= 0) counters.newReceived++;
    else counters.receivedAsDoubles++;
    trackDelta(deltaMap, data, parsed);
    data[parsed.team][parsed.card]++;
    results.received.ok.push(raw);
  }

  for (const raw of givenCards) {
    const parsed = parseCardCode(raw);
    if (!parsed || !data[parsed.team] || !(parsed.card in data[parsed.team])) {
      results.given.unknown.push(raw);
      continue;
    }
    const count = data[parsed.team][parsed.card] || 0;
    if (count <= 0) {
      results.given.refused.push(raw);
      continue;
    }
    if (count <= 1) {
      if (!allowUniqueGiven) {
        counters.uniqueBlocked++;
        results.given.uniqueBlocked.push(raw);
        continue;
      }
      counters.uniqueGiven++;
      results.given.uniqueGiven.push(raw);
    } else {
      counters.duplicateGiven++;
      results.given.duplicateGiven.push(raw);
    }
    trackDelta(deltaMap, data, parsed);
    data[parsed.team][parsed.card]--;
    results.given.ok.push(raw);
  }

  results.impact = buildTradeImpact(before, collectionStats(data), counters);
  results.deltas = finalizeDeltas(deltaMap, data);
  return results;
}

function normalizeTradeCards(data, cards) {
  const rawCards = extractCardCodes(cards);
  const ok = [];
  const unknown = [];

  for (const raw of rawCards) {
    const parsed = parseCardCode(raw);
    if (!parsed || !data[parsed.team] || !(parsed.card in data[parsed.team])) {
      unknown.push(raw);
      continue;
    }
    ok.push(cardCode(parsed.team, parsed.card));
  }

  return { ok, unknown };
}

function cardKeyFromCode(code) {
  const parsed = parseCardCode(code);
  return parsed ? `${parsed.team}:${parsed.card}` : null;
}

function pendingImpact(pendingTrades) {
  const incoming = new Map();
  const outgoing = new Map();
  const add = (map, code) => {
    const key = cardKeyFromCode(code);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  };

  for (const trade of pendingTrades) {
    if (trade.status !== 'pending') continue;
    for (const code of trade.received || []) add(incoming, code);
    for (const code of trade.given || []) add(outgoing, code);
  }

  return { incoming, outgoing };
}

function pendingCount(map, team, card) {
  return map.get(`${team}:${card}`) || 0;
}

function cardCountsWithPending(data, pendingTrades, team, card) {
  const impact = pendingImpact(pendingTrades);
  const real = data[team]?.[card] || 0;
  const incoming = pendingCount(impact.incoming, team, card);
  const outgoing = pendingCount(impact.outgoing, team, card);
  return {
    real,
    incoming,
    outgoing,
    effective: real + incoming - outgoing,
    tradeable: Math.max(0, real - outgoing)
  };
}

function collectionCodeSetWithPending(data, pendingTrades, predicate) {
  const cards = [];
  const impact = pendingImpact(pendingTrades);

  const addCards = (team, cardMap) => {
    for (const [card, real] of Object.entries(cardMap || {})) {
      const incoming = pendingCount(impact.incoming, team, card);
      const outgoing = pendingCount(impact.outgoing, team, card);
      const counts = {
        real: real || 0,
        incoming,
        outgoing,
        effective: (real || 0) + incoming - outgoing,
        tradeable: Math.max(0, (real || 0) - outgoing)
      };
      if (!predicate(counts)) continue;
      cards.push({
        team,
        card,
        code: cardCode(team, card),
        key: `${team}:${card}`,
        sort: cardSortValue(team, card),
        counts
      });
    }
  };

  addCards('FWC', data.FWC || {});
  for (const team of TEAMS) addCards(team.code, data[team.code] || {});

  return new Map(cards.sort((a, b) => a.sort - b.sort).map(card => [card.key, card]));
}

function validatePendingTrade(data, pendingTrades, body) {
  const { received = [], given = [], allowUniqueGiven = false, note = '' } = body || {};
  const receivedCards = normalizeTradeCards(data, received);
  const givenCards = normalizeTradeCards(data, given);
  const results = {
    received: { ok: receivedCards.ok, unknown: receivedCards.unknown },
    given: { ok: [], unknown: givenCards.unknown, refused: [], uniqueBlocked: [], reserved: [] },
    note: String(note || '').slice(0, 500),
    allowUniqueGiven: Boolean(allowUniqueGiven)
  };

  for (const code of givenCards.ok) {
    const parsed = parseCardCode(code);
    const counts = cardCountsWithPending(data, pendingTrades, parsed.team, parsed.card);
    if (counts.tradeable <= 0) {
      results.given.refused.push(code);
      continue;
    }
    if (counts.real > 0 && counts.outgoing > 0) {
      results.given.reserved.push(code);
    }
    if (counts.tradeable <= 1 && !allowUniqueGiven) {
      results.given.uniqueBlocked.push(code);
      continue;
    }
    results.given.ok.push(code);
  }

  return results;
}

function createPendingTrade(results) {
  return {
    id: createHistoryId(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    received: results.received.ok,
    given: results.given.ok,
    note: results.note,
    source: 'trade_modal',
    allowUniqueGiven: results.allowUniqueGiven
  };
}

// ─── API ────────────────────────────────────────────────────────────────────
app.get('/api/teams', (_req, res) => res.json(TEAMS));

app.get('/api/collection', (_req, res) => res.json(loadData()));

app.get('/api/history', (_req, res) => {
  res.json(loadHistory().slice(-20).reverse());
});

app.post('/api/undo-last', (_req, res) => {
  const history = loadHistory();
  const entryIndex = history.findLastIndex(isReversibleHistoryEntry);
  if (entryIndex === -1) return res.status(404).json({ error: 'No history to undo' });
  const data = loadData();
  const result = revertHistoryEntry(history, entryIndex, data);
  if (result.error) return res.status(result.status || 400).json({ error: result.error, code: result.code });

  saveData(data);
  saveHistory(history);
  res.json({ ok: true, undone: result.entry, revert: result.revertEntry });
});

app.post('/api/history/:id/revert', (req, res) => {
  const history = loadHistory();
  const entryIndex = history.findIndex(entry => entry.id === req.params.id);
  if (entryIndex === -1) return res.status(404).json({ error: 'History entry not found' });

  const data = loadData();
  const result = revertHistoryEntry(history, entryIndex, data);
  if (result.error) return res.status(result.status || 400).json({ error: result.error, code: result.code });

  saveData(data);
  saveHistory(history);
  res.json({ ok: true, reverted: result.entry, revert: result.revertEntry });
});

app.patch('/api/card', (req, res) => {
  const { team, card, delta, source = 'manual_click' } = req.body;
  const data = loadData();
  if (!data[team] || !(card in data[team])) {
    return res.status(400).json({ error: 'Invalid team or card' });
  }
  const numericDelta = Number(delta);
  if (!Number.isInteger(numericDelta)) {
    return res.status(400).json({ error: 'Invalid delta' });
  }
  const before = data[team][card] || 0;
  const after = Math.max(0, before + numericDelta);
  if (after === before) {
    return res.json({ team, card, count: before, changed: false });
  }

  data[team][card] = after;
  saveData(data);
  const code = cardCode(team, card);
  const historyType = after > before ? 'manual_add' : 'manual_remove';
  const appliedDelta = after - before;
  const entry = appendCollectionHistory(historyType, {
    source,
    summary: `${appliedDelta > 0 ? '+' : ''}${appliedDelta} ${code}`,
    deltas: [{ team, card, code, before, after, delta: appliedDelta }]
  });
  res.json({ team, card, count: data[team][card], changed: true, historyId: entry?.id });
});

app.post('/api/reset/:team', (req, res) => {
  const { team } = req.params;
  const data = loadData();
  if (!data[team]) return res.status(400).json({ error: 'Invalid team' });
  const deltas = [];
  for (const key of Object.keys(data[team])) {
    const before = data[team][key] || 0;
    if (before <= 0) continue;
    data[team][key] = 0;
    deltas.push({
      team,
      card: key,
      code: cardCode(team, key),
      before,
      after: 0,
      delta: -before
    });
  }
  saveData(data);
  const entry = appendCollectionHistory('reset', {
    source: 'reset',
    summary: `Reset ${team}`,
    deltas
  });
  res.json({ ok: true, historyId: entry?.id });
});

app.get('/api/pending-trades', (_req, res) => {
  res.json(loadPendingTrades());
});

app.post('/api/pending-trades', (req, res) => {
  const data = loadData();
  const trades = loadPendingTrades();
  const results = validatePendingTrade(data, trades, req.body);
  const hasCards = results.received.ok.length || results.given.ok.length;
  if (!hasCards) return res.status(400).json({ error: 'No valid cards for pending trade', results });
  if (
    results.received.unknown.length ||
    results.given.unknown.length ||
    results.given.refused.length ||
    results.given.uniqueBlocked.length
  ) {
    return res.status(400).json({ error: 'Pending trade contains invalid or unavailable cards', results });
  }

  const trade = createPendingTrade(results);
  trades.push(trade);
  savePendingTrades(trades);

  const entry = buildHistoryEntry('pending_trade_create', {
    source: 'trade_modal',
    pendingTradeId: trade.id,
    summary: `Echange virtuel +${trade.received.length} / -${trade.given.length}`,
    received: trade.received,
    given: trade.given,
    deltas: []
  });
  appendHistoryEntry(entry);

  res.json({ ok: true, trade, results, historyId: entry.id });
});

app.post('/api/pending-trades/:id/cancel', (req, res) => {
  const trades = loadPendingTrades();
  const index = trades.findIndex(trade => trade.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Pending trade not found' });
  if (trades[index].status === 'completed') return res.status(400).json({ error: 'Completed pending trade cannot be cancelled' });
  if (trades[index].status === 'cancelled') return res.status(400).json({ error: 'Pending trade already cancelled' });

  trades[index] = { ...trades[index], status: 'cancelled', cancelledAt: new Date().toISOString() };
  savePendingTrades(trades);

  const entry = buildHistoryEntry('pending_trade_cancel', {
    source: 'pending_trade',
    pendingTradeId: trades[index].id,
    summary: `Echange virtuel annulé +${trades[index].received.length} / -${trades[index].given.length}`,
    received: trades[index].received,
    given: trades[index].given,
    deltas: []
  });
  appendHistoryEntry(entry);

  res.json({ ok: true, trade: trades[index], historyId: entry.id });
});

app.post('/api/pending-trades/:id/complete', (req, res) => {
  const data = loadData();
  const trades = loadPendingTrades();
  const index = trades.findIndex(trade => trade.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Pending trade not found' });
  const trade = trades[index];
  if (trade.status === 'completed') return res.status(400).json({ error: 'Pending trade already completed' });
  if (trade.status === 'cancelled') return res.status(400).json({ error: 'Cancelled pending trade cannot be completed' });

  const payload = {
    received: trade.received,
    given: trade.given,
    allowUniqueGiven: trade.allowUniqueGiven
  };
  const preview = processTrade(cloneData(data), payload);
  if (
    preview.received.unknown.length ||
    preview.given.unknown.length ||
    preview.given.refused.length ||
    preview.given.uniqueBlocked.length
  ) {
    return res.status(409).json({ error: 'Pending trade cannot be completed with current collection', preview });
  }

  const results = processTrade(data, payload);
  saveData(data);
  trades[index] = { ...trade, status: 'completed', completedAt: new Date().toISOString() };
  savePendingTrades(trades);

  const entry = appendCollectionHistory('trade', {
    source: 'pending_trade_complete',
    pendingTradeId: trade.id,
    summary: `Echange virtuel confirmé +${results.received.ok.length} / -${results.given.ok.length}`,
    imported: [],
    received: results.received.ok,
    given: results.given.ok,
    deltas: results.deltas
  });

  res.json({ ok: true, trade: trades[index], results, historyId: entry?.id });
});

app.get('/api/export/:type', (req, res) => {
  const { type } = req.params;
  const format = req.query.format || 'grouped';
  if (!['missing', 'doubles'].includes(type)) {
    return res.status(400).type('text/plain; charset=utf-8').send('Invalid export type');
  }
  if (!['compact', 'grouped', 'whatsapp'].includes(format)) {
    return res.status(400).type('text/plain; charset=utf-8').send('Invalid export format');
  }

  const data = loadData();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(buildExportText(data, type, format));
});

// ─── Start ───────────────────────────────────────────────────────────────────
loadData();
app.listen(PORT, () => {
  console.log(`\n🎴  Panini FIFA WC Tracker`);
  console.log(`🌐  http://localhost:${PORT}\n`);
});

// ─── Card code parser ────────────────────────────────────────────────────────
function normalizeCardCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    .replace(/^FCW/, 'FWC'); // tolere le typo frequent FCW -> FWC
}

function parseCardCode(raw) {
  const s = normalizeCardCode(raw);
  if (!s) return null;
  if (s === '00') return { team: 'FWC', card: '00' };
  if (s.startsWith('FWC')) {
    if (s === 'FWC00') return { team: 'FWC', card: '00' };
    const m = s.match(/^FWC0*(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 19) return { team: 'FWC', card: String(n) };
    }
    return null;
  }
  const teamCodes = TEAMS.map(t => t.code).sort((a, b) => b.length - a.length);
  for (const code of teamCodes) {
    if (s.startsWith(code)) {
      const n = parseInt(s.slice(code.length), 10);
      if (!isNaN(n) && n >= 1 && n <= 20) return { team: code, card: String(n) };
    }
  }
  return null;
}

function extractCardCodes(input) {
  const values = Array.isArray(input) ? input : [input];
  const teamCodes = [...TEAMS.map(t => t.code), 'FWC', 'FCW']
    .sort((a, b) => b.length - a.length)
    .join('|');
  const re = new RegExp(`\\b(?:00|(?:${teamCodes})\\s*0*\\d{1,2})\\b`, 'gi');

  return values.flatMap(value => {
    const text = String(value || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\bx\s*\d+\b/gi, ' ');
    return [...text.matchAll(re)].map(m => normalizeCardCode(m[0]));
  });
}

function extractCardCodesDetailed(input) {
  const values = Array.isArray(input) ? input : [input];
  const teamCodes = [...TEAMS.map(t => t.code), 'FWC', 'FCW']
    .sort((a, b) => b.length - a.length)
    .join('|');
  const validLikeRe = new RegExp(`\\b(?:00|(?:${teamCodes})\\s*0*\\d{1,2})\\b`, 'gi');
  const invalidLikeRe = /\b(?!x\s*\d+\b)[A-Z]{2,4}\s*0*\d{1,3}\b/gi;
  const codes = [];
  const invalid = [];

  for (const value of values) {
    let text = String(value || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\bx\s*\d+\b/gi, ' ');

    text = text.replace(validLikeRe, match => {
      codes.push(normalizeCardCode(match));
      return ' ';
    });

    for (const match of text.matchAll(invalidLikeRe)) {
      invalid.push(normalizeCardCode(match[0]));
    }
  }

  return { codes, invalid };
}

function cardSortValue(team, card) {
  if (team === 'FWC') return card === '00' ? 0 : Number(card);
  const teamIndex = TEAMS.findIndex(t => t.code === team);
  return 20 + (teamIndex * 20) + Number(card);
}

function uniqueValidCodes(rawCodes, data) {
  const seen = new Set();
  const valid = [];
  const unknown = [];

  for (const raw of rawCodes) {
    const parsed = parseCardCode(raw);
    if (!parsed || !data[parsed.team] || !(parsed.card in data[parsed.team])) {
      unknown.push(raw);
      continue;
    }

    const key = `${parsed.team}:${parsed.card}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ ...parsed, code: cardCode(parsed.team, parsed.card), key });
  }

  return { valid, unknown };
}

function collectionCodeSet(data, predicate) {
  const cards = [];

  const addCards = (team, cardMap) => {
    for (const [card, count] of Object.entries(cardMap || {})) {
      if (!predicate(count)) continue;
      cards.push({
        team,
        card,
        code: cardCode(team, card),
        key: `${team}:${card}`,
        sort: cardSortValue(team, card)
      });
    }
  };

  addCards('FWC', data.FWC || {});
  for (const team of TEAMS) addCards(team.code, data[team.code] || {});

  return new Map(cards.sort((a, b) => a.sort - b.sort).map(card => [card.key, card]));
}

function compareWithFriend(data, body, pendingTrades = []) {
  const { friendDoubles = '', friendMissing = '' } = body || {};
  if (
    !Array.isArray(friendDoubles) && typeof friendDoubles !== 'string' ||
    !Array.isArray(friendMissing) && typeof friendMissing !== 'string'
  ) {
    return { error: 'friendDoubles and friendMissing must be strings or arrays' };
  }

  const parsedDoubles = extractCardCodesDetailed(friendDoubles);
  const parsedMissing = extractCardCodesDetailed(friendMissing);
  const friendDoublesCards = uniqueValidCodes(parsedDoubles.codes, data);
  const friendMissingCards = uniqueValidCodes(parsedMissing.codes, data);
  const myMissing = collectionCodeSetWithPending(data, pendingTrades, counts => counts.real === 0);
  const myDoubles = collectionCodeSetWithPending(data, pendingTrades, counts => counts.tradeable >= 2);
  const myReservedDoubles = collectionCodeSetWithPending(data, pendingTrades, counts => counts.real >= 2 && counts.outgoing > 0);
  const myPotentialDoubles = collectionCodeSetWithPending(data, pendingTrades, counts => counts.real >= 2 && counts.tradeable < 2 && counts.outgoing > 0);

  const friendDoublesByKey = new Map(friendDoublesCards.valid.map(card => [card.key, card]));
  const friendMissingByKey = new Map(friendMissingCards.valid.map(card => [card.key, card]));
  const friendCanGive = [...myMissing.keys()]
    .filter(key => friendDoublesByKey.has(key))
    .map(key => friendDoublesByKey.get(key));
  const youCanGive = [...myDoubles.keys()]
    .filter(key => friendMissingByKey.has(key))
    .map(key => myDoubles.get(key));
  const potentiallyReceived = friendCanGive
    .filter(card => myMissing.get(card.key)?.counts.incoming > 0)
    .map(card => card.code);
  const reservedToGive = [...myReservedDoubles.keys()]
    .filter(key => friendMissingByKey.has(key))
    .map(key => myReservedDoubles.get(key).code);
  const potentiallyAvailable = [...myPotentialDoubles.keys()]
    .filter(key => friendMissingByKey.has(key))
    .map(key => myPotentialDoubles.get(key).code);

  return {
    friendCanGive: friendCanGive.map(card => card.code),
    youCanGive: youCanGive.map(card => card.code),
    proposedTrade: {
      received: friendCanGive.map(card => card.code),
      given: youCanGive.map(card => card.code)
    },
    invalid: {
      friendDoubles: [...parsedDoubles.invalid, ...friendDoublesCards.unknown],
      friendMissing: [...parsedMissing.invalid, ...friendMissingCards.unknown]
    },
    pending: {
      potentiallyReceived,
      reservedToGive,
      potentiallyAvailable
    },
    stats: {
      friendCanGiveCount: friendCanGive.length,
      youCanGiveCount: youCanGive.length
    }
  };
}

function collectExportSections(data, type) {
  const sections = [];
  const addSection = (title, cards) => {
    if (cards.length > 0) sections.push({ title, cards });
  };

  const fwcCards = data.FWC || {};
  const fwcMatching = [];
  const count00 = fwcCards['00'] ?? 0;
  if (type === 'missing' && count00 === 0) fwcMatching.push('00');
  else if (type === 'doubles' && count00 >= 2) fwcMatching.push(`00 x${count00 - 1}`);
  for (let i = 1; i <= 19; i++) {
    const count = fwcCards[String(i)] ?? 0;
    if (type === 'missing' && count === 0) fwcMatching.push(`FWC${i}`);
    else if (type === 'doubles' && count >= 2) fwcMatching.push(`FWC${i} x${count - 1}`);
  }
  addSection('Special', fwcMatching);

  for (const team of TEAMS) {
    const cards = data[team.code] || {};
    const matching = [];
    for (let i = 1; i <= 20; i++) {
      const count = cards[String(i)] ?? 0;
      if (type === 'missing' && count === 0) matching.push(`${team.code}${i}`);
      else if (type === 'doubles' && count >= 2) matching.push(`${team.code}${i} x${count - 1}`);
    }
    addSection(team.name, matching);
  }

  return sections;
}

function buildExportText(data, type, format) {
  const sections = collectExportSections(data, type);
  const cards = sections.flatMap(section => section.cards);
  const date = new Date().toLocaleDateString('fr-FR');
  const title = type === 'missing' ? 'Cartes manquantes' : 'Cartes en double';

  if (format === 'compact') {
    return cards.length ? cards.join(' ') : `${title}: aucune carte`;
  }

  if (format === 'whatsapp') {
    const icon = type === 'missing' ? '📋' : '🔄';
    const empty = type === 'missing' ? 'Aucune carte manquante.' : 'Aucun doublon disponible.';
    const body = sections.length
      ? sections.map(section => `*${section.title}*\n${section.cards.join(' ')}`).join('\n\n')
      : empty;
    return `${icon} *${title}* - ${date}\n\n${body}`;
  }

  const label = type === 'missing' ? 'CARTES MANQUANTES' : 'CARTES EN DOUBLE (exemplaires à échanger)';
  const body = sections.map(section => `[${section.title}]\n${section.cards.join(', ')}`).join('\n\n');
  return `${label} — ${date}\n${'-'.repeat(40)}\n\n${body || 'Aucune carte'}`;
}

// ─── Import ──────────────────────────────────────────────────────────────────
app.post('/api/compare', (req, res) => {
  const data = loadData();
  const results = compareWithFriend(data, req.body, loadPendingTrades());
  if (results.error) return res.status(400).json({ error: results.error });
  res.json(results);
});

app.post('/api/import', (req, res) => {
  const data = loadData();
  const results = processImport(data, req.body);
  if (results.error) return res.status(400).json({ error: results.error });

  if (results.ok.length) {
    const entry = appendCollectionHistory('import', {
      source: 'import',
      summary: `Import ${results.ok.length} carte(s)`,
      imported: results.ok,
      received: [],
      given: [],
      deltas: results.deltas
    });
    if (entry) results.historyId = entry.id;
  }

  saveData(data);
  res.json(results);
});

// ─── Trade ───────────────────────────────────────────────────────────────────
app.post('/api/trade', (req, res) => {
  const data = loadData();
  const results = processTrade(data, req.body);
  if (results.received.ok.length || results.given.ok.length) {
    const entry = appendCollectionHistory('trade', {
      source: 'trade',
      summary: `Echange +${results.received.ok.length} / -${results.given.ok.length}`,
      imported: [],
      received: results.received.ok,
      given: results.given.ok,
      deltas: results.deltas
    });
    if (entry) results.historyId = entry.id;
  }
  saveData(data);
  res.json(results);
});

app.post('/api/trade/preview', (req, res) => {
  const data = loadData();
  res.json(processTrade(cloneData(data), req.body));
});
