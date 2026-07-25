const HOST_NAME = 'nl.mdbtq.archivist';

let SERVER = null;
let hostAvailable = true;
let tabs = [];

async function findServer(base = 3000, range = 10) {
  for (let port = base; port < base + range; port++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(400),
      });
      if (res.ok) return `http://localhost:${port}`;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Sends a single command to the native messaging host. Resolves to null when the
 * host is not registered, which is the normal state until install-host.js runs.
 */
function callHost(command) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendNativeMessage(HOST_NAME, { command }, response => {
        if (chrome.runtime.lastError) {
          hostAvailable = false;
          return resolve(null);
        }
        resolve(response);
      });
    } catch {
      hostAvailable = false;
      resolve(null);
    }
  });
}

function hostname(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function createTabItem(tab, index) {
  const div = document.createElement('div');
  div.className = 'tab-item';

  const label = document.createElement('label');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.dataset.i = index;
  cb.checked = true;
  label.appendChild(cb);

  if (tab.favIconUrl?.startsWith('http')) {
    const img = document.createElement('img');
    img.className = 'fav';
    img.src = tab.favIconUrl;
    img.onerror = () => img.remove();
    label.appendChild(img);
  }

  const span = document.createElement('span');
  span.className = 'title';
  span.textContent = tab.title || tab.url;
  label.appendChild(span);

  div.appendChild(label);
  return div;
}

function render() {
  const list = document.getElementById('tabs-list');
  list.replaceChildren(...tabs.map((t, i) => createTabItem(t, i)));
}

async function load(domain) {
  const all = await chrome.tabs.query({});
  tabs = all.filter(t => {
    const h = hostname(t.url);
    return h === domain || h.endsWith('.' + domain);
  });

  const section = document.getElementById('tabs-section');
  const empty = document.getElementById('empty-state');
  document.getElementById('status').classList.add('hidden');

  if (tabs.length === 0) {
    section.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    section.classList.remove('hidden');
    document.getElementById('tab-count').textContent =
      `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;
    render();
  }
}

async function archive() {
  const checked = [...document.querySelectorAll('#tabs-list input:checked')];
  const selected = checked.map(cb => tabs[+cb.dataset.i]);
  if (!selected.length) return showStatus('Select at least one tab.', 'error');

  const domain = document.getElementById('domain-input').value.trim();
  const label = document.getElementById('label-input').value.trim() || null;
  const closeAfter = document.getElementById('close-tabs-cb').checked;

  try {
    const res = await fetch(`${SERVER}/api/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        label,
        tabs: selected.map(t => ({
          title: t.title || null,
          url: t.url,
          favIconUrl: t.favIconUrl?.startsWith('http') ? t.favIconUrl : null,
        })),
      }),
    });
    if (!res.ok) throw new Error();
    if (closeAfter) await chrome.tabs.remove(selected.map(t => t.id).filter(Boolean));
    showStatus(`✓ Archived ${selected.length} tab${selected.length !== 1 ? 's' : ''}`, 'success');
  } catch {
    showStatus('Server unreachable — start it with: cd server && npm start', 'error');
  }
}

function renderServerState(state, detail) {
  const wrap = document.getElementById('server-status');
  const label = document.getElementById('server-label');
  const btn = document.getElementById('server-toggle-btn');

  wrap.className = `server-status ${state}`;
  label.textContent = detail;
  btn.dataset.action = state === 'running' ? 'stop' : 'start';

  if (state === 'busy') {
    btn.textContent = '…';
    btn.disabled = true;
  } else {
    btn.textContent = state === 'running' ? 'Stop' : 'Start';
    // Starting requires the native host; stopping goes through the server itself.
    btn.disabled = state === 'stopped' && !hostAvailable;
  }

  document.getElementById('archive-btn').disabled = !SERVER;
  document.getElementById('open-viewer-btn').disabled = !SERVER;
}

/** Refreshes SERVER and the header state. Returns true when the server is up. */
async function refreshServerState() {
  SERVER = await findServer();
  if (SERVER) {
    renderServerState('running', `Server on :${new URL(SERVER).port}`);
    return true;
  }
  // Probe the host so the Start button reflects whether it can actually work.
  if (hostAvailable) await callHost('status');
  renderServerState('stopped', hostAvailable ? 'Server stopped' : 'Host not installed');
  return false;
}

async function startServer() {
  renderServerState('busy', 'Starting…');

  const res = await callHost('start');
  if (!res) {
    renderServerState('stopped', 'Host not installed');
    return showStatus('Native host not registered. Run: node host/install-host.js <extension-id>', 'error');
  }
  if (res.error) {
    await refreshServerState();
    return showStatus(res.error, 'error');
  }

  if (await refreshServerState()) {
    showStatus('✓ Server started', 'success');
  } else {
    showStatus('Server started but is not responding yet. Try reopening the popup.', 'error');
  }
}

/**
 * Polls a single origin until it stops answering. The shutdown response is sent
 * before the process actually exits, so the port stays live for a moment after.
 */
async function waitUntilDown(origin, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(400) });
      if (!res.ok) return true;
    } catch {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

async function stopServer() {
  renderServerState('busy', 'Stopping…');
  const origin = SERVER;

  // Ask the server to exit itself; this works even without the native host.
  let accepted = false;
  try {
    const res = await fetch(`${origin}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    accepted = res.ok;
  } catch { /* fall back to the host */ }

  if (!accepted) await callHost('stop');

  const down = await waitUntilDown(origin);
  await refreshServerState();
  showStatus(down ? '✓ Server stopped' : 'Server did not stop.', down ? 'success' : 'error');
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  const [cur] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = hostname(cur?.url || '');
  if (domain) document.getElementById('domain-input').value = domain;

  await Promise.all([
    domain ? load(domain) : Promise.resolve(),
    refreshServerState(),
  ]);

  document.getElementById('server-toggle-btn').onclick = e =>
    e.currentTarget.dataset.action === 'stop' ? stopServer() : startServer();

  document.getElementById('search-btn').onclick = () => {
    const d = document.getElementById('domain-input').value.trim();
    if (d) load(d);
  };

  document.getElementById('domain-input').onkeydown = e => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
  };

  document.getElementById('select-all-btn').onclick = () =>
    document.querySelectorAll('#tabs-list input').forEach(cb => (cb.checked = true));

  document.getElementById('deselect-all-btn').onclick = () =>
    document.querySelectorAll('#tabs-list input').forEach(cb => (cb.checked = false));

  document.getElementById('archive-btn').onclick = archive;

  document.getElementById('open-viewer-btn').onclick = () => {
    if (SERVER) chrome.tabs.create({ url: SERVER });
  };
});
