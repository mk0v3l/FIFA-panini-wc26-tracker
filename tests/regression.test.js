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
    const compare = await post('/api/compare', { friendDoubles: 'URU1', friendMissing: 'URU2' });
    assert.ok(compare.body.pending.potentiallyReceived.includes('URU1'));
    assert.ok(compare.body.pending.reservedToGive.includes('URU2'));
    const cancel = await post(`/api/pending-trades/${create.body.trade.id}/cancel`);
    assert.strictEqual(cancel.status, 200);
    assert.strictEqual(snapshotCollection(), before);

    const create2 = await post('/api/pending-trades', { received: ['URU1'], given: ['URU2'], allowUniqueGiven: false });
    assert.strictEqual(create2.status, 200);
    const complete = await post(`/api/pending-trades/${create2.body.trade.id}/complete`);
    assert.strictEqual(complete.status, 200);
    const after = await collection();
    const beforeObj = JSON.parse(before);
    assert.strictEqual(after.URU['1'], (beforeObj.URU['1'] || 0) + 1);
    assert.strictEqual(after.URU['2'], (beforeObj.URU['2'] || 0) - 1);
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
