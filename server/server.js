const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
// Parse, so the EADDRINUSE fallback increments the port instead of concatenating.
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'archives.json');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function read() {
  if (!fs.existsSync(DATA_FILE)) return { archives: [] };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { archives: [] };
  }
}

function write(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/archive', (req, res) => {
  const { domain, label, tabs } = req.body;
  if (!domain || !Array.isArray(tabs) || tabs.length === 0) {
    return res.status(400).json({ error: 'domain and tabs are required' });
  }
  const data = read();
  data.archives.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    domain,
    label: label || null,
    tabs,
  });
  write(data);
  res.json({ success: true });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, pid: process.pid, port: activePort }));

app.post('/api/shutdown', (_req, res) => {
  res.json({ success: true });
  // Give the response time to flush before tearing the process down.
  setTimeout(() => shutdown('api'), 50);
});

app.get('/api/archives', (_req, res) => {
  res.json(read().archives);
});

app.delete('/api/archives/:id', (req, res) => {
  const data = read();
  const before = data.archives.length;
  data.archives = data.archives.filter(a => a.id !== req.params.id);
  if (data.archives.length === before) return res.status(404).json({ error: 'Not found' });
  write(data);
  res.json({ success: true });
});

let activePort = null;
let server = null;

function shutdown(reason) {
  console.log(`Archivist shutting down (${reason})`);
  try {
    if (fs.existsSync(RUNTIME_FILE)) fs.unlinkSync(RUNTIME_FILE);
  } catch { /* best effort */ }
  server?.close(() => process.exit(0));
  // Don't wait for lingering keep-alive connections.
  setTimeout(() => process.exit(0), 1000).unref();
}

function listen(port) {
  // Loopback only: the endpoints are unauthenticated, so binding every
  // interface would let anyone on the same network read, delete or shut down.
  server = app.listen(port, '127.0.0.1')
    .on('listening', () => {
      activePort = port;
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(RUNTIME_FILE, JSON.stringify({ pid: process.pid, port }, null, 2));
      console.log(`Archivist running at http://localhost:${port}`);
    })
    .on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}…`);
        listen(port + 1);
      } else {
        throw err;
      }
    });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

listen(PORT);
