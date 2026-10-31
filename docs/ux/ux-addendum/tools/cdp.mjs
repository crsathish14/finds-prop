// Minimal Chrome DevTools Protocol helper. No dependencies: Node 22+ (global WebSocket, fetch) and a local Chrome.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Chrome/Edge found. Set the CHROME environment variable to its path.');
  return hit;
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(`${m.error.message}`)) : res(m.result);
      } else {
        for (const l of [...this.listeners]) l(m);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  once(event) {
    return new Promise((res) => {
      const off = this.on((m) => { if (m.method === event) { off(); res(m.params); } });
    });
  }
}

export async function launch() {
  const port = 9300 + Math.floor(Math.random() * 600);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-chrome-'));
  const proc = spawn(findChrome(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--force-color-profile=srgb', '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) target = await r.json();
    } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new Client(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  const close = async () => {
    try { ws.close(); } catch { /* ignore */ }
    proc.kill();
    await sleep(300);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  return { cdp, close };
}

/** Load a URL at a viewport size and wait for fonts and layout. Returns collected problems. */
export async function open(cdp, { url, w, h = 900, dsf = 1 }) {
  const problems = [];
  const off = cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/fonts\.g(static|oogleapis)/.test(m.params.entry.url || '')) problems.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: false });
  // Blank first so hash-only changes still trigger a full load.
  const blank = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await blank;
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>document.fonts.size)', awaitPromise: true });
  await sleep(350);
  off();
  return problems;
}

export async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
  return r.result.value;
}

export async function screenshot(cdp, { out, w, fold = false, h = 900, format = 'png', quality = 90 }) {
  let H = h;
  if (!fold) H = await evalJs(cdp, 'Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))');
  const q = format === 'png' ? {} : { quality };
  const params = fold
    ? { format, ...q }
    : { format, ...q, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: H, scale: 1 } };
  const { data } = await cdp.send('Page.captureScreenshot', params);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  return H;
}
