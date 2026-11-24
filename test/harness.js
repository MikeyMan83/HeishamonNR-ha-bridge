// Test harness for the HA Bridge (committed like HeishamonNR-update-tab's test/harness.js).
// Runs the REAL func code from ha-bridge-flow.json against mocked Node-RED globals.
// Structure/style asserts pin the update-tab-aligned wording and layout (v1.3.1).
// Usage: node test/harness.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const flowText = fs.readFileSync(path.join(ROOT, 'ha-bridge-flow.json'), 'utf8');
const flow = JSON.parse(flowText);
const vjson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const byid = Object.fromEntries(flow.map(n => [n.id, n]));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

// Runs a flow function node in a mocked Node-RED function environment.
// Context (context store) persists per node id across runs; globals live in a file store.
function makeRunner() {
  const ctxStore = {};   // per-node context
  const globalFile = {}; // global context, file store
  const globalDefault = {};
  const envVars = {};
  global.set = (k, v) => { if (v === undefined) { delete globalDefault[k]; } else { globalDefault[k] = v; } };
  const run = (id, msg) => {
    const n = byid[id];
    if (!n || typeof n.func !== 'string') throw new Error('no func node ' + id);
    const node = { status: () => {}, log: () => {}, warn: () => {}, error: () => {} };
    const context = {
      get: (k) => ctxStore[id] && ctxStore[id][k],
      set: (k, v) => { (ctxStore[id] = ctxStore[id] || {})[k] = v; }
    };
    const global = {
      get: (k, store) => (store === 'file' ? globalFile[k] : (globalFile[k] !== undefined ? globalFile[k] : globalDefault[k])),
      set: (k, v) => { if (v === undefined) { delete globalDefault[k]; } else { globalDefault[k] = v; } },
      keys: () => Object.keys(globalDefault)
    };
    const env = { get: (k) => envVars[k] };
    const fn = new Function('node', 'context', 'global', 'env', 'msg', n.func + '\n');
    return fn(node, context, global, env, msg);
  };
  return { run, globalFile, globalDefault, envVars, ctxStore };
}

// ---------------- S1: structure, version sync, wording style (update-tab alignment) ----------------
section('S1 v1.3.1: structure, version sync and update-tab-aligned wording');
{
  ok(flow.length === 21, 'node count is 21', flow.length);
  ok(flow.every(n => String(n.id).indexOf('habridge.') === 0), 'every id is habridge-prefixed (merge safety)');
  ok(new Set(flow.map(n => n.id)).size === flow.length, 'ids unique');
  ok(flow.find(n => n.id === 'habridge.func').func === require('fs').readFileSync(__dirname + '/../ha_bridge_code.js', 'utf8'), 'publisher func is byte-identical to ha_bridge_code.js');
  ok(!/[^\x00-\x7F]/.test(flowText), 'flow file is pure ASCII (no em dashes lurking as \\u escapes)');
  ok(flowText.endsWith('\n') && !flowText.endsWith('\n\n'), 'exactly one trailing newline');
  const tabNode = flow.find(n => n.type === 'tab');
  const infoM = String(tabNode.info).match(/v(\d+\.\d+\.\d+)/);
  ok(infoM && infoM[1] === vjson.version && vjson.version === '1.3.1', 'tab info version === version.json === 1.3.1', { info: infoM && infoM[1], vj: vjson.version });
  ok(String(byid['habridge.verfn'].func).includes("const VERSION = '1.3.1'") && String(byid['habridge.brain'].func).includes("const VERSION = '1.3.1'"), 'both VERSION consts are 1.3.1');
  const r = makeRunner();
  ok(r.run('habridge.verfn', { payload: 'boot' }).payload === 'Running bridge version 1.3.1.', 'boot sentence template mirrors the update tab ("Running <thing> version <X>.")');
  const groups = flow.filter(n => n.type === 'ui_group');
  const gnames = groups.map(g => g.name + ':' + g.order).sort().join('|');
  ok(groups.length === 2 && gnames === 'Status:1|Update:2', 'two half-width columns: Status and Update (order 1/2)', gnames);
  ok(groups.every(g => Number(g.width) === 6), 'both groups are 6 units wide (two half-screen columns)', groups.map(g => g.width));
  const btns = flow.filter(n => n.type === 'ui_button');
  ok(btns.length === 2 && btns.every(b => b.name === b.label && b.width === 6 && b.height === 1), 'two full-width buttons with name === label', btns.map(b => b.name));
  ok(btns.every(b => typeof b.tooltip === 'string' && b.tooltip.length > 40), 'both buttons carry a real tooltip');
  ok(btns.map(b => b.label).sort().join('|') === 'Check for updates|Update from GitHub', 'button wording set', btns.map(b => b.label));
  const texts = ['habridge.ui.version', 'habridge.ui.val', 'habridge.ui.times', 'habridge.ui.github'].map(id => byid[id]);
  ok(texts.every(t => t.width === 6 && t.height === 2 && t.layout === 'col-left' && t.format === '{{msg.payload}}'), 'all four status fields share the update-tab widget style (6 units, 2 rows, left-aligned)');
  ok(byid['habridge.ui.github'].name === 'Update status' && byid['habridge.ui.github'].label === 'Update status', 'the persistent check-result field is labeled "Update status" (not "GitHub")');
  const stale = /GitHub: v|Running: v|\(update!\)|\(up to date\)|HA Bridge: |Published: /;
  const hits = [];
  for (const n of flow) {
    for (const f of ['name', 'label', 'tooltip', 'info']) if (typeof n[f] === 'string' && stale.test(n[f])) hits.push(n.id + '.' + f);
    if (typeof n.func === 'string') n.func.split('\n').forEach(L => { if (stale.test(L)) hits.push(n.id + '.func: ' + L.trim().slice(0, 80)); });
  }
  ok(hits.length === 0, 'no stale shorthand vocabulary left in user-visible strings or funcs', hits);
  ok(String(byid['habridge.btn.update'].tooltip).includes('restart'), 'the [Update from GitHub] tooltip warns that the flow restarts');
}

// ---------------- S2: publisher (real func, mocked store) ----------------
section('S2 publisher: flatten, discovery once, fast filter, unset scalars, stats');
{
  const r = makeRunner();
  r.globalFile['F_RTC'] = { automation_on_limit: 1.0, ladder: { z1_t4: -0.1 } };
  r.globalFile['F_CCC'] = { abc: 1 };
  r.globalFile['TOP97_Heater_Start_Delta'] = -3;
  // Quiet_Mode_Level deliberately absent -> 'unset'
  const out1 = r.run('habridge.func', { topic: 'full' });
  const msgs = out1[0];
  ok(Array.isArray(msgs) && msgs.length > 0, 'publisher returns MQTT messages');
  const configs = msgs.filter(m => String(m.topic).indexOf('/config') !== -1);
  ok(configs.length === 34, 'configs sent on first run: registered sensors + flattened store leaves (34)', configs.length);
  const hasRtc = msgs.find(m => m.topic === 'heishamon/nr/rtc.automation_on_limit');
  ok(hasRtc && hasRtc.payload === '1' || (hasRtc && hasRtc.payload === '1.0'), 'nested object flattened to dotted key', hasRtc && hasRtc.payload);
  ok(msgs.some(m => m.topic === 'heishamon/nr/ccc.abc' && m.payload === '1'), 'F_CCC published');
  ok(msgs.some(m => m.topic === 'heishamon/nr/nr.TOP97_Heater_Start_Delta' && m.payload === '-3'), 'scalar readback published');
  ok(msgs.some(m => m.topic === 'heishamon/nr/nr.Quiet_Mode_Level' && m.payload === 'unset'), 'missing watched scalar publishes as "unset"');
  const out2 = r.run('habridge.func', { topic: 'fast' });
  ok(!out2[0].some(m => m.topic === 'heishamon/nr/ccc.abc'), 'fast tick skips non-state-like keys (ccc.abc)');
  ok(out2[0].some(m => m.topic === 'heishamon/nr/rtc.automation_on_limit'), 'fast tick publishes state-like keys (rtc.automation_on_limit)');
  ok(out2[0].filter(m => String(m.topic).indexOf('/config') !== -1).length === 0, 'discovery configs only once per Node-RED restart');
  ok(out2[1] && out2[1].payload && out2[1].payload.fast && out2[1].payload.fast.n > 0, 'stats output carries the fast tick count');
}

// ---------------- S3: status view builder ----------------
section('S3 status view builder: Values and Last publish wording');
{
  const r = makeRunner();
  const o1 = r.run('habridge.status', { payload: { full: { n: 245, at: '10:00:15' } } });
  ok(o1[0] && o1[0].payload === '245 (full)', 'full snapshot count, no "Published:" label repetition', o1[0] && o1[0].payload);
  ok(o1[1] && o1[1].payload === 'Last publish: full 10:00:15 (245)', 'last publish line', o1[1] && o1[1].payload);
  const o2 = r.run('habridge.status', { payload: { fast: { n: 18, at: '10:00:05' }, full: { n: 245, at: '10:00:15' } } });
  ok(o2[0] && o2[0].payload === '245 (full)', 'Values prefers the full count');
  ok(o2[1] && o2[1].payload === 'Last publish: fast 10:00:05 (18) | full 10:00:15 (245)', 'last publish shows fast and full', o2[1] && o2[1].payload);
  const o3 = r.run('habridge.status', { payload: {} });
  ok(o3[0] && o3[0].payload === 'Waiting for the first publish...', 'empty state wording');
}

// ---------------- S4: updater (real brain func, mocked phases) ----------------
section('S4 updater: sentence templates, validation, merge, broker rescue, deploy texts');
{
  const r = makeRunner();
  const RAWVJ = 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-ha-bridge/main/version.json';
  const RAWFLOW = 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-ha-bridge/main/ha-bridge-flow.json';
  // button -> fetch version.json
  const c = r.run('habridge.brain', { payload: 'check' });
  ok(c && c[0] && c[0].url === RAWVJ + '?t=' + c[0].url.split('?t=')[1] && c[0].url.indexOf(RAWVJ) === 0 && c[0].method === 'GET', '[Check for updates] fetches the pinned version.json (cache-busted)', c && c[0] && c[0].url);
  ok(c[1] === null && c[2] === null, 'check phase itself displays nothing yet');
  // newer version found
  const v = r.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  ok(v[0] === null && v[1] && v[1].payload === 'Bridge update available: 1.4.0. Press [Update from GitHub].' && v[1].topic === 'HA Bridge', 'update available: one sentence on toast AND field, toast titled HA Bridge', v[1] && v[1].payload);
  ok(v[2] && v[2].payload === v[1].payload && v[2].topic === undefined, 'check result identical on the Update status field (no diverging formats)');
  // up to date
  const v2 = r.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.3.1', flowUrl: RAWFLOW } });
  ok(v2[0] === null && v2[1] && v2[1].payload === 'Up to date (1.3.1).' && v2[2].payload === v2[1].payload, 'up to date: short confirmation, same on both surfaces', v2[1] && v2[1].payload);
  // error sentence
  const v3 = r.run('habridge.brain', { habPhase: 'ver', statusCode: 404, payload: 'Not Found' });
  ok(v3[0] === null && v3[1] && v3[1].payload === 'Update failed: version.json HTTP 404.' && v3[1].topic === 'HA Bridge error' && v3[2].payload === v3[1].payload, 'fail(): same full sentence on toast and field, error topic', v3[1] && v3[1].payload);
  // tampered flowUrl
  const v4 = r.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: 'https://evil.example/x.json' } });
  ok(v4[1] && v4[1].payload.indexOf('Update failed: flowUrl refused') === 0, 'flowUrl outside the repo refused');
  // network error
  const v5 = r.run('habridge.brain', { error: { message: 'dns gone' } });
  ok(v5[1] && v5[1].payload === 'Update failed: network error (?): dns gone.', 'network errors become a readable sentence', v5[1] && v5[1].payload);

  // update button -> check -> download
  const r2 = makeRunner();
  r2.run('habridge.brain', { payload: 'update' });
  r2.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  const dl = r2.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.mqtt', type: 'mqtt out', broker: '92e5b2c.00a8b5' }
  ]) });
  ok(dl[2] && dl[2].payload === 'Downloaded bridge 1.4.0. Deploying...', 'download phase status sentence', dl[2] && dl[2].payload);
  ok(dl[0] && dl[0].url === 'http://127.0.0.1:1880/flows', 'download ok -> read running flows via loopback Admin API', dl[0] && dl[0].url);
  // 401 -> token request (env credentials)
  const t = r2.run('habridge.brain', { habPhase: 'adminflows', statusCode: 401, payload: {} });
  ok(!t[0] && t[1] && t[1].payload.indexOf('Update failed: Admin login required') === 0, '401 without env credentials fails with a clear sentence', t[1] && t[1].payload);
  r2.envVars['HAB_ADMIN_USER'] = 'u'; r2.envVars['HAB_ADMIN_PASS'] = 'p';
  r2.run('habridge.brain', { payload: 'update' });
  r2.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  r2.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.mqtt', type: 'mqtt out', broker: '92e5b2c.00a8b5' }
  ]) });
  const t2 = r2.run('habridge.brain', { habPhase: 'adminflows', statusCode: 401, payload: {} });
  ok(t2[0] && t2[0].url === 'http://127.0.0.1:1880/auth/token' && typeof t2[0].payload === 'string', '401 with env credentials -> POST /auth/token');
  const t3b = JSON.parse(t2[0].payload);
  ok(t3b.username === 'u' && t3b.password === 'p' && t3b.grant_type === 'password', 'token POST carries the env credentials');
  const t3 = r2.run('habridge.brain', { habPhase: 'token', statusCode: 200, payload: { access_token: 'tok' } });
  ok(t3[0] && t3[0].url === 'http://127.0.0.1:1880/flows' && t3[0].headers.Authorization === 'Bearer tok', 'token -> retry GET /flows with Bearer');

  // merge (v2 shape): personal nodes survive, old bridge nodes replaced, broker rescue
  const r3 = makeRunner();
  r3.run('habridge.brain', { payload: 'update' });
  r3.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  r3.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.mqtt', type: 'mqtt out', broker: '92e5b2c.00a8b5' }
  ]) });
  const d = r3.run('habridge.brain', { habPhase: 'adminflows', statusCode: 200, payload: { flows: [
    { id: 'personal.tab.1', type: 'tab', label: 'Home' },
    { id: 'habridge.tab.old', type: 'tab', label: 'old bridge' },
    { id: 'broker.local', type: 'mqtt-broker' },
    { id: 'some.in', type: 'mqtt in', broker: 'broker.local' },
    { id: 'some.out', type: 'mqtt out', broker: 'broker.local' }
  ], rev: 'r1' } });
  ok(d[0] && d[0].method === 'POST' && typeof d[0].payload === 'string', 'adminflows ok -> POST /flows deploy');
  const body = JSON.parse(d[0].payload);
  ok(body.rev === 'r1' && d[0].headers['Node-RED-API-Version'] === 'v2', 'v2 shape: rev + API version header');
  ok(body.flows.some(n => n.id === 'personal.tab.1'), 'personal tabs survive the merge');
  ok(!body.flows.some(n => n.id === 'habridge.tab.old') && body.flows.some(n => n.id === 'habridge.tab.0001'), 'only habridge.* nodes are replaced');
  ok(body.flows.find(n => n.id === 'habridge.mqtt').broker === 'broker.local', 'broker rescue: pinned broker id missing -> locally most-used broker');
  const dep = r3.run('habridge.brain', { habPhase: 'deploy', statusCode: 200, payload: {} });
  ok(dep[1] && dep[1].payload === 'Bridge update succeeded: now running 1.4.0. Fields refresh after the restart.' && dep[1].topic === 'HA Bridge', 'deploy success sentence (no arrow shorthand)', dep[1] && dep[1].payload);
  ok(dep[2] && dep[2].payload === 'Last update: 1.4.0 (ok).', 'last-update line on the Update status field', dep[2] && dep[2].payload);
  const dep2 = makeRunner();
  dep2.run('habridge.brain', { payload: 'update' });
  dep2.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  dep2.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.mqtt', type: 'mqtt out', broker: '92e5b2c.00a8b5' }
  ]) });
  dep2.run('habridge.brain', { habPhase: 'adminflows', statusCode: 200, payload: [] });
  const dep3 = dep2.run('habridge.brain', { habPhase: 'deploy', statusCode: 409, payload: {} });
  ok(dep3[1] && dep3[1].payload === 'Update failed: flows changed meanwhile (rev conflict). Press [Update from GitHub] again.' && dep3[2].payload === dep3[1].payload, 'rev conflict: one sentence with the button name on both surfaces', dep3[1] && dep3[1].payload);


  // dashboard-family guard: framework-crossing update refused, nothing deployed
  const r5 = makeRunner();
  r5.run('habridge.brain', { payload: 'update' });
  r5.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  r5.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.dash.tab', type: 'ui-page', ui: '', path: '/ha-bridge' }
  ]) });
  const g = r5.run('habridge.brain', { habPhase: 'adminflows', statusCode: 200, payload: { flows: [
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.3.1.' },
    { id: 'habridge.dash.g', type: 'ui_group', tab: 'habridge.tab.0001' },
    { id: 'personal.1', type: 'inject' }
  ], rev: 'r1' } });
  ok(g[0] === null && g[1] && g[1].payload.indexOf('Update failed: dashboard framework change refused (db1 -> db2)') === 0, 'framework-crossing update refused with a clear sentence, no POST /flows', g[1] && g[1].payload);
  const r6 = makeRunner();
  r6.run('habridge.brain', { payload: 'update' });
  r6.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  r6.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.4.0 (test).' },
    { id: 'habridge.dash.g', type: 'ui_group', tab: 'habridge.tab.0001' }
  ]) });
  const g2 = r6.run('habridge.brain', { habPhase: 'adminflows', statusCode: 200, payload: { flows: [
    { id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v1.3.1.' },
    { id: 'habridge.dash.g.old', type: 'ui_group', tab: 'habridge.tab.0001' }
  ], rev: 'r2' } });
  ok(g2[0] && g2[0].method === 'POST', 'same-family update still merges and deploys');
  // download validation
  const r4 = makeRunner();
  r4.run('habridge.brain', { payload: 'update' });
  r4.run('habridge.brain', { habPhase: 'ver', statusCode: 200, payload: { version: '1.4.0', flowUrl: RAWFLOW } });
  const bad1 = r4.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([{ id: 'foreign.node', type: 'tab' }]) });
  ok(bad1[1] && bad1[1].payload === 'Update failed: non-bridge node id in downloaded file: foreign.node.', 'foreign ids refused');
  const bad2 = r4.run('habridge.brain', { habPhase: 'flow', statusCode: 200, payload: JSON.stringify([{ id: 'habridge.tab.0001', type: 'tab', info: 'HA Bridge v0.0.1 (mismatch).' }]) });
  ok(bad2[1] && bad2[1].payload === 'Update failed: file version does not match version.json.', 'tab-info version must match version.json');
}

console.log('\nTOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
