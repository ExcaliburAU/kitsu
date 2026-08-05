const fs = require('fs');
const path = require('path');

let readyPromise = null;
/** @type {string | null} */
let activeDataDir = null;

/**
 * Install a persistent IndexedDB polyfill for Node so matrix-js-sdk rust crypto
 * can keep Olm/Megolm keys across Kitsu restarts.
 */
function ensureCryptoIndexedDb(dataDir) {
  const dir = path.resolve(dataDir);
  if (readyPromise && activeDataDir === dir) return readyPromise;
  activeDataDir = dir;
  readyPromise = (async () => {
    fs.mkdirSync(dir, { recursive: true });
    const idbDir = path.join(dir, 'indexeddb');
    fs.mkdirSync(idbDir, { recursive: true });
    // Stale LevelDB locks from crashed AppImage instances cause "Database is not open".
    try {
      fs.rmSync(path.join(idbDir, 'LOCK'), { force: true });
    } catch {
      // ignore
    }
    const prev = process.cwd();
    process.chdir(dir);
    try {
      // eslint-disable-next-line global-require
      const dbManager = require('node-indexeddb/dbManager');
      await dbManager.loadCache();
      // eslint-disable-next-line global-require
      require('node-indexeddb/auto');
    } finally {
      process.chdir(prev);
    }
  })().catch((error) => {
    readyPromise = null;
    activeDataDir = null;
    throw error;
  });
  return readyPromise;
}

/**
 * Close/reopen the IndexedDB polyfill after a lock or "Database is not open" failure.
 */
async function recoverCryptoIndexedDb(dataDir, { wipe = false } = {}) {
  readyPromise = null;
  activeDataDir = null;
  if (wipe) resetCryptoIndexedDb(dataDir);
  else {
    try {
      fs.rmSync(path.join(path.resolve(dataDir), 'indexeddb', 'LOCK'), { force: true });
    } catch {
      // ignore
    }
  }
  return ensureCryptoIndexedDb(dataDir);
}

/**
 * Wipe the on-disk IndexedDB polyfill store (used after device/account mismatch).
 * Caller must not have an active Matrix crypto session using it.
 */
function resetCryptoIndexedDb(dataDir) {
  const dir = path.resolve(dataDir);
  const idbDir = path.join(dir, 'indexeddb');
  try {
    fs.rmSync(idbDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[cryptoStore] failed to reset indexeddb:', error?.message || error);
  }
  readyPromise = null;
  activeDataDir = null;
}

function cryptoDatabasePrefix(userId, deviceId) {
  const user = String(userId || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const device = String(deviceId || 'nodevice').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `relay-crypto-${user}-${device}`;
}

module.exports = {
  ensureCryptoIndexedDb,
  recoverCryptoIndexedDb,
  resetCryptoIndexedDb,
  cryptoDatabasePrefix,
};
