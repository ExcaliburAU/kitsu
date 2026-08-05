(() => {
  const KEY = 'kitsu.mobile.serverUrl';
  const input = document.getElementById('hostInput');
  const connectBtn = document.getElementById('connectBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');

  function setStatus(message, ok = false) {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || '';
    status.classList.toggle('ok', Boolean(ok));
  }

  function normalizeUrl(raw) {
    let value = String(raw || '').trim();
    if (!value) return '';
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
    const url = new URL(value);
    if (!url.port && url.protocol === 'http:') url.port = '6080';
    return url.toString().replace(/\/$/, '');
  }

  async function probe(base) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(`${base}/api/health`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  }

  async function connect() {
    setStatus('');
    let base;
    try {
      base = normalizeUrl(input.value);
    } catch {
      setStatus('Enter a valid address like http://192.168.1.20:6080');
      return;
    }
    if (!base) {
      setStatus('Enter your PC address first.');
      return;
    }

    connectBtn.disabled = true;
    setStatus('Looking for Kitsu…', true);
    try {
      const health = await probe(base);
      localStorage.setItem(KEY, base);
      setStatus(`Found ${health?.name || 'Kitsu'} — opening…`, true);
      // Full navigation into the desktop UI served by Kitsu.
      window.location.href = `${base}/`;
    } catch (error) {
      setStatus(
        `Could not reach Kitsu at ${base}. Is Mobile companion on, and are you on the same Wi‑Fi? (${error.message || error})`,
      );
    } finally {
      connectBtn.disabled = false;
    }
  }

  const saved = localStorage.getItem(KEY);
  if (saved) {
    input.value = saved;
    // Auto-try saved host once.
    void connect();
  }

  connectBtn.addEventListener('click', () => void connect());
  clearBtn.addEventListener('click', () => {
    localStorage.removeItem(KEY);
    input.value = '';
    setStatus('Cleared saved address.', true);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void connect();
    }
  });
})();
