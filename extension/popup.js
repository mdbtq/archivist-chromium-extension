let SERVER = null;
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

  const [, found] = await Promise.all([
    domain ? load(domain) : Promise.resolve(),
    findServer(),
  ]);

  SERVER = found;
  if (!SERVER) {
    showStatus('Server not found on ports 3000–3009. Run: cd server && npm start', 'error');
    document.getElementById('archive-btn').disabled = true;
  }

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
