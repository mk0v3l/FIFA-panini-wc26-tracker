const assert = require('assert');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'panini-regression-'));
const port = 5099 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let failures = 0;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function prepareTempApp() {
  fs.copyFileSync(path.join(repoRoot, 'server.js'), path.join(tempRoot, 'server.js'));
  fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(tempRoot, 'package.json'));
  copyDir(path.join(repoRoot, 'public'), path.join(tempRoot, 'public'));
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tempRoot, 'node_modules'), 'dir');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const res = await fetch(`${baseUrl}/api/collection`);
      if (res.ok) return;
    } catch (_err) {
      // server not ready yet
    }
    await wait(100);
  }
  throw new Error('Server did not start within 10 seconds');
}

async function request(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, options);
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const body = contentType.includes('application/json') ? JSON.parse(text) : text;
  return { status: res.status, headers: res.headers, body, text };
}

async function post(pathname, body) {
  return request(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function patch(pathname, body) {
  return request(pathname, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function collection() {
  return (await request('/api/collection')).body;
}

function snapshotCollection() {
  return fs.readFileSync(path.join(tempRoot, 'data', 'collection.json'), 'utf8');
}

function snapshotDataFile(name) {
  const file = path.join(tempRoot, 'data', name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function writePendingTrades(trades) {
  fs.writeFileSync(
    path.join(tempRoot, 'data', 'pending-trades.json'),
    `${JSON.stringify(trades, null, 2)}\n`
  );
}

function statsFromCollectionObject(data) {
  let owned = 0;
  let total = 0;
  let doubles = 0;
  for (const cards of Object.values(data)) {
    for (const count of Object.values(cards || {})) {
      if (count > 0) owned++;
      if (count >= 2) doubles += count - 1;
      total++;
    }
  }
  return { owned, total, doubles };
}

function statsFromEffectiveObject(data) {
  let owned = 0;
  let total = 0;
  let doubles = 0;
  for (const cards of Object.values(data)) {
    for (const counts of Object.values(cards || {})) {
      const count = Math.max(0, counts.effective || 0);
      if (count > 0) owned++;
      if (count >= 2) doubles += count - 1;
      total++;
    }
  }
  return { owned, total, doubles };
}

async function setCount(team, card, desired) {
  let current = (await collection())[team][card] || 0;
  while (current < desired) {
    await patch('/api/card', { team, card, delta: 1, source: 'regression' });
    current++;
  }
  while (current > desired) {
    await patch('/api/card', { team, card, delta: -1, source: 'regression' });
    current--;
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

async function main() {
  execFileSync(process.execPath, ['--check', path.join(repoRoot, 'server.js')], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', path.join(repoRoot, 'public/js/app.js')], { stdio: 'pipe' });

  prepareTempApp();
  server = spawn(process.execPath, ['server.js'], {
    cwd: tempRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => process.stdout.write(String(chunk)));
  server.stderr.on('data', chunk => process.stderr.write(String(chunk)));
  await waitForServer();

  await test('server health and assets', async () => {
    const home = await request('/');
    assert.strictEqual(home.status, 200);
    assert.match(home.text, /Panini Tracker|FIFA WC/);
    const data = await request('/api/collection');
    assert.strictEqual(data.status, 200);
    assert.strictEqual(typeof data.body, 'object');
    for (const file of ['public/index.html', 'public/js/app.js', 'public/css/style.css']) {
      assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} should exist`);
    }
  });

  await test('country card album layout and FWC split are defined', async () => {
    const appJs = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8');
    const css = fs.readFileSync(path.join(repoRoot, 'public/css/style.css'), 'utf8');
    assert.ok(appJs.includes('function getCountryAlbumRows'));
    assert.ok(appJs.includes('cardKeys.slice(0, 2)'));
    assert.ok(appJs.includes('cardKeys.slice(2, 6)'));
    assert.ok(appJs.includes('cardKeys.slice(6, 10)'));
    assert.ok(appJs.includes('cardKeys.slice(10, 13)'));
    assert.ok(appJs.includes('cardKeys.slice(13, 17)'));
    assert.ok(appJs.includes('cardKeys.slice(17, 20)'));
    const expectedRows = [['1', '2'], ['3', '4', '5', '6'], ['7', '8', '9', '10'], ['11', '12', '13'], ['14', '15', '16', '17'], ['18', '19', '20']];
    assert.deepStrictEqual(expectedRows.map(row => row.length), [2, 4, 4, 3, 4, 3]);
    assert.deepStrictEqual([...new Set(expectedRows.flat())], Array.from({ length: 20 }, (_, i) => String(i + 1)));

    assert.ok(appJs.includes("cardKey === '13' ? ' album-team-card'"));
    assert.ok(css.includes('.album-team-card'));
    assert.ok(css.includes('aspect-ratio: 4/3'));
    assert.ok(css.includes('width: calc(var(--album-card-width) * 4 / 3)'));
    assert.ok(!css.includes('grid-column: span 2'));
    assert.ok(!css.includes('calc((var(--album-card-width) * 2)'));
    assert.ok(appJs.includes("teamCode !== 'FWC' && cardKey === '13'"));
    assert.ok(appJs.includes('makeCardEl(dataCode, key, count, true'));
    assert.ok(appJs.includes("rowKeys.includes('13')"));
    assert.ok(css.includes('--album-card-width'));
    assert.ok(css.includes('grid-template-columns: repeat(var(--album-row-count), var(--album-card-width))'));
    assert.ok(css.includes('width: var(--album-card-width)'));
    assert.ok(!css.includes('.album-card-row .sticker-card {\n  width: 100%;'));
    assert.ok(!css.includes('grid-template-columns: repeat(var(--album-row-count), minmax(42px, 1fr))'));
    assert.ok(!css.includes('grid-template-columns: repeat(var(--album-row-count), minmax(34px, 1fr))'));

    assert.ok(appJs.includes('function getFwcSplitGroups'));
    assert.ok(appJs.includes("key === '00' || Number(key) <= 8"));
    assert.ok(appJs.includes("key !== '00' && Number(key) >= 9"));
    assert.ok(appJs.includes('const FWC_START_VIEW'));
    assert.ok(appJs.includes('const FWC_END_VIEW'));
    assert.ok(appJs.includes('Special début'));
    assert.ok(appJs.includes('Special fin'));
    assert.ok(appJs.includes('getFwcKeysForView(code)'));
    assert.ok(appJs.includes("code === FWC_END_VIEW ? 'FWC 9-19' : 'FWC 00-8'"));
    assert.ok(appJs.includes("sectionGrid.appendChild(makeCardEl(dataCode, key, count, true"));
    assert.ok(appJs.includes('return [FWC_START_VIEW, ...TEAMS.map(t => t.code), FWC_END_VIEW]'));
    assert.ok(appJs.includes("navigateTo(parsed.team === 'FWC' ? fwcViewForCard(parsed.card) : parsed.team)"));
    assert.ok(!appJs.includes("'0', ...Array.from"));
    assert.ok(appJs.includes("String(i + 1)"));
    assert.ok(appJs.includes('length: 19'));

    const fwcKeys = ['00', ...Array.from({ length: 19 }, (_, i) => String(i + 1))];
    const fwcStart = fwcKeys.filter(key => key === '00' || Number(key) <= 8);
    const fwcEnd = fwcKeys.filter(key => key !== '00' && Number(key) >= 9);
    assert.deepStrictEqual(fwcStart, ['00', '1', '2', '3', '4', '5', '6', '7', '8']);
    assert.deepStrictEqual(fwcEnd, ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']);
    assert.strictEqual(fwcStart.filter(key => fwcEnd.includes(key)).length, 0);
    assert.deepStrictEqual([...fwcStart, ...fwcEnd], fwcKeys);
  });

  await test('card touch handling distinguishes tap long press and scroll', async () => {
    const appJs = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8');
    const css = fs.readFileSync(path.join(repoRoot, 'public/css/style.css'), 'utf8');
    assert.ok(appJs.includes('function hasMovedBeyondTapThreshold'));
    assert.ok(appJs.includes('Math.hypot'));
    assert.ok(appJs.includes('gestureMoved'));
    assert.ok(appJs.includes('cancelPressForMove'));
    assert.ok(appJs.includes('touchmove'));
    assert.ok(appJs.includes('ignoreNextClick'));
    assert.ok(appJs.includes('if (gestureMoved)'));
    assert.ok(css.includes('touch-action: pan-y'));
    assert.ok(!appJs.includes('touchstart\', (e) => { e.preventDefault()'));
    const tapThreshold = 10;
    assert.strictEqual(Math.hypot(3, 4) > tapThreshold, false);
    assert.strictEqual(Math.hypot(0, 11) > tapThreshold, true);
    assert.strictEqual(Math.hypot(11, 0) > tapThreshold, true);
  });

  await test('card parsing and import normalization', async () => {
    const res = await post('/api/import', { cards: 'bel14, FCW3\nFRA12 MEX1 MEX99' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok.includes('BEL14'));
    assert.ok(res.body.ok.includes('FWC3'));
    assert.ok(res.body.ok.includes('FRA12'));
    assert.ok(res.body.ok.includes('MEX1'));
    assert.ok(res.body.unknown.includes('MEX99'));
    const c = await collection();
    assert.strictEqual(c.BEL['14'], 1);
    assert.strictEqual(c.FWC['3'], 1);
    assert.strictEqual(c.FRA['12'], 1);
  });

  await test('import records history and never creates negative quantities', async () => {
    const before = await collection();
    await post('/api/import', { cards: ['QAT1', 'QAT2'] });
    const after = await collection();
    assert.strictEqual(after.QAT['1'], (before.QAT['1'] || 0) + 1);
    assert.strictEqual(after.QAT['2'], (before.QAT['2'] || 0) + 1);
    const history = (await request('/api/history')).body;
    assert.ok(history.some(entry => entry.type === 'import'));
    for (const cards of Object.values(after)) {
      for (const count of Object.values(cards)) assert.ok(count >= 0);
    }
  });

  await test('real trade, protection, and preview behavior', async () => {
    await setCount('GER', '7', 1);
    const previewBefore = snapshotCollection();
    const preview = await post('/api/trade/preview', { received: ['ARG2'], given: ['GER7'], allowUniqueGiven: false });
    assert.strictEqual(preview.status, 200);
    assert.ok(preview.body.given.uniqueBlocked.includes('GER7'));
    assert.strictEqual(snapshotCollection(), previewBefore, 'preview must not modify collection');

    const blocked = await post('/api/trade', { received: [], given: ['GER7'], allowUniqueGiven: false });
    assert.strictEqual(blocked.body.given.ok.length, 0);
    assert.strictEqual((await collection()).GER['7'], 1);

    const trade = await post('/api/trade', { received: ['ARG2'], given: ['GER7'], allowUniqueGiven: true });
    assert.ok(trade.body.received.ok.includes('ARG2'));
    assert.ok(trade.body.given.ok.includes('GER7'));
    const c = await collection();
    assert.strictEqual(c.ARG['2'], 1);
    assert.strictEqual(c.GER['7'], 0);
  });

  await test('manual history and targeted revert behavior', async () => {
    await setCount('BEL', '14', 0);
    const add = await patch('/api/card', { team: 'BEL', card: '14', delta: 1, source: 'regression' });
    assert.ok(add.body.historyId);
    await patch('/api/card', { team: 'BEL', card: '15', delta: 1, source: 'regression' });
    const revert = await post(`/api/history/${add.body.historyId}/revert`);
    assert.strictEqual(revert.status, 200);
    let c = await collection();
    assert.strictEqual(c.BEL['14'], 0);
    assert.strictEqual(c.BEL['15'], 1);
    const again = await post(`/api/history/${add.body.historyId}/revert`);
    assert.strictEqual(again.status, 400);

    const removeAtZero = await patch('/api/card', { team: 'BEL', card: '14', delta: -1, source: 'regression' });
    assert.strictEqual(removeAtZero.body.changed, false);
    const history = (await request('/api/history')).body;
    assert.ok(!history.some(entry => entry.summary === '-1 BEL14' && entry.date > add.body.date));
  });

  await test('targeted revert conflict refuses negative result', async () => {
    await setCount('CAN', '2', 0);
    const add = await patch('/api/card', { team: 'CAN', card: '2', delta: 1, source: 'regression' });
    await patch('/api/card', { team: 'CAN', card: '2', delta: -1, source: 'regression' });
    const conflict = await post(`/api/history/${add.body.historyId}/revert`);
    assert.strictEqual(conflict.status, 409);
    assert.match(conflict.body.error, /descendrait sous 0/);
    assert.strictEqual((await collection()).CAN['2'], 0);
  });

  await test('exports respond as text and do not mutate collection', async () => {
    const before = snapshotCollection();
    for (const type of ['missing', 'doubles']) {
      for (const format of ['compact', 'grouped', 'whatsapp']) {
        const res = await request(`/api/export/${type}?format=${format}`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') || '', /text\/plain/);
        assert.ok(res.text.length > 0);
      }
    }
    assert.strictEqual(snapshotCollection(), before);
  });

  await test('exports can include pending trade impact without mutating data', async () => {
    await setCount('BEL', '14', 0);
    await setCount('FRA', '3', 2);
    await setCount('ARG', '5', 1);

    writePendingTrades([
      {
        id: 'pending-export-active',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14'],
        given: ['FRA3', 'ARG5'],
        note: '',
        source: 'regression'
      }
    ]);

    let beforeCollection = snapshotCollection();
    let beforePending = snapshotDataFile('pending-trades.json');
    let beforeHistory = snapshotDataFile('history.json');

    const missingReal = await request('/api/export/missing?format=compact');
    const missingWithPending = await request('/api/export/missing?format=compact&includePending=1');
    assert.match(missingReal.text, /\bBEL14\b/);
    assert.ok(!/\bBEL14\b/.test(missingWithPending.text));
    assert.ok(/\bARG5\b/.test(missingWithPending.text));

    const doublesReal = await request('/api/export/doubles?format=compact');
    const doublesWithPending = await request('/api/export/doubles?format=compact&includePending=1');
    assert.match(doublesReal.text, /\bFRA3 x1\b/);
    assert.ok(!/\bFRA3 x1\b/.test(doublesWithPending.text));

    for (const type of ['missing', 'doubles']) {
      for (const format of ['compact', 'grouped', 'whatsapp']) {
        const res = await request(`/api/export/${type}?format=${format}&includePending=1`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') || '', /text\/plain/);
        assert.ok(res.text.length > 0);
      }
    }

    assert.strictEqual(snapshotCollection(), beforeCollection);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), beforePending);
    assert.strictEqual(snapshotDataFile('history.json'), beforeHistory);

    writePendingTrades([
      {
        id: 'pending-export-cancelled',
        createdAt: new Date().toISOString(),
        status: 'cancelled',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    assert.match((await request('/api/export/missing?format=compact&includePending=1')).text, /\bBEL14\b/);

    writePendingTrades([
      {
        id: 'pending-export-completed',
        createdAt: new Date().toISOString(),
        status: 'completed',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    assert.match((await request('/api/export/missing?format=compact&includePending=1')).text, /\bBEL14\b/);

    writePendingTrades([]);
  });

  await test('global potential stats include only active pending trades', async () => {
    await setCount('BEL', '14', 0);
    await setCount('FRA', '3', 2);
    await setCount('ARG', '5', 1);

    writePendingTrades([]);
    const realCollection = await collection();
    const realStats = statsFromCollectionObject(realCollection);
    const noPendingStats = statsFromEffectiveObject((await request('/api/effective-collection')).body);
    assert.deepStrictEqual(noPendingStats, realStats);

    writePendingTrades([
      {
        id: 'stats-active',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14'],
        given: ['FRA3', 'ARG5'],
        note: '',
        source: 'regression'
      }
    ]);
    const activeStats = statsFromEffectiveObject((await request('/api/effective-collection')).body);
    assert.strictEqual(activeStats.total, realStats.total);
    assert.strictEqual(realCollection.BEL['14'], 0);
    assert.strictEqual(activeStats.owned, realStats.owned);
    assert.strictEqual(activeStats.doubles, realStats.doubles - 1);
    const activeEffective = (await request('/api/effective-collection')).body;
    assert.strictEqual(activeEffective.BEL['14'].real, 0);
    assert.strictEqual(activeEffective.BEL['14'].effective, 1);
    assert.strictEqual(activeEffective.ARG['5'].real, 1);
    assert.strictEqual(activeEffective.ARG['5'].effective, 0);
    assert.ok(activeEffective.ARG['5'].effective >= 0);

    writePendingTrades([
      {
        id: 'stats-cancelled',
        createdAt: new Date().toISOString(),
        status: 'cancelled',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    const cancelledStats = statsFromEffectiveObject((await request('/api/effective-collection')).body);
    assert.deepStrictEqual(cancelledStats, realStats);

    writePendingTrades([
      {
        id: 'stats-completed',
        createdAt: new Date().toISOString(),
        status: 'completed',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    const completedStats = statsFromEffectiveObject((await request('/api/effective-collection')).body);
    assert.deepStrictEqual(completedStats, realStats);

    writePendingTrades([]);
  });

  await test('effective collection exposes potential duplicate card states', async () => {
    await setCount('BEL', '14', 1);
    await setCount('FRA', '3', 2);
    await setCount('ARG', '5', 1);
    await setCount('BEL', '20', 0);

    writePendingTrades([
      {
        id: 'visual-potential-double',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14', 'BEL20'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    let effective = (await request('/api/effective-collection')).body;
    assert.strictEqual(effective.BEL['14'].real, 1);
    assert.strictEqual(effective.BEL['14'].incoming, 1);
    assert.strictEqual(effective.BEL['14'].effective, 2);
    assert.strictEqual(effective.BEL['14'].doublePotential, true);
    assert.strictEqual(effective.FRA['3'].realDouble, true);
    assert.strictEqual(effective.FRA['3'].doublePotential, false);
    assert.strictEqual(effective.ARG['5'].realOwned, true);
    assert.strictEqual(effective.ARG['5'].realDouble, false);
    assert.strictEqual(effective.ARG['5'].doublePotential, false);
    assert.strictEqual(effective.BEL['20'].incomingPending, true);
    assert.strictEqual(effective.BEL['20'].realOwned, false);
    assert.strictEqual(effective.BEL['20'].potentialOwned, true);

    writePendingTrades([
      {
        id: 'visual-potential-cancelled-out',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14'],
        given: ['BEL14'],
        note: '',
        source: 'regression'
      }
    ]);
    effective = (await request('/api/effective-collection')).body;
    assert.strictEqual(effective.BEL['14'].effective, 1);
    assert.strictEqual(effective.BEL['14'].doublePotential, false);

    writePendingTrades([
      {
        id: 'visual-cancelled',
        createdAt: new Date().toISOString(),
        status: 'cancelled',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      },
      {
        id: 'visual-completed',
        createdAt: new Date().toISOString(),
        status: 'completed',
        received: ['BEL14'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);
    effective = (await request('/api/effective-collection')).body;
    assert.strictEqual(effective.BEL['14'].incoming, 0);
    assert.strictEqual(effective.BEL['14'].effective, 1);
    assert.strictEqual(effective.BEL['14'].doublePotential, false);

    const appJs = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8');
    const css = fs.readFileSync(path.join(repoRoot, 'public/css/style.css'), 'utf8');
    assert.ok(appJs.includes('potential-duplicate'));
    assert.ok(appJs.includes('doublePotential'));
    assert.ok(css.includes('.sticker-card.potential-duplicate'));

    writePendingTrades([]);
  });

  await test('pending trade notes can be added edited and removed safely', async () => {
    const create = await post('/api/pending-trades', { received: ['MEX1'], given: [], note: '' });
    assert.strictEqual(create.status, 200);
    const id = create.body.trade.id;
    const beforeCollection = snapshotCollection();
    let beforeHistory = snapshotDataFile('history.json');

    const specialNote = '<script>alert(1)</script> & "test"';
    const add = await patch(`/api/pending-trades/${id}/note`, { note: specialNote });
    assert.strictEqual(add.status, 200);
    assert.strictEqual(add.body.trade.note, specialNote);
    assert.strictEqual(add.body.trade.status, 'pending');
    assert.strictEqual(snapshotCollection(), beforeCollection);
    assert.strictEqual(snapshotDataFile('history.json'), beforeHistory);
    assert.strictEqual((await request('/api/pending-trades')).body.find(trade => trade.id === id).note, specialNote);

    beforeHistory = snapshotDataFile('history.json');
    const edit = await patch(`/api/pending-trades/${id}/note`, { note: '  Note modifiée  ' });
    assert.strictEqual(edit.status, 200);
    assert.strictEqual(edit.body.trade.note, 'Note modifiée');
    assert.strictEqual(edit.body.trade.status, 'pending');
    assert.strictEqual(snapshotCollection(), beforeCollection);
    assert.strictEqual(snapshotDataFile('history.json'), beforeHistory);

    const remove = await patch(`/api/pending-trades/${id}/note`, { note: '   ' });
    assert.strictEqual(remove.status, 200);
    assert.strictEqual(remove.body.trade.note, '');

    const beforePending = snapshotDataFile('pending-trades.json');
    const tooLong = await patch(`/api/pending-trades/${id}/note`, { note: 'x'.repeat(501) });
    assert.strictEqual(tooLong.status, 400);
    assert.match(tooLong.body.error, /too long/);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), beforePending);

    const missingBeforePending = snapshotDataFile('pending-trades.json');
    const missingBeforeCollection = snapshotCollection();
    const missing = await patch('/api/pending-trades/does-not-exist/note', { note: 'nope' });
    assert.strictEqual(missing.status, 404);
    assert.match(missing.headers.get('content-type') || '', /application\/json/);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), missingBeforePending);
    assert.strictEqual(snapshotCollection(), missingBeforeCollection);

    const invalidJson = await request(`/api/pending-trades/${id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json'
    });
    assert.strictEqual(invalidJson.status, 400);
    assert.match(invalidJson.headers.get('content-type') || '', /application\/json/);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), missingBeforePending);

    const appJs = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8');
    assert.ok(appJs.includes('escapeHtml(note)'));

    writePendingTrades([]);
  });

  await test('comparison separates real needs and pending potential trades', async () => {
    await setCount('BEL', '14', 0);
    await setCount('FRA', '12', 0);
    await setCount('CAN', '2', 1);
    await setCount('FRA', '3', 2);
    await setCount('URU', '2', 2);
    await setCount('ESP', '4', 1);
    await setCount('JPN', '6', 0);
    await setCount('JPN', '7', 0);

    writePendingTrades([
      {
        id: 'compare-incoming-missing',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14', 'CAN2'],
        given: [],
        note: '',
        source: 'regression'
      },
      {
        id: 'compare-outgoing-reserved',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: [],
        given: ['URU2'],
        note: '',
        source: 'regression'
      },
      {
        id: 'compare-cancelled',
        createdAt: new Date().toISOString(),
        status: 'cancelled',
        received: ['ESP4', 'JPN6'],
        given: [],
        note: '',
        source: 'regression'
      },
      {
        id: 'compare-completed',
        createdAt: new Date().toISOString(),
        status: 'completed',
        received: ['ESP4', 'JPN7'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);

    const beforeCollection = snapshotCollection();
    const beforePending = snapshotDataFile('pending-trades.json');
    const beforeHistory = snapshotDataFile('history.json');
    const res = await post('/api/compare', {
      friendDoubles: 'bel14, FRA12\nJPN6 JPN7',
      friendMissing: 'CAN2, FRA3, URU2, ESP4'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.friendCanGive.includes('BEL14'));
    assert.ok(!res.body.friendCanGiveStillNeeded.includes('BEL14'));
    assert.ok(res.body.pending.potentiallyReceived.includes('BEL14'));
    assert.ok(res.body.friendCanGiveStillNeeded.includes('FRA12'));
    assert.ok(res.body.friendCanGiveStillNeeded.includes('JPN6'));
    assert.ok(res.body.friendCanGiveStillNeeded.includes('JPN7'));
    assert.ok(res.body.youCanPotentiallyGive.includes('CAN2'));
    assert.ok(!res.body.youCanGive.includes('CAN2'));
    assert.ok(res.body.youCanGive.includes('FRA3'));
    assert.ok(!res.body.youCanGive.includes('URU2'));
    assert.ok(res.body.pending.reservedToGive.includes('URU2'));
    assert.ok(!res.body.youCanPotentiallyGive.includes('ESP4'));
    assert.ok(res.body.proposedTrade.given.includes('CAN2'));
    assert.ok(res.body.proposedTrade.given.includes('FRA3'));
    assert.ok(!res.body.proposedTrade.received.includes('BEL14'));
    assert.strictEqual(snapshotCollection(), beforeCollection);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), beforePending);
    assert.strictEqual(snapshotDataFile('history.json'), beforeHistory);

    const doublesOnly = await post('/api/compare', { friendDoubles: 'FRA12', friendMissing: '' });
    assert.strictEqual(doublesOnly.status, 200);
    assert.ok(doublesOnly.body.friendCanGiveStillNeeded.includes('FRA12'));
    const missingOnly = await post('/api/compare', { friendDoubles: '', friendMissing: 'FRA3' });
    assert.strictEqual(missingOnly.status, 200);
    assert.ok(missingOnly.body.youCanGive.includes('FRA3'));
    const empty = await post('/api/compare', { friendDoubles: '', friendMissing: '' });
    assert.strictEqual(empty.status, 200);

    writePendingTrades([]);
  });

  await test('compare send-to-trade payload includes potential gives and short labels', async () => {
    await setCount('BEL', '14', 1);
    await setCount('FRA', '3', 2);
    await setCount('ARG', '5', 0);

    writePendingTrades([
      {
        id: 'compare-send-potential-give',
        createdAt: new Date().toISOString(),
        status: 'pending',
        received: ['BEL14', 'ARG5'],
        given: [],
        note: '',
        source: 'regression'
      }
    ]);

    const beforeCollection = snapshotCollection();
    const beforePending = snapshotDataFile('pending-trades.json');
    const beforeHistory = snapshotDataFile('history.json');
    const res = await post('/api/compare', {
      friendDoubles: 'ARG5',
      friendMissing: 'BEL14 FRA3'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.youCanPotentiallyGive.includes('BEL14'));
    assert.ok(!res.body.youCanGive.includes('BEL14'));
    assert.ok(res.body.youCanGive.includes('FRA3'));
    assert.ok(res.body.proposedTrade.given.includes('BEL14'));
    assert.ok(res.body.proposedTrade.given.includes('FRA3'));
    assert.ok(res.body.proposedTrade.givenPotential.includes('BEL14'));
    assert.ok(res.body.proposedTrade.givenNow.includes('FRA3'));
    assert.ok(!res.body.proposedTrade.received.includes('ARG5'));
    assert.strictEqual(snapshotCollection(), beforeCollection);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), beforePending);
    assert.strictEqual(snapshotDataFile('history.json'), beforeHistory);

    const appJs = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8');
    assert.ok(appJs.includes('À donner plus tard'));
    assert.ok(appJs.includes('Encore utiles'));
    assert.ok(!appJs.includes('Je pourrai potentiellement lui donner après échanges virtuels'));
    assert.ok(!appJs.includes('Encore vraiment nécessaires après échanges virtuels'));

    writePendingTrades([]);
  });

  await test('dependent pending trades can be saved and are blocked until real availability', async () => {
    await setCount('RSA', '15', 1);
    const before = snapshotCollection();
    const parent = await post('/api/pending-trades', { received: ['RSA15'], given: [] });
    assert.strictEqual(parent.status, 200);
    const child = await post('/api/pending-trades', { received: [], given: ['RSA15'], allowUniqueGiven: false });
    assert.strictEqual(child.status, 200);
    assert.strictEqual(snapshotCollection(), before);
    assert.strictEqual(child.body.trade.availability.status, 'dependent');
    assert.ok(child.body.trade.availability.dependentCards.includes('RSA15'));

    const blocked = await post(`/api/pending-trades/${child.body.trade.id}/complete`);
    assert.strictEqual(blocked.status, 409);
    assert.match(blocked.body.error, /RSA15/);
    assert.match(blocked.body.error, /dépend/);
    assert.strictEqual(snapshotCollection(), before);
    assert.strictEqual((await request('/api/pending-trades')).body.find(trade => trade.id === child.body.trade.id).status, 'pending');

    await patch('/api/card', { team: 'RSA', card: '15', delta: 1, source: 'regression' });
    const complete = await post(`/api/pending-trades/${child.body.trade.id}/complete`);
    assert.strictEqual(complete.status, 200);
    assert.strictEqual(complete.body.trade.status, 'completed');
    assert.ok((await collection()).RSA['15'] >= 1);

    writePendingTrades([]);
  });

  await test('dependent pending trade can complete after parent trade completes', async () => {
    await setCount('RSA', '15', 1);
    writePendingTrades([]);
    const parent = await post('/api/pending-trades', { received: ['RSA15'], given: [] });
    assert.strictEqual(parent.status, 200);
    const child = await post('/api/pending-trades', { received: [], given: ['RSA15'], allowUniqueGiven: false });
    assert.strictEqual(child.status, 200);
    assert.strictEqual(child.body.trade.availability.status, 'dependent');

    const completeParent = await post(`/api/pending-trades/${parent.body.trade.id}/complete`);
    assert.strictEqual(completeParent.status, 200);
    const completeChild = await post(`/api/pending-trades/${child.body.trade.id}/complete`);
    assert.strictEqual(completeChild.status, 200);
    const trades = (await request('/api/pending-trades')).body;
    assert.strictEqual(trades.find(trade => trade.id === parent.body.trade.id).status, 'completed');
    assert.strictEqual(trades.find(trade => trade.id === child.body.trade.id).status, 'completed');
    assert.strictEqual((await post(`/api/pending-trades/${child.body.trade.id}/complete`)).status, 400);

    writePendingTrades([]);
  });

  await test('pending availability distinguishes ready impossible and self reservations', async () => {
    await setCount('RSA', '14', 2);
    await setCount('RSA', '20', 0);
    writePendingTrades([]);

    const ready = await post('/api/pending-trades', { received: [], given: ['RSA14'], allowUniqueGiven: false });
    assert.strictEqual(ready.status, 200);
    assert.strictEqual(ready.body.trade.availability.status, 'ready');
    const readyFromList = (await request('/api/pending-trades')).body.find(trade => trade.id === ready.body.trade.id);
    assert.strictEqual(readyFromList.availability.status, 'ready');
    assert.strictEqual(readyFromList.availability.canCompleteNow, true);
    assert.strictEqual((await post(`/api/pending-trades/${ready.body.trade.id}/complete`)).status, 200);

    const beforePending = snapshotDataFile('pending-trades.json');
    const beforeCollection = snapshotCollection();
    const impossible = await post('/api/pending-trades', { received: [], given: ['RSA20'], allowUniqueGiven: false });
    assert.strictEqual(impossible.status, 400);
    assert.match(impossible.body.error, /invalid or unavailable|No valid/);
    assert.strictEqual(snapshotDataFile('pending-trades.json'), beforePending);
    assert.strictEqual(snapshotCollection(), beforeCollection);

    writePendingTrades([]);
  });

  await test('compare-to-trade potential gives can be saved as dependent virtual trade', async () => {
    await setCount('RSA', '15', 1);
    writePendingTrades([]);
    const parent = await post('/api/pending-trades', { received: ['RSA15'], given: [] });
    assert.strictEqual(parent.status, 200);
    const compare = await post('/api/compare', { friendDoubles: '', friendMissing: 'RSA15' });
    assert.strictEqual(compare.status, 200);
    assert.ok(compare.body.youCanPotentiallyGive.includes('RSA15'));
    assert.ok(compare.body.proposedTrade.given.includes('RSA15'));
    const before = snapshotCollection();
    const child = await post('/api/pending-trades', {
      received: compare.body.proposedTrade.received,
      given: compare.body.proposedTrade.given,
      allowUniqueGiven: false
    });
    assert.strictEqual(child.status, 200);
    assert.strictEqual(child.body.trade.availability.status, 'dependent');
    assert.ok(child.body.trade.availability.dependentCards.includes('RSA15'));
    assert.strictEqual(snapshotCollection(), before);

    writePendingTrades([]);
  });

  await test('modal tabs keep compare trade import order', async () => {
    const html = fs.readFileSync(path.join(repoRoot, 'public/index.html'), 'utf8');
    const compareIndex = html.indexOf('data-tab="compare"');
    const tradeIndex = html.indexOf('data-tab="trade"');
    const importIndex = html.indexOf('data-tab="import"');
    assert.ok(compareIndex !== -1 && tradeIndex !== -1 && importIndex !== -1);
    assert.ok(compareIndex < tradeIndex);
    assert.ok(tradeIndex < importIndex);
    assert.ok(html.includes('class="modal-tab active" data-tab="compare"'));
  });

  await test('friend comparison works and does not mutate collection', async () => {
    await setCount('ESP', '4', 0);
    await setCount('FRA', '3', 2);
    const before = snapshotCollection();
    const res = await post('/api/compare', {
      friendDoubles: 'ESP4 BAD88',
      friendMissing: 'FRA3 NOPE99'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.friendCanGive.includes('ESP4'));
    assert.ok(res.body.youCanGive.includes('FRA3'));
    assert.ok(res.body.invalid.friendDoubles.includes('BAD88'));
    assert.ok(res.body.invalid.friendMissing.includes('NOPE99'));
    assert.strictEqual(snapshotCollection(), before);
  });

  await test('pending trades when available', async () => {
    const probe = await request('/api/pending-trades');
    if (probe.status === 404) {
      console.log('PASS pending trades skipped: routes not present');
      return;
    }
    assert.strictEqual(probe.status, 200);
    await setCount('URU', '1', 0);
    await setCount('URU', '2', 2);
    const before = snapshotCollection();
    const create = await post('/api/pending-trades', { received: ['URU1'], given: ['URU2'], allowUniqueGiven: false });
    assert.strictEqual(create.status, 200);
    assert.strictEqual(snapshotCollection(), before);
    assert.ok((await request('/api/pending-trades')).body.some(trade => trade.id === create.body.trade.id));
    const effective = await request('/api/effective-collection');
    assert.strictEqual(effective.status, 200);
    assert.strictEqual(effective.body.URU['1'].real, 0);
    assert.strictEqual(effective.body.URU['1'].incoming, 1);
    assert.strictEqual(effective.body.URU['1'].effective, 1);
    assert.strictEqual(effective.body.URU['2'].real, 2);
    assert.strictEqual(effective.body.URU['2'].outgoing, 1);
    assert.strictEqual(effective.body.URU['2'].tradeable, 1);
    const compare = await post('/api/compare', { friendDoubles: 'URU1', friendMissing: 'URU2' });
    assert.ok(compare.body.pending.potentiallyReceived.includes('URU1'));
    assert.ok(compare.body.pending.reservedToGive.includes('URU2'));
    const cancel = await post(`/api/pending-trades/${create.body.trade.id}/cancel`);
    assert.strictEqual(cancel.status, 200);
    assert.strictEqual(snapshotCollection(), before);
    const effectiveAfterCancel = await request('/api/effective-collection');
    assert.strictEqual(effectiveAfterCancel.body.URU['1'].incoming, 0);
    assert.strictEqual(effectiveAfterCancel.body.URU['1'].effective, 0);
    assert.strictEqual(effectiveAfterCancel.body.URU['2'].outgoing, 0);

    const create2 = await post('/api/pending-trades', { received: ['URU1'], given: ['URU2'], allowUniqueGiven: false });
    assert.strictEqual(create2.status, 200);
    const complete = await post(`/api/pending-trades/${create2.body.trade.id}/complete`);
    assert.strictEqual(complete.status, 200);
    const after = await collection();
    const beforeObj = JSON.parse(before);
    assert.strictEqual(after.URU['1'], (beforeObj.URU['1'] || 0) + 1);
    assert.strictEqual(after.URU['2'], (beforeObj.URU['2'] || 0) - 1);
    const effectiveAfterComplete = await request('/api/effective-collection');
    assert.strictEqual(effectiveAfterComplete.body.URU['1'].incoming, 0);
    assert.strictEqual(effectiveAfterComplete.body.URU['1'].real, after.URU['1']);
    assert.strictEqual(effectiveAfterComplete.body.URU['2'].outgoing, 0);
    assert.strictEqual((await post(`/api/pending-trades/${create2.body.trade.id}/complete`)).status, 400);
  });
}

main()
  .catch(err => {
    failures++;
    console.error('FAIL regression setup');
    console.error(err && err.stack ? err.stack : err);
  })
  .finally(async () => {
    if (server) server.kill('SIGTERM');
    await wait(200);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (failures > 0) {
      console.error(`FAIL ${failures} test(s) failed`);
      process.exit(1);
    }
    console.log('PASS all regression tests');
  });
