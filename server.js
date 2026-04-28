const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'collection.json');

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

// ─── API ────────────────────────────────────────────────────────────────────
app.get('/api/teams', (_req, res) => res.json(TEAMS));

app.get('/api/collection', (_req, res) => res.json(loadData()));

app.patch('/api/card', (req, res) => {
  const { team, card, delta } = req.body;
  const data = loadData();
  if (!data[team] || !(card in data[team])) {
    return res.status(400).json({ error: 'Invalid team or card' });
  }
  data[team][card] = Math.max(0, (data[team][card] || 0) + delta);
  saveData(data);
  res.json({ team, card, count: data[team][card] });
});

app.post('/api/reset/:team', (req, res) => {
  const { team } = req.params;
  const data = loadData();
  if (!data[team]) return res.status(400).json({ error: 'Invalid team' });
  for (const key of Object.keys(data[team])) data[team][key] = 0;
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/export/:type', (req, res) => {
  const { type } = req.params;
  const data = loadData();
  const sections = [];

  // FWC Special en premier
  const fwcCards = data['FWC'] || {};
  const fwcMatching = [];
  const count00 = fwcCards['00'] ?? 0;
  if (type === 'missing' && count00 === 0)      fwcMatching.push('00');
  else if (type === 'doubles' && count00 >= 2)  fwcMatching.push(`00 x${count00 - 1}`);
  for (let i = 1; i <= 19; i++) {
    const count = fwcCards[String(i)] ?? 0;
    if (type === 'missing' && count === 0)      fwcMatching.push(`FWC${i}`);
    else if (type === 'doubles' && count >= 2)  fwcMatching.push(`FWC${i} x${count - 1}`);
  }
  if (fwcMatching.length > 0) sections.push(`[Special]\n${fwcMatching.join(', ')}`);

  // Équipes
  for (const team of TEAMS) {
    const cards = data[team.code] || {};
    const matching = [];
    for (let i = 1; i <= 20; i++) {
      const count = cards[String(i)] ?? 0;
      if (type === 'missing' && count === 0)      matching.push(`${team.code}${i}`);
      else if (type === 'doubles' && count >= 2)  matching.push(`${team.code}${i} x${count - 1}`);
    }
    if (matching.length > 0) sections.push(`[${team.name}]\n${matching.join(', ')}`);
  }

  const label = type === 'missing' ? 'CARTES MANQUANTES' : 'CARTES EN DOUBLE (exemplaires à échanger)';
  const date = new Date().toLocaleDateString('fr-FR');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_${Date.now()}.txt"`);
  res.send(`${label} — ${date}\n${'─'.repeat(40)}\n\n${sections.join('\n\n')}`);
});

// ─── Start ───────────────────────────────────────────────────────────────────
loadData();
app.listen(PORT, () => {
  console.log(`\n🎴  Panini FIFA WC Tracker`);
  console.log(`🌐  http://localhost:${PORT}\n`);
});
