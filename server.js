// AV PROP MISSION - self-hosted server (Node + Express + SQLite)
// Serves the SPA and provides a shared key-value store with realtime sync (SSE).

const path = require('path');
const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;

// On Render, mount a persistent disk at /var/data.
// Locally, use ./data
const DATA_DIR =
  process.env.DATA_DIR ||
  (fs.existsSync('/var/data')
    ? '/var/data'
    : path.join(__dirname, 'data'));

fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'avprop.db');

// Open database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Prepared statements
const getAll = db.prepare(`
  SELECT key, value
  FROM kv_store
`);

const upsert = db.prepare(`
  INSERT INTO kv_store (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key)
  DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const delKey = db.prepare(`
  DELETE FROM kv_store
  WHERE key = ?
`);

const app = express();
app.use(express.json({ limit: '20mb' }));

// -----------------------------
// SSE clients for realtime sync
// -----------------------------
const clients = new Set();

function broadcast(evt) {
  const payload = `data: ${JSON.stringify(evt)}\n\n`;

  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      // Ignore broken connections
    }
  }
}

// -----------------------------
// API Routes
// -----------------------------

// Get all key-values
app.get('/api/kv', (_req, res) => {
  const rows = getAll.all();
  const out = {};

  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }

  res.json(out);
});

// Upsert a key
app.put('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  const json = JSON.stringify(value ?? null);

  upsert.run(key, json, new Date().toISOString());

  broadcast({
    type: 'set',
    key,
    value
  });

  res.json({ ok: true });
});

// Delete a key
app.delete('/api/kv/:key', (req, res) => {
  const key = req.params.key;

  delKey.run(key);

  broadcast({
    type: 'del',
    key
  });

  res.json({ ok: true });
});

// Server-Sent Events stream
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.flushHeaders();
  res.write(': connected\n\n');

  clients.add(res);

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (err) {
      // Ignore
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

// -----------------------------
// Static SPA
// -----------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`AV PROP MISSION running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
