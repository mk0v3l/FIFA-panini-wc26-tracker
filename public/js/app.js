// ── State ──────────────────────────────────────────────────────────────────
let TEAMS = [];
let collection = {};
let historyEntries = [];
let currentTeam = null;
const NEARLY_COMPLETE_VIEW = '__nearly_complete__';


const FRENCH_TEAM_NAMES = {
  MEX: ['mexique'],
  RSA: ['afrique du sud'],
  KOR: ['coree du sud', 'corée du sud'],
  CZE: ['tchequie', 'tchéquie', 'republique tcheque', 'république tchèque'],
  CAN: ['canada'],
  BIH: ['bosnie', 'bosnie herzégovine', 'bosnie-herzegovine', 'bosnie-herzégovine'],
  QAT: ['qatar'],
  SUI: ['suisse'],
  BRA: ['bresil', 'brésil'],
  MAR: ['maroc'],
  HAI: ['haiti', 'haïti'],
  SCO: ['ecosse', 'écosse'],
  USA: ['etats unis', 'états unis', 'usa', 'etats-unis', 'états-unis'],
  PAR: ['paraguay'],
  AUS: ['australie'],
  TUR: ['turquie'],
  GER: ['allemagne'],
  CUW: ['curacao', 'curaçao'],
  CIV: ['cote divoire', "côte d'ivoire", 'cote d ivoire'],
  ECU: ['equateur', 'équateur'],
  NED: ['pays bas', 'pays-bas', 'hollande'],
  JPN: ['japon'],
  SWE: ['suede', 'suède'],
  TUN: ['tunisie'],
  BEL: ['belgique'],
  EGY: ['egypte', 'égypte'],
  IRN: ['iran'],
  NZL: ['nouvelle zelande', 'nouvelle-zélande', 'nouvelle zélande'],
  ESP: ['espagne'],
  CPV: ['cap vert', 'cap-vert'],
  KSA: ['arabie saoudite'],
  URU: ['uruguay'],
  FRA: ['france'],
  SEN: ['senegal', 'sénégal'],
  IRQ: ['irak'],
  NOR: ['norvege', 'norvège'],
  ARG: ['argentine'],
  ALG: ['algerie', 'algérie'],
  AUT: ['autriche'],
  JOR: ['jordanie'],
  POR: ['portugal'],
  COD: ['congo', 'rd congo', 'republique democratique du congo', 'république démocratique du congo'],
  UZB: ['ouzbekistan'],
  COL: ['colombie'],
  ENG: ['angleterre'],
  CRO: ['croatie'],
  GHA: ['ghana'],
  PAN: ['panama'],
  FWC: ['special', 'spécial', 'fwc']
};

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamMatchesSearch(team, query) {
  if (!query) return true;

  const aliases = [
    team.code,
    team.name,
    ...(FRENCH_TEAM_NAMES[team.code] || [])
  ];

  return aliases.some(alias => normalizeSearchText(alias).includes(query));
}

// Country flag emoji helper (ISO 3166-1 alpha-2)
const FLAG_MAP = {
  MEX:'🇲🇽', RSA:'🇿🇦', KOR:'🇰🇷', CZE:'🇨🇿',
  CAN:'🇨🇦', BIH:'🇧🇦', QAT:'🇶🇦', SUI:'🇨🇭',
  BRA:'🇧🇷', MAR:'🇲🇦', HAI:'🇭🇹', SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  USA:'🇺🇸', PAR:'🇵🇾', AUS:'🇦🇺', TUR:'🇹🇷',
  GER:'🇩🇪', CUW:'🇨🇼', CIV:'🇨🇮', ECU:'🇪🇨',
  NED:'🇳🇱', JPN:'🇯🇵', SWE:'🇸🇪', TUN:'🇹🇳',
  BEL:'🇧🇪', EGY:'🇪🇬', IRN:'🇮🇷', NZL:'🇳🇿',
  ESP:'🇪🇸', CPV:'🇨🇻', KSA:'🇸🇦', URU:'🇺🇾',
  FRA:'🇫🇷', SEN:'🇸🇳', IRQ:'🇮🇶', NOR:'🇳🇴',
  ARG:'🇦🇷', ALG:'🇩🇿', AUT:'🇦🇹', JOR:'🇯🇴',
  POR:'🇵🇹', COD:'🇨🇩', UZB:'🇺🇿', COL:'🇨🇴',
  ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO:'🇭🇷', GHA:'🇬🇭', PAN:'🇵🇦',
  FWC:'⭐',
};

// ── API helpers ────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, options);
  return res.json();
}

async function patchCard(team, card, delta, source = 'manual_click') {
  return api('/api/card', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team, card, delta, source }),
  });
}

async function resetTeam(code) {
  return api(`/api/reset/${code}`, { method: 'POST' });
}

async function undoLast() {
  return api('/api/undo-last', { method: 'POST' });
}

// ── Progress calculation ───────────────────────────────────────────────────
function teamProgress(code) {
  const cards = collection[code];
  if (!cards) return { owned: 0, total: 0, doubles: 0 };
  const vals = Object.values(cards);
  const owned   = vals.filter(v => v > 0).length;
  const doubles = vals.filter(v => v >= 2).reduce((s, v) => s + (v - 1), 0);
  return { owned, total: vals.length, doubles };
}

function globalProgress() {
  let owned = 0, total = 0, doubles = 0;
  const codes = [...TEAMS.map(t => t.code), 'FWC'];

  for (const code of codes) {
    const p = teamProgress(code);
    owned += p.owned;
    total += p.total;
    doubles += p.doubles;
  }

  return { owned, total, doubles };
}

function dashboardStats() {
  const progress = globalProgress();
  const codes = [...TEAMS.map(team => team.code), 'FWC'];
  let completeTeams = 0;

  for (const code of codes) {
    const team = teamProgress(code);
    if (team.total > 0 && team.owned === team.total) completeTeams++;
  }

  return {
    ...progress,
    missing: Math.max(0, progress.total - progress.owned),
    percent: pct(progress.owned, progress.total),
    completeTeams,
    nearlyCompleteTeams: nearlyCompleteTeams(4).length
  };
}

function pct(owned, total) {
  return total === 0 ? 0 : Math.round((owned / total) * 100);
}

function progressColor(p) {
  if (p === 100) return '#2ea043';
  if (p >= 60)   return '#f0883e';
  if (p >= 30)   return '#58a6ff';
  return '#484f58';
}

// ── Quick card search ──────────────────────────────────────────────────────
function getTeamMeta(code) {
  if (code === 'FWC') {
    return { code: 'FWC', name: 'FWC Special', group: '★', color: '#1f6feb' };
  }
  return TEAMS.find(team => team.code === code) || null;
}

function normalizeCardCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    .replace(/^FCW/, 'FWC');
}

function parseCardCode(raw) {
  const s = normalizeCardCode(raw);
  if (!s) return null;
  if (s === '00') return { team: 'FWC', card: '00', code: '00' };
  if (s.startsWith('FWC')) {
    if (s === 'FWC00') return { team: 'FWC', card: '00', code: '00' };
    const match = s.match(/^FWC0*(\d+)$/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 19) return { team: 'FWC', card: String(n), code: `FWC${n}` };
    return null;
  }

  const teamCodes = TEAMS.map(team => team.code).sort((a, b) => b.length - a.length);
  for (const code of teamCodes) {
    if (!s.startsWith(code)) continue;
    const match = s.slice(code.length).match(/^0*(\d+)$/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 20) {
      return { team: code, card: String(n), code: `${code}${n}` };
    }
  }
  return null;
}

function cardStatus(count) {
  if (count <= 0) return { label: 'Manquante', cls: 'missing' };
  if (count === 1) return { label: 'Possédée', cls: 'owned' };
  return { label: 'Doublon', cls: 'double' };
}

function findRenderedCard(teamCode, cardKey) {
  return document.querySelector(`.sticker-card[data-team="${teamCode}"][data-card="${cardKey}"]`);
}

function renderQuickCardSearch() {
  const input = document.getElementById('quick-card-search');
  const result = document.getElementById('quick-card-result');
  if (!input || !result) return;

  const raw = input.value;
  if (!raw.trim()) {
    result.className = 'quick-card-result empty';
    result.textContent = 'Saisissez un code carte.';
    return;
  }

  const parsed = parseCardCode(raw);
  if (!parsed || !collection[parsed.team] || !(parsed.card in collection[parsed.team])) {
    result.className = 'quick-card-result invalid';
    result.textContent = 'Code carte invalide.';
    return;
  }

  const team = getTeamMeta(parsed.team);
  const count = collection[parsed.team][parsed.card] ?? 0;
  const status = cardStatus(count);
  const sectionLabel = parsed.team === 'FWC'
    ? 'Section spéciale'
    : `Pays ${team.name}`;

  result.className = 'quick-card-result';
  result.innerHTML = `
    <div class="quick-card-main">
      <div>
        <div class="quick-card-code">${parsed.code}</div>
        <div class="quick-card-team">${sectionLabel}</div>
      </div>
      <span class="quick-card-status ${status.cls}">${status.label}</span>
    </div>
    <div class="quick-card-meta">
      Quantité actuelle : <strong>${count}</strong>
    </div>
    <div class="quick-card-actions">
      <button type="button" class="quick-card-btn add" onclick="adjustQuickCard(1)">+1</button>
      <button type="button" class="quick-card-btn remove" onclick="adjustQuickCard(-1)" ${count <= 0 ? 'disabled' : ''}>-1</button>
      <button type="button" class="quick-card-btn goto" onclick="goToQuickCard()">Aller à la page du pays</button>
    </div>`;
}

function handleQuickCardSearch() {
  renderQuickCardSearch();
}

function getQuickSearchCard() {
  const input = document.getElementById('quick-card-search');
  if (!input) return null;
  const parsed = parseCardCode(input.value);
  if (!parsed || !collection[parsed.team] || !(parsed.card in collection[parsed.team])) return null;
  return parsed;
}

function goToQuickCard() {
  const parsed = getQuickSearchCard();
  if (!parsed) {
    renderQuickCardSearch();
    return;
  }
  navigateTo(parsed.team);
}

async function adjustQuickCard(delta) {
  const parsed = getQuickSearchCard();
  if (!parsed) {
    renderQuickCardSearch();
    return;
  }
  await applyCardDelta(parsed.team, parsed.card, delta, findRenderedCard(parsed.team, parsed.card), 'quick_search');
}

// ── Sidebar rendering ──────────────────────────────────────────────────────
function renderNav() {
  const nav = document.getElementById('team-nav');
  nav.innerHTML = '';

  const searchInput = document.getElementById('team-search');
  const query = normalizeSearchText(searchInput ? searchInput.value : '');

  // Vue d'ensemble toujours visible
  const ovItem = document.createElement('div');
  ovItem.className = 'nav-item' + (currentTeam === null ? ' active' : '');
  ovItem.innerHTML = `<span class="nav-item-flag">🏠</span>
    <div class="nav-item-info">
      <div class="nav-item-name">Vue d'ensemble</div>
    </div>`;
  ovItem.onclick = () => navigateTo(null);
  nav.appendChild(ovItem);

  const nearlyItem = document.createElement('div');
  nearlyItem.className = 'nav-item' + (currentTeam === NEARLY_COMPLETE_VIEW ? ' active' : '');
  nearlyItem.innerHTML = `<span class="nav-item-flag">🎯</span>
    <div class="nav-item-info">
      <div class="nav-item-name">Pays presque terminés</div>
    </div>`;
  nearlyItem.onclick = navigateToNearlyComplete;
  nav.appendChild(nearlyItem);

  // Teams filtrées par groupe
  const groups = [...new Set(TEAMS.map(t => t.group))];

  let visibleCount = 0;

  for (const group of groups) {
    const teamsInGroup = TEAMS
      .filter(t => t.group === group)
      .filter(t => teamMatchesSearch(t, query));

    if (!teamsInGroup.length) continue;

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = `Groupe ${group}`;
    nav.appendChild(header);

    for (const team of teamsInGroup) {
      nav.appendChild(makeNavItem(team));
      visibleCount++;
    }
  }

  // FWC Special
  const fwcTeam = {
    code: 'FWC',
    name: 'FWC Special',
    group: 'FWC',
    color: '#1f6feb'
  };

  if (teamMatchesSearch(fwcTeam, query)) {
    const fwcHeader = document.createElement('div');
    fwcHeader.className = 'group-header nav-item-special';
    fwcHeader.style.paddingTop = '12px';
    fwcHeader.textContent = 'Spécial';
    nav.appendChild(fwcHeader);
    nav.appendChild(makeNavItem(fwcTeam));
    visibleCount++;
  }

  // Message si aucun résultat
  if (query && visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'nav-empty';
    empty.textContent = 'Aucun pays trouvé';
    nav.appendChild(empty);
  }
}

function makeNavItem(team) {
  const p = teamProgress(team.code);
  const progress = pct(p.owned, p.total);
  const item = document.createElement('div');
  item.className = 'nav-item' + (currentTeam === team.code ? ' active' : '');
  item.dataset.code = team.code;
  item.innerHTML = `
    <span class="nav-item-flag">${FLAG_MAP[team.code] || '🏳'}</span>
    <div class="nav-item-info">
      <div class="nav-item-name">${team.name}</div>
      <div class="nav-item-code">${team.code} · ${progress}%</div>
    </div>
    <div class="nav-mini-bar">
      <div class="nav-mini-fill" style="width:${progress}%;background:${progressColor(progress)}"></div>
    </div>`;
  item.onclick = () => navigateTo(team.code);
  return item;
}

function updateNavItem(code) {
  const p = teamProgress(code);
  const progress = pct(p.owned, p.total);
  const item = document.querySelector(`.nav-item[data-code="${code}"]`);
  if (!item) return;
  const codeEl  = item.querySelector('.nav-item-code');
  const fillEl  = item.querySelector('.nav-mini-fill');
  if (codeEl) codeEl.textContent = `${code} · ${progress}%`;
  if (fillEl) {
    fillEl.style.width = `${progress}%`;
    fillEl.style.background = progressColor(progress);
  }
}

function updateGlobalProgress() {
  const { owned, total, doubles } = globalProgress();
  const p = pct(owned, total);

  document.getElementById('global-pct').textContent = `${p}%`;
  document.getElementById('global-bar').style.width = `${p}%`;

  document.getElementById('global-counts').textContent =
    `${owned} / ${total} stickers · ${doubles} doublon${doubles > 1 ? 's' : ''}`;

  document.getElementById('mobile-progress-text').textContent = `${p}%`;
}

function refreshCollectionViews() {
  renderNav();
  renderOverview();
  renderNearlyCompletePage();
  updateGlobalProgress();
  if (currentTeam === NEARLY_COMPLETE_VIEW) {
    document.getElementById('mobile-title').textContent = 'Pays presque terminés';
  }
  if (currentTeam && currentTeam !== NEARLY_COMPLETE_VIEW) renderTeamPage(currentTeam);
}

async function refreshHistory() {
  historyEntries = await api('/api/history');
  renderHistory();
  renderDashboardHistory();
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function historyTitle(entry) {
  const titles = {
    import: 'Import',
    trade: 'Echange',
    manual_add: 'Ajout manuel',
    manual_remove: 'Retrait manuel',
    reset: 'Reset',
    undo: 'Annulation'
  };
  return titles[entry.type] || 'Action';
}

function canUndoHistoryEntry(entry) {
  return entry.type !== 'undo' && Array.isArray(entry.deltas) && entry.deltas.length > 0;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const undoBtn = document.getElementById('undo-last-btn');
  if (!list || !undoBtn) return;

  undoBtn.disabled = !historyEntries.some(canUndoHistoryEntry);
  if (!historyEntries.length) {
    list.innerHTML = '<div class="history-empty">Aucune action récente</div>';
    return;
  }

  list.innerHTML = historyEntries.slice(0, 5).map(entry => {
    const count = Array.isArray(entry.deltas)
      ? entry.deltas.reduce((sum, delta) => sum + Math.abs(delta.delta || 0), 0)
      : 0;
    const title = historyTitle(entry);
    const parts = [];
    if (entry.summary) parts.push(entry.summary);
    if (entry.imported && entry.imported.length) parts.push(`${entry.imported.length} importée(s)`);
    if (entry.received && entry.received.length) parts.push(`${entry.received.length} reçue(s)`);
    if (entry.given && entry.given.length) parts.push(`${entry.given.length} donnée(s)`);
    if (!parts.length && count) parts.push(`${count} modification(s)`);

    return `<div class="history-item">
      <div class="history-item-title">
        <span>${title}</span>
        <span>${formatHistoryDate(entry.date)}</span>
      </div>
      <div class="history-item-meta">${parts.join(' · ') || 'Action enregistrée'}</div>
    </div>`;
  }).join('');
}

// ── Overview page ──────────────────────────────────────────────────────────
function renderOverview() {
  document.getElementById('mobile-title').textContent = 'Vue d\'ensemble';
  const grid = document.getElementById('overview-grid');
  grid.innerHTML = '';
  renderDashboard();
  renderQuickCardSearch();

  const allTeams = [...TEAMS, { code: 'FWC', name: 'FWC Special', group: '★', color: '#1f6feb' }];

  for (const team of allTeams) {
    const p = teamProgress(team.code);
    const progress = pct(p.owned, p.total);
    const color = team.color || '#238636';

    const card = document.createElement('div');
    card.className = 'overview-card';
    card.dataset.code = team.code;
    card.innerHTML = `
      <div class="ov-header">
        <span class="ov-flag">${FLAG_MAP[team.code] || '🏳'}</span>
        <div>
          <div class="ov-name">${team.name}</div>
          <div class="ov-code">${team.code}</div>
        </div>
        <span class="ov-group">Gr.${team.group}</span>
      </div>
      <div class="ov-progress-bar">
        <div class="ov-progress-fill" style="width:${progress}%;background:${color}"></div>
      </div>
      <div class="ov-stats">
        <span><span class="ov-owned">${p.owned}</span> / ${p.total}</span>
        <span>${progress}%</span>
      </div>`;
    card.onclick = () => navigateTo(team.code);
    grid.appendChild(card);
  }
}

function formatHistorySummary(entry) {
  const count = Array.isArray(entry.deltas)
    ? entry.deltas.reduce((sum, delta) => sum + Math.abs(delta.delta || 0), 0)
    : 0;
  const parts = [];
  if (entry.summary) parts.push(entry.summary);
  if (entry.imported && entry.imported.length) parts.push(`${entry.imported.length} importée(s)`);
  if (entry.received && entry.received.length) parts.push(`${entry.received.length} reçue(s)`);
  if (entry.given && entry.given.length) parts.push(`${entry.given.length} donnée(s)`);
  if (!parts.length && count) parts.push(`${count} modification(s)`);
  return parts.join(' · ') || 'Action enregistrée';
}

function renderDashboardHistory() {
  const list = document.getElementById('dashboard-history');
  if (!list) return;

  if (!historyEntries.length) {
    list.innerHTML = '<div class="dashboard-empty">Aucune activité récente</div>';
    return;
  }

  list.innerHTML = historyEntries.slice(0, 4).map(entry => {
    const title = historyTitle(entry);
    return `<div class="dashboard-history-item">
      <div class="dashboard-history-title">
        <span>${title}</span>
        <span>${formatHistoryDate(entry.date)}</span>
      </div>
      <div class="dashboard-history-meta">${formatHistorySummary(entry)}</div>
    </div>`;
  }).join('');
}

function renderDashboard() {
  const statsEl = document.getElementById('dashboard-stats');
  if (!statsEl) return;

  const stats = dashboardStats();
  const statCards = [
    { label: 'Progression totale', value: `${stats.percent}%` },
    { label: 'Possédées', value: stats.owned },
    { label: 'Manquantes', value: stats.missing },
    { label: 'Doublons', value: stats.doubles },
    { label: 'Pays complets', value: stats.completeTeams },
    { label: 'Presque terminés', value: stats.nearlyCompleteTeams }
  ];

  statsEl.innerHTML = statCards.map(stat => `
    <div class="dashboard-stat">
      <div class="dashboard-stat-value">${stat.value}</div>
      <div class="dashboard-stat-label">${stat.label}</div>
    </div>
  `).join('');

  renderDashboardHistory();
}

function focusQuickCardSearch() {
  navigateTo(null);
  const input = document.getElementById('quick-card-search');
  if (!input) return;
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Nearly complete countries page ────────────────────────────────────────
function cardDisplayCode(teamCode, cardKey) {
  if (teamCode === 'FWC') return cardKey === '00' ? '00' : `FWC${cardKey}`;
  return `${teamCode}${cardKey}`;
}

function getCardOrder(code) {
  return code === 'FWC'
    ? ['00', ...Array.from({ length: 19 }, (_, i) => String(i + 1))]
    : Array.from({ length: 20 }, (_, i) => String(i + 1));
}

function missingCardsForTeam(code) {
  const cards = collection[code] || {};
  return getCardOrder(code)
    .filter(cardKey => (cards[cardKey] ?? 0) === 0)
    .map(cardKey => cardDisplayCode(code, cardKey));
}

function nearlyCompleteTeams(threshold) {
  return [...TEAMS, getTeamMeta('FWC')]
    .map(team => {
      const progress = teamProgress(team.code);
      const missing = missingCardsForTeam(team.code);
      return {
        ...team,
        owned: progress.owned,
        total: progress.total,
        percent: pct(progress.owned, progress.total),
        missing
      };
    })
    .filter(team => team.missing.length >= 1 && team.missing.length <= threshold)
    .sort((a, b) => a.missing.length - b.missing.length || b.percent - a.percent || a.name.localeCompare(b.name));
}

function renderNearlyCompletePage() {
  const list = document.getElementById('nearly-list');
  if (!list) return;

  const thresholdEl = document.getElementById('nearly-threshold');
  const threshold = Number(thresholdEl ? thresholdEl.value : 4) || 4;
  const teams = nearlyCompleteTeams(threshold);

  if (!teams.length) {
    list.innerHTML = '<div class="nearly-empty">Aucun pays ne correspond à ce seuil.</div>';
    return;
  }

  list.innerHTML = teams.map(team => `
    <article class="nearly-card">
      <div class="nearly-card-main">
        <span class="nearly-flag">${FLAG_MAP[team.code] || '🏳'}</span>
        <div class="nearly-info">
          <div class="nearly-name">${team.name}</div>
          <div class="nearly-progress">${team.owned}/${team.total} · ${team.percent}%</div>
        </div>
        <button type="button" class="nearly-goto" onclick="navigateTo('${team.code}')">Aller au pays</button>
      </div>
      <div class="nearly-bar">
        <div class="nearly-fill" style="width:${team.percent}%;background:${team.color || '#238636'}"></div>
      </div>
      <div class="nearly-missing">
        ${team.missing.map(code => `<span>${code}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function updateOverviewCard(code) {
  const card = document.querySelector(`.overview-card[data-code="${code}"]`);
  if (!card) return;
  const team = code === 'FWC'
    ? { code: 'FWC', color: '#1f6feb' }
    : TEAMS.find(t => t.code === code);
  const p = teamProgress(code);
  const progress = pct(p.owned, p.total);
  const color = team?.color || '#238636';
  const fill = card.querySelector('.ov-progress-fill');
  const stats = card.querySelector('.ov-stats');
  const ownedEl = card.querySelector('.ov-owned');
  if (fill)    fill.style.width = `${progress}%`;
  if (fill)    fill.style.background = color;
  if (ownedEl) ownedEl.textContent = p.owned;
  if (stats) {
    const spans = stats.querySelectorAll('span');
    if (spans[1]) spans[1].textContent = `${progress}%`;
  }
}
// ── Navigation pays précédent / suivant ───────────────────────────────────
function getTeamOrder() {
  // Même ordre que dans la navigation : tous les pays, puis FWC Special à la fin
  return [...TEAMS.map(t => t.code), 'FWC'];
}

function getAdjacentTeamCode(code, delta) {
  const order = getTeamOrder();
  const index = order.indexOf(code);

  if (index === -1) return null;

  // Navigation circulaire :
  // avant le premier = dernier, après le dernier = premier
  return order[(index + delta + order.length) % order.length];
}

function navigateAdjacentTeam(delta) {
  if (!currentTeam || currentTeam === NEARLY_COMPLETE_VIEW) return;

  const nextCode = getAdjacentTeamCode(currentTeam, delta);
  if (!nextCode) return;

  navigateTo(nextCode);
}
// ── Team / FWC page ────────────────────────────────────────────────────────
function renderTeamPage(code) {
  const isSpecial = code === 'FWC';
  const team = isSpecial
    ? { code: 'FWC', name: 'FWC Special', group: '★', color: '#1f6feb' }
    : TEAMS.find(t => t.code === code);

  document.getElementById('mobile-title').textContent = team.name;

  const page = document.getElementById('team-page');
  const cards = collection[code] || {};
  const p = teamProgress(code);
  const progress = pct(p.owned, p.total);
  const color = team.color || '#238636';
  const flag = FLAG_MAP[code] || '🏳';
  const prevCode = getAdjacentTeamCode(code, -1);
  const nextCode = getAdjacentTeamCode(code, +1);

  const prevFlag = FLAG_MAP[prevCode] || '◀';
  const nextFlag = FLAG_MAP[nextCode] || '▶';

  // Ordre des cartes : équipes = 1-20 ; FWC special = 00 puis FWC1-FWC19
  const cardKeys = isSpecial
    ? ['00', ...Array.from({ length: 19 }, (_, i) => String(i + 1))]
    : Array.from({ length: 20 }, (_, i) => String(i + 1));

  // Label affiché sur la carte (FWC special : "00" ou "FWC1"…"FWC19")
  const cardLabel = (key) => {
    if (!isSpecial) return key;
    return key === '00' ? '00' : `FWC${key}`;
  };

  page.innerHTML = `
    <div class="team-page-header">
      <span class="team-flag-large">${flag}</span>
      <div class="team-info">
        <div class="team-name-large">${team.name}</div>
        <div class="team-meta">${isSpecial ? 'Cartes spéciales' : `Groupe ${team.group} · ${code}`} · ${p.total} stickers</div>
        <div class="team-progress-bar">
          <div class="team-progress-fill" id="team-prog-fill" style="width:${progress}%;background:${color}"></div>
        </div>
        <div class="team-stats" id="team-stats-text">
          <strong>${p.owned}</strong> collectées · <strong>${p.doubles}</strong> doublons · ${progress}%
        </div>
      </div>
      <div class="team-actions">
  <button class="team-btn nav-team-btn" onclick="navigateAdjacentTeam(-1)" title="Pays précédent">
    ← ${prevFlag} ${prevCode}
  </button>

  <button class="team-btn nav-team-btn" onclick="navigateAdjacentTeam(1)" title="Pays suivant">
    ${nextCode} ${nextFlag} →
  </button>

  <button class="team-btn reset-btn" onclick="confirmReset('${code}')">🗑 Reset</button>
</div>
    </div>

    <div class="cards-grid" id="cards-grid-${code}"></div>`;

  const grid = document.getElementById(`cards-grid-${code}`);
  for (const key of cardKeys) {
    const count = cards[key] ?? 0;
    grid.appendChild(makeCardEl(code, key, count, isSpecial, cardLabel(key)));
  }
}

function makeCardEl(teamCode, cardKey, count, isSpecial = false, label = null) {
  const displayLabel = label ?? cardKey;
  const stateClass = count === 0 ? 'state-0' : count === 1 ? 'state-1' : 'state-2';
  const fwcClass   = isSpecial ? ' fwc-card' : '';
  const checkEl    = count > 0 ? `<span class="card-check">✓</span>` : '';
  const badgeEl    = count >= 2 ? `<span class="card-badge">x${count - 1}</span>` : '';

  const el = document.createElement('div');
  el.className = `sticker-card ${stateClass}${fwcClass}`;
  el.dataset.team = teamCode;
  el.dataset.card = cardKey;
  el.innerHTML = `${badgeEl}<span class="card-num">${displayLabel}</span>${checkEl}`;

  // Touch / click handling
  let pressTimer = null;
  let didLongPress = false;

  const startPress = () => {
    didLongPress = false;
    pressTimer = setTimeout(() => {
      didLongPress = true;
      el.classList.add('pressing');
      handleCardAction(teamCode, cardKey, -1, el);
    }, 500);
  };
  const endPress = () => {
    clearTimeout(pressTimer);
    el.classList.remove('pressing');
  };
  const doTap = () => {
    if (!didLongPress) handleCardAction(teamCode, cardKey, +1, el);
  };

  el.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); }, { passive: false });
  el.addEventListener('touchend',   (e) => { e.preventDefault(); endPress(); doTap(); });
  el.addEventListener('touchcancel', endPress);

  el.addEventListener('mousedown',  startPress);
  el.addEventListener('mouseup',    endPress);
  el.addEventListener('mouseleave', endPress);
  el.addEventListener('click',      doTap);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleCardAction(teamCode, cardKey, -1, el);
  });

  return el;
}

async function handleCardAction(teamCode, cardKey, delta, el) {
  await applyCardDelta(teamCode, cardKey, delta, el, 'manual_click');
}

async function applyCardDelta(teamCode, cardKey, delta, el = null, source = 'manual_click') {
  const current = collection[teamCode][cardKey] ?? 0;
  const next = Math.max(0, current + delta);
  if (next === current) return;

  collection[teamCode][cardKey] = next;
  const cardEl = el || findRenderedCard(teamCode, cardKey);
  if (cardEl) updateCardEl(cardEl, teamCode, cardKey, next);
  updateTeamStats(teamCode);
  updateNavItem(teamCode);
  updateOverviewCard(teamCode);
  updateGlobalProgress();
  renderQuickCardSearch();
  renderNearlyCompletePage();
  renderDashboard();

  if (delta > 0) {
    const msgs = next === 1 ? '✅ Collée !' : `📦 Double x${next - 1}`;
    showToast(msgs);
  } else {
    showToast('↩️ Retirée');
  }

  // Sync with server (fire-and-forget)
  patchCard(teamCode, cardKey, delta, source).then(refreshHistory).catch(() => {
    // Rollback on error
    collection[teamCode][cardKey] = current;
    if (cardEl) updateCardEl(cardEl, teamCode, cardKey, current);
    updateTeamStats(teamCode);
    updateNavItem(teamCode);
    updateOverviewCard(teamCode);
    updateGlobalProgress();
    renderQuickCardSearch();
    renderNearlyCompletePage();
    renderDashboard();
    showToast('⚠️ Erreur de sauvegarde');
  });
}

function updateCardEl(el, teamCode, cardKey, count) {
  el.className = el.className.replace(/state-\d/, '');
  const stateClass = count === 0 ? 'state-0' : count === 1 ? 'state-1' : 'state-2';
  el.classList.add(stateClass);

  const isFwc = teamCode === 'FWC';
  const displayLabel = isFwc && cardKey !== '00' ? `FWC${cardKey}` : cardKey;
  const checkEl = count > 0 ? `<span class="card-check">✓</span>` : '';
  const badgeEl = count >= 2 ? `<span class="card-badge">x${count - 1}</span>` : '';
  el.innerHTML = `${badgeEl}<span class="card-num">${displayLabel}</span>${checkEl}`;
}

function updateTeamStats(code) {
  const fillEl = document.getElementById('team-prog-fill');
  const statsEl = document.getElementById('team-stats-text');
  if (!fillEl || !statsEl) return;

  const p = teamProgress(code);
  const progress = pct(p.owned, p.total);
  const team = code === 'FWC' ? { color: '#1f6feb' } : TEAMS.find(t => t.code === code);
  fillEl.style.width = `${progress}%`;
  fillEl.style.background = team?.color || '#238636';
  statsEl.innerHTML = `<strong>${p.owned}</strong> collectées · <strong>${p.doubles}</strong> doublons · ${progress}%`;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function navigateTo(code) {
  currentTeam = code;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (code === null) {
    document.querySelector('.nav-item:first-child')?.classList.add('active');
  } else {
    document.querySelector(`.nav-item[data-code="${code}"]`)?.classList.add('active');
  }

  const ovPage     = document.getElementById('overview-page');
  const nearlyPage = document.getElementById('nearly-page');
  const teamPage   = document.getElementById('team-page');

  if (code === null) {
    ovPage.classList.add('active');
    nearlyPage.classList.remove('active');
    teamPage.classList.remove('active');
  } else {
    ovPage.classList.remove('active');
    nearlyPage.classList.remove('active');
    teamPage.classList.add('active');
    renderTeamPage(code);
  }

  closeSidebar();
}

function navigateToNearlyComplete() {
  currentTeam = NEARLY_COMPLETE_VIEW;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  renderNav();

  document.getElementById('overview-page').classList.remove('active');
  document.getElementById('team-page').classList.remove('active');
  document.getElementById('nearly-page').classList.add('active');
  document.getElementById('mobile-title').textContent = 'Pays presque terminés';
  renderNearlyCompletePage();
  closeSidebar();
}

// ── Reset ──────────────────────────────────────────────────────────────────
async function confirmReset(code) {
  if (!confirm(`Remettre à zéro toutes les cartes de ${code} ?`)) return;
  await resetTeam(code);
  for (const key of Object.keys(collection[code])) collection[code][key] = 0;
  renderTeamPage(code);
  updateNavItem(code);
  updateOverviewCard(code);
  updateGlobalProgress();
  renderQuickCardSearch();
  renderNearlyCompletePage();
  renderDashboard();
  showToast('🗑 Équipe réinitialisée');
}

// ── Mobile sidebar ─────────────────────────────────────────────────────────
document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

// ── Export vers presse-papier ──────────────────────────────────────────────
// ── Export vers presse-papier ──────────────────────────────────────────────
async function copyExport(type) {
  const label = type === 'missing' ? 'cartes manquantes' : 'doublons';
  const formatEl = document.getElementById('export-format');
  const format = formatEl ? formatEl.value : 'grouped';

  try {
    const res = await fetch(`/api/export/${type}?format=${encodeURIComponent(format)}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();

    const ok = await tryCopyText(text);

    if (ok) {
      showToast(`📋 ${label} copiés (${format})`);
      return;
    }

    // Si le navigateur bloque la copie auto, on affiche une zone de copie manuelle
    showCopyFallback(text, label);
    showToast('⚠️ Copie auto bloquée, copiez depuis la fenêtre ouverte');
  } catch (err) {
    console.error(err);
    showToast(`⚠️ Impossible de récupérer les ${label}`);
  }
}

async function tryCopyText(text) {
  // Méthode moderne : marche surtout en HTTPS ou localhost
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard failed:', err);
    }
  }

  // Fallback pour HTTP / IP locale
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');

  // Important : pas display:none, sinon iPhone/Safari refuse souvent
  textarea.style.position = 'fixed';
  textarea.style.top = '20px';
  textarea.style.left = '20px';
  textarea.style.width = '2px';
  textarea.style.height = '2px';
  textarea.style.opacity = '0.01';
  textarea.style.zIndex = '-1';

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;

  try {
    ok = document.execCommand('copy');
  } catch (err) {
    console.warn('execCommand copy failed:', err);
    ok = false;
  }

  document.body.removeChild(textarea);

  return ok;
}

function showCopyFallback(text, label) {
  const old = document.getElementById('copy-fallback-modal');
  if (old) old.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'copy-fallback-modal';

  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0';
  backdrop.style.background = 'rgba(0, 0, 0, 0.55)';
  backdrop.style.zIndex = '9999';
  backdrop.style.display = 'flex';
  backdrop.style.alignItems = 'center';
  backdrop.style.justifyContent = 'center';
  backdrop.style.padding = '16px';

  const box = document.createElement('div');
  box.style.background = '#111827';
  box.style.color = 'white';
  box.style.borderRadius = '14px';
  box.style.padding = '16px';
  box.style.width = 'min(700px, 100%)';
  box.style.maxHeight = '85vh';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '12px';

  const title = document.createElement('div');
  title.textContent = `Copie des ${label}`;
  title.style.fontWeight = '700';
  title.style.fontSize = '18px';

  const help = document.createElement('div');
  help.textContent = 'La copie automatique est bloquée par le navigateur. Le texte est sélectionné : faites Ctrl+C sur PC, ou appui long puis Copier sur téléphone.';
  help.style.fontSize = '14px';
  help.style.opacity = '0.85';

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.width = '100%';
  textarea.style.height = '45vh';
  textarea.style.borderRadius = '10px';
  textarea.style.padding = '12px';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '14px';
  textarea.style.resize = 'vertical';

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '8px';
  buttons.style.justifyContent = 'flex-end';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copier maintenant';
  copyBtn.type = 'button';
  copyBtn.style.padding = '10px 14px';
  copyBtn.style.borderRadius = '10px';
  copyBtn.style.cursor = 'pointer';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.type = 'button';
  closeBtn.style.padding = '10px 14px';
  closeBtn.style.borderRadius = '10px';
  closeBtn.style.cursor = 'pointer';

  copyBtn.onclick = async () => {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let ok = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textarea.value);
        ok = true;
      } catch (err) {
        ok = false;
      }
    }

    if (!ok) {
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
    }

    if (ok) {
      showToast(`📋 ${label} copiés`);
      backdrop.remove();
    } else {
      showToast('⚠️ Copie encore bloquée : utilisez Ctrl+C ou appui long > Copier');
    }
  };

  closeBtn.onclick = () => backdrop.remove();

  buttons.appendChild(copyBtn);
  buttons.appendChild(closeBtn);

  box.appendChild(title);
  box.appendChild(help);
  box.appendChild(textarea);
  box.appendChild(buttons);

  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  setTimeout(() => {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
  }, 100);
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  [TEAMS, collection, historyEntries] = await Promise.all([
    api('/api/teams'),
    api('/api/collection'),
    api('/api/history'),
  ]);

  renderNav();
  renderOverview();
  updateGlobalProgress();
  renderHistory();
}

init();

// ── Modal ──────────────────────────────────────────────────────────────────
let activeTab = 'compare';
let lastCompareTrade = { received: [], given: [] };

function openModal() {
  document.getElementById('modal-backdrop').classList.add('open');
  switchTab('compare');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('trade-result').innerHTML = '';
  document.getElementById('compare-result').innerHTML = '';
  document.getElementById('import-input').value = '';
  document.getElementById('trade-received').value = '';
  document.getElementById('trade-given').value = '';
  document.getElementById('trade-allow-unique').checked = false;
  document.getElementById('compare-friend-doubles').value = '';
  document.getElementById('compare-friend-missing').value = '';

  lastCompareTrade = { received: [], given: [] };
  pendingTradeKey = null;
  document.getElementById('btn-trade').textContent = "Confirmer l'échange";
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.modal-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.getElementById('tab-import').classList.toggle('active', tab === 'import');
  document.getElementById('tab-trade').classList.toggle('active',  tab === 'trade');
  document.getElementById('tab-compare').classList.toggle('active', tab === 'compare');
  document.getElementById('btn-import').style.display = tab === 'import' ? '' : 'none';
  document.getElementById('btn-trade').style.display  = tab === 'trade'  ? '' : 'none';
  document.getElementById('btn-compare').style.display = tab === 'compare' ? '' : 'none';
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('trade-result').innerHTML  = '';
}

// Parse raw text into array of card codes
// Accepte les listes separees par espaces, retours ligne, virgules, etc.
// Ignore aussi les entetes d'export et les compteurs du type "x1".
function parseInput(text) {
  const teamCodes = [...TEAMS.map(t => t.code), 'FWC', 'FCW']
    .sort((a, b) => b.length - a.length)
    .join('|');

  const cleaned = text
    .replace(/\([^)]*\)/g, ' ')        // ignore les anciennes notes entre parentheses
    .replace(/\bx\s*\d+\b/gi, ' '); // ignore les compteurs: x1, x2...

  const re = new RegExp(`\\b(?:00|(?:${teamCodes})\\s*0*\\d{1,2})\\b`, 'gi');

  return [...cleaned.matchAll(re)]
    .map(m => m[0].toUpperCase().replace(/[\s_-]+/g, '').replace(/^FCW/, 'FWC'))
    .filter(Boolean);
}

// Render result box
function renderResult(containerId, rows) {
  const box = document.getElementById(containerId);
  if (!rows.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="result-box">${
    rows.map(r => `<div class="result-row">
      <span class="result-key">${r.label}</span>
      <span class="result-val ${r.cls}">${r.value || '—'}</span>
    </div>`).join('')
  }</div>`;
}

function codesValue(codes) {
  return codes && codes.length ? codes.join(', ') : null;
}

function renderCompareResult(compare) {
  const rows = [
    {
      label: 'Cartes de son stock utiles pour moi',
      value: codesValue(compare.friendCanGive),
      cls: 'ok'
    },
    {
      label: 'Cartes que je peux lui donner',
      value: codesValue(compare.youCanGive),
      cls: 'ok'
    },
    {
      label: 'Échange proposé - je reçois',
      value: codesValue(compare.proposedTrade.received),
      cls: 'ok'
    },
    {
      label: 'Échange proposé - je donne',
      value: codesValue(compare.proposedTrade.given),
      cls: 'warn'
    }
  ];

  if (compare.invalid.friendDoubles.length) {
    rows.push({
      label: 'Codes invalides dans ses doublons',
      value: compare.invalid.friendDoubles.join(', '),
      cls: 'error'
    });
  }
  if (compare.invalid.friendMissing.length) {
    rows.push({
      label: 'Codes invalides dans ses manquantes',
      value: compare.invalid.friendMissing.join(', '),
      cls: 'error'
    });
  }

  renderResult('compare-result', rows);

  const box = document.getElementById('compare-result');
  const hasTrade = compare.proposedTrade.received.length || compare.proposedTrade.given.length;
  const actions = document.createElement('div');
  actions.className = 'compare-actions';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'result-action';
  btn.textContent = "Envoyer vers l'échange";
  btn.disabled = !hasTrade;
  btn.onclick = fillTradeFromCompare;
  actions.appendChild(btn);
  box.appendChild(actions);
}

async function doCompare() {
  const friendDoubles = document.getElementById('compare-friend-doubles').value;
  const friendMissing = document.getElementById('compare-friend-missing').value;

  if (!friendDoubles.trim() && !friendMissing.trim()) {
    showToast('⚠️ Aucune liste saisie');
    return;
  }

  const btn = document.getElementById('btn-compare');
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await api('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendDoubles, friendMissing }),
    });

    if (res.error) {
      showToast('⚠️ Comparaison impossible');
      return;
    }

    lastCompareTrade = {
      received: res.proposedTrade.received,
      given: res.proposedTrade.given
    };
    renderCompareResult(res);
    showToast('Comparaison prête');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Comparer';
  }
}

function fillTradeFromCompare() {
  document.getElementById('trade-received').value = lastCompareTrade.received.join('\n');
  document.getElementById('trade-given').value = lastCompareTrade.given.join('\n');
  pendingTradeKey = null;
  document.getElementById('btn-trade').textContent = "Confirmer l'échange";
  switchTab('trade');
  showToast("Listes envoyées vers l'échange");
}

async function doImport() {
  const cards = parseInput(document.getElementById('import-input').value);
  if (!cards.length) { showToast('⚠️ Aucune carte saisie'); return; }

  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await api('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards }),
    });

    // Refresh local collection
    collection = await api('/api/collection');
    refreshCollectionViews();
    renderQuickCardSearch();
    await refreshHistory();

    renderResult('import-result', [
      { label: '✅ Importées',   value: res.ok.length      ? res.ok.join(', ')      : null, cls: 'ok'   },
      { label: '❓ Inconnues',   value: res.unknown.length  ? res.unknown.join(', ') : null, cls: 'warn' },
    ]);

    showToast(`✅ ${res.ok.length} carte(s) importée(s)`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Importer';
  }
}

let pendingTradeKey = null;

function formatCountDelta(before, after) {
  if (before === after) return `${before}`;
  return `${before} -> ${after}`;
}

function buildTradePreviewRows(preview) {
  const impact = preview.impact;
  const rows = [
    { label: 'Nouvelles reçues', value: String(impact.newReceived), cls: 'ok' },
    { label: 'Reçues déjà possédées', value: String(impact.receivedAsDoubles), cls: 'warn' },
    { label: 'Doublons donnés', value: String(impact.duplicateGiven), cls: 'ok' }
  ];

  if (impact.uniqueGiven > 0) {
    rows.push({ label: 'Cartes uniques données', value: String(impact.uniqueGiven), cls: 'error' });
  }
  if (impact.uniqueBlocked > 0) {
    rows.push({ label: 'Cartes uniques bloquées', value: String(impact.uniqueBlocked), cls: 'warn' });
  }

  rows.push(
    {
      label: 'Progression',
      value: `${impact.before.progress}% -> ${impact.after.progress}%`,
      cls: impact.after.progress >= impact.before.progress ? 'ok' : 'warn'
    },
    {
      label: 'Total possédé',
      value: formatCountDelta(impact.before.owned, impact.after.owned),
      cls: impact.after.owned >= impact.before.owned ? 'ok' : 'warn'
    },
    {
      label: 'Total doublons',
      value: formatCountDelta(impact.before.doubles, impact.after.doubles),
      cls: impact.after.doubles <= impact.before.doubles ? 'ok' : 'warn'
    }
  );

  if (preview.received.unknown.length) {
    rows.push({ label: 'Reçues inconnues', value: preview.received.unknown.join(', '), cls: 'warn' });
  }
  if (preview.given.unknown.length) {
    rows.push({ label: 'Données inconnues', value: preview.given.unknown.join(', '), cls: 'warn' });
  }
  if (preview.given.refused.length) {
    rows.push({ label: 'Non possédées', value: preview.given.refused.join(', '), cls: 'error' });
  }
  if (preview.given.uniqueBlocked.length) {
    rows.push({ label: 'Uniques protégées', value: preview.given.uniqueBlocked.join(', '), cls: 'warn' });
  }

  rows.push({
    label: 'Confirmation',
    value: 'Cliquez encore une fois pour appliquer réellement l’échange.',
    cls: 'warn'
  });

  return rows;
}

async function doTrade() {
  const received = parseInput(document.getElementById('trade-received').value);
  const given    = parseInput(document.getElementById('trade-given').value);
  const allowUniqueGiven = document.getElementById('trade-allow-unique').checked;

  if (!received.length && !given.length) {
    showToast('⚠️ Aucune carte saisie');
    return;
  }

  const btn = document.getElementById('btn-trade');

  const payload = { received, given, allowUniqueGiven };
  const tradeKey = JSON.stringify(payload);

  // Premier clic : prévisualisation serveur uniquement, sans écriture collection.
  if (pendingTradeKey !== tradeKey) {
    btn.disabled = true;
    btn.textContent = 'Prévisualisation…';
    try {
      const preview = await api('/api/trade/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      pendingTradeKey = tradeKey;
      renderResult('trade-result', buildTradePreviewRows(preview));

      btn.textContent = "Valider définitivement l'échange";
      showToast('Vérifiez l’impact, puis cliquez encore une fois pour valider');
    } catch (err) {
      console.error(err);
      pendingTradeKey = null;
      btn.textContent = "Confirmer l'échange";
      showToast('⚠️ Prévisualisation impossible');
    } finally {
      btn.disabled = false;
    }
    return;
  }

  // Deuxième clic : là seulement on envoie vraiment
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await api('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    pendingTradeKey = null;

    collection = await api('/api/collection');
    refreshCollectionViews();
    renderQuickCardSearch();
    await refreshHistory();

    const rows = [];

    if (res.received.ok.length) {
      rows.push({
        label: '✅ Reçues OK',
        value: res.received.ok.join(', '),
        cls: 'ok'
      });
    }

    if (res.received.unknown.length) {
      rows.push({
        label: '❓ Reçues inconnues',
        value: res.received.unknown.join(', '),
        cls: 'warn'
      });
    }

    if (res.given.ok.length) {
      rows.push({
        label: '🔴 Données OK',
        value: res.given.ok.join(', '),
        cls: 'ok'
      });
    }

    if (res.given.refused.length) {
      rows.push({
        label: '⛔ Non possédées',
        value: res.given.refused.join(', '),
        cls: 'error'
      });
    }

    if (res.given.uniqueBlocked && res.given.uniqueBlocked.length) {
      rows.push({
        label: '⚠️ Uniques protégées',
        value: res.given.uniqueBlocked.join(', '),
        cls: 'warn'
      });
    }

    if (res.given.unknown.length) {
      rows.push({
        label: '❓ Données inconnues',
        value: res.given.unknown.join(', '),
        cls: 'warn'
      });
    }

    renderResult('trade-result', rows);

    const r = res.received.ok.length;
    const g = res.given.ok.length;

    showToast(`🔄 Échange appliqué : +${r} reçue(s) / −${g} donnée(s)`);
    closeModal();
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmer l'échange";
  }
}

async function undoLastAction() {
  const btn = document.getElementById('undo-last-btn');
  btn.disabled = true;

  try {
    const res = await undoLast();
    if (res.error) {
      showToast('Aucune action à annuler');
      return;
    }

    collection = await api('/api/collection');
    refreshCollectionViews();
    renderQuickCardSearch();
    await refreshHistory();
    showToast('Dernière action annulée');
  } catch (err) {
    console.error(err);
    showToast('⚠️ Annulation impossible');
  } finally {
    btn.disabled = !historyEntries.some(canUndoHistoryEntry);
  }
}
// Keyboard shortcut: Escape closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
