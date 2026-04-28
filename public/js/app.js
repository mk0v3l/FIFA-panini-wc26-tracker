// ── State ──────────────────────────────────────────────────────────────────
let TEAMS = [];
let collection = {};
let currentTeam = null;

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

async function patchCard(team, card, delta) {
  return api('/api/card', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team, card, delta }),
  });
}

async function resetTeam(code) {
  return api(`/api/reset/${code}`, { method: 'POST' });
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
  let owned = 0, total = 0;
  const codes = [...TEAMS.map(t => t.code), 'FWC'];
  for (const code of codes) {
    const p = teamProgress(code);
    owned += p.owned;
    total += p.total;
  }
  return { owned, total };
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

// ── Sidebar rendering ──────────────────────────────────────────────────────
function renderNav() {
  const nav = document.getElementById('team-nav');
  nav.innerHTML = '';

  // Overview item
  const ovItem = document.createElement('div');
  ovItem.className = 'nav-item' + (currentTeam === null ? ' active' : '');
  ovItem.innerHTML = `<span class="nav-item-flag">🏠</span>
    <div class="nav-item-info">
      <div class="nav-item-name">Vue d'ensemble</div>
    </div>`;
  ovItem.onclick = () => navigateTo(null);
  nav.appendChild(ovItem);

  // Teams by group
  const groups = [...new Set(TEAMS.map(t => t.group))];
  for (const group of groups) {
    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = `Groupe ${group}`;
    nav.appendChild(header);

    for (const team of TEAMS.filter(t => t.group === group)) {
      nav.appendChild(makeNavItem(team));
    }
  }

  // FWC Special
  const fwcHeader = document.createElement('div');
  fwcHeader.className = 'group-header nav-item-special';
  fwcHeader.style.paddingTop = '12px';
  fwcHeader.textContent = 'Spécial';
  nav.appendChild(fwcHeader);
  nav.appendChild(makeNavItem({ code: 'FWC', name: 'FWC Special', group: 'FWC', color: '#1f6feb' }));
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
  const { owned, total } = globalProgress();
  const p = pct(owned, total);
  document.getElementById('global-pct').textContent = `${p}%`;
  document.getElementById('global-bar').style.width = `${p}%`;
  document.getElementById('global-counts').textContent = `${owned} / ${total} stickers`;
  document.getElementById('mobile-progress-text').textContent = `${p}%`;
}

// ── Overview page ──────────────────────────────────────────────────────────
function renderOverview() {
  document.getElementById('mobile-title').textContent = 'Vue d\'ensemble';
  const grid = document.getElementById('overview-grid');
  grid.innerHTML = '';

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
  const current = collection[teamCode][cardKey] ?? 0;
  const next = Math.max(0, current + delta);
  if (next === current) return;

  collection[teamCode][cardKey] = next;
  updateCardEl(el, teamCode, cardKey, next);
  updateTeamStats(teamCode);
  updateNavItem(teamCode);
  updateOverviewCard(teamCode);
  updateGlobalProgress();

  if (delta > 0) {
    const msgs = next === 1 ? '✅ Collée !' : `📦 Double x${next - 1}`;
    showToast(msgs);
  } else {
    showToast('↩️ Retirée');
  }

  // Sync with server (fire-and-forget)
  patchCard(teamCode, cardKey, delta).catch(() => {
    // Rollback on error
    collection[teamCode][cardKey] = current;
    updateCardEl(el, teamCode, cardKey, current);
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

  const ovPage   = document.getElementById('overview-page');
  const teamPage = document.getElementById('team-page');

  if (code === null) {
    ovPage.classList.add('active');
    teamPage.classList.remove('active');
  } else {
    ovPage.classList.remove('active');
    teamPage.classList.add('active');
    renderTeamPage(code);
  }

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

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  [TEAMS, collection] = await Promise.all([
    api('/api/teams'),
    api('/api/collection'),
  ]);

  renderNav();
  renderOverview();
  updateGlobalProgress();
}

init();
