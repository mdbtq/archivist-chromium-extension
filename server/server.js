const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'archives.json');

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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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

function listen(port) {
  app.listen(port)
    .on('listening', () => console.log(`Archivist running at http://localhost:${port}`))
    .on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}…`);
        listen(port + 1);
      } else {
        throw err;
      }
    });
}

listen(PORT);
