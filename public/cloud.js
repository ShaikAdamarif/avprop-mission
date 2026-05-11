// Self-hosted sync shim — talks to the bundled Node + SQLite server.
const SHARED_PREFIX = 'av_';
const LOCAL_ONLY = new Set(['av_session']);
const isShared = (k) => typeof k === 'string' && k.startsWith(SHARED_PREFIX) && !LOCAL_ONLY.has(k);

async function hydrate() {
  try {
    const r = await fetch('/api/kv');
    const data = await r.json();
    for (const [key, value] of Object.entries(data || {})) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  } catch (e) { console.error('[sync] hydrate', e); }
}

const origSet = Storage.prototype.setItem;
const origDel = Storage.prototype.removeItem;
let suppress = false;

Storage.prototype.setItem = function (key, value) {
  origSet.call(this, key, value);
  if (this === localStorage && !suppress && isShared(key)) {
    let parsed; try { parsed = JSON.parse(value); } catch { parsed = value; }
    fetch('/api/kv/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: parsed })
    }).catch(e => console.error('[sync] push', key, e));
  }
};

Storage.prototype.removeItem = function (key) {
  origDel.call(this, key);
  if (this === localStorage && !suppress && isShared(key)) {
    fetch('/api/kv/' + encodeURIComponent(key), { method: 'DELETE' })
      .catch(e => console.error('[sync] del', key, e));
  }
};

function subscribe() {
  try {
    const es = new EventSource('/api/stream');
    es.onmessage = (m) => {
      let evt; try { evt = JSON.parse(m.data); } catch { return; }
      if (!evt || !isShared(evt.key)) return;
      suppress = true;
      try {
        if (evt.type === 'del') localStorage.removeItem(evt.key);
        else localStorage.setItem(evt.key, JSON.stringify(evt.value));
      } finally { suppress = false; }
      window.dispatchEvent(new StorageEvent('storage', { key: evt.key }));
      if (typeof window.renderAll === 'function') { try { window.renderAll(); } catch {} }
    };
    es.onerror = () => { /* auto-reconnects */ };
  } catch (e) { console.error('[sync] subscribe', e); }
}

window.__cloudReady = (async () => { await hydrate(); subscribe(); })();
