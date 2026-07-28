const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Relay TURN / ICE configuration.
 * Prefer homeserver /voip/turnServer when present; otherwise use Relay-owned
 * TURN (env or voip.json) so calls still work when the HS returns {}.
 */
class VoipConfig {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', '..', '.relay-data');
    this.file = path.join(this.dataDir, 'voip.json');
  }

  setDataDir(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'voip.json');
  }

  defaultsFromEnv() {
    const uris = String(process.env.RELAY_TURN_URIS || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const forceRaw = String(process.env.RELAY_FORCE_TURN || '').toLowerCase();
    return {
      uris,
      username: process.env.RELAY_TURN_USERNAME || '',
      credential: process.env.RELAY_TURN_CREDENTIAL || '',
      sharedSecret: process.env.RELAY_TURN_SHARED_SECRET || '',
      ttl: Number(process.env.RELAY_TURN_TTL || 86400) || 86400,
      forceTurn: forceRaw === '1' || forceRaw === 'true' || forceRaw === 'yes',
    };
  }

  readStored() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  }

  read() {
    const env = this.defaultsFromEnv();
    const stored = this.readStored();
    const uris = Array.isArray(stored.uris)
      ? stored.uris.map((u) => String(u || '').trim()).filter(Boolean)
      : [];

    return {
      uris: uris.length ? uris : env.uris,
      username:
        typeof stored.username === 'string' && stored.username.length
          ? stored.username
          : env.username,
      credential:
        typeof stored.credential === 'string' && stored.credential.length
          ? stored.credential
          : env.credential,
      sharedSecret:
        typeof stored.sharedSecret === 'string' && stored.sharedSecret.length
          ? stored.sharedSecret
          : env.sharedSecret,
      ttl: Number(stored.ttl || env.ttl || 86400) || 86400,
      forceTurn:
        typeof stored.forceTurn === 'boolean' ? stored.forceTurn : Boolean(env.forceTurn),
    };
  }

  /** Safe for Settings UI — never returns raw secrets. */
  getPublic() {
    const config = this.read();
    return {
      uris: config.uris,
      username: config.username,
      hasCredential: Boolean(config.credential),
      hasSharedSecret: Boolean(config.sharedSecret),
      ttl: config.ttl,
      forceTurn: config.forceTurn,
    };
  }

  write(partial = {}) {
    const current = this.read();
    const nextUris = Array.isArray(partial.uris)
      ? partial.uris.map((u) => String(u || '').trim()).filter(Boolean)
      : current.uris;

    const next = {
      uris: nextUris,
      username:
        partial.username !== undefined ? String(partial.username || '') : current.username,
      credential:
        partial.credential !== undefined
          ? String(partial.credential || '')
          : current.credential,
      sharedSecret:
        partial.sharedSecret !== undefined
          ? String(partial.sharedSecret || '')
          : current.sharedSecret,
      ttl: Number(partial.ttl !== undefined ? partial.ttl : current.ttl) || 86400,
      forceTurn:
        typeof partial.forceTurn === 'boolean' ? partial.forceTurn : Boolean(current.forceTurn),
    };

    // Empty credential/sharedSecret fields from the form mean "leave unchanged"
    // unless the client explicitly clears with clearCredential / clearSharedSecret.
    if (partial.credential === '' && !partial.clearCredential) {
      next.credential = current.credential;
    }
    if (partial.sharedSecret === '' && !partial.clearSharedSecret) {
      next.sharedSecret = current.sharedSecret;
    }
    if (partial.clearCredential) next.credential = '';
    if (partial.clearSharedSecret) next.sharedSecret = '';

    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(next, null, 2), 'utf8');
    return this.getPublic();
  }

  /**
   * Build RTCIceServer entries from Relay-owned TURN.
   * Supports static username/password or coturn time-limited shared-secret auth.
   */
  buildCustomIceServers(userId) {
    const config = this.read();
    if (!config.uris.length) return [];

    if (config.sharedSecret) {
      const ttl = Math.max(60, Number(config.ttl) || 86400);
      const expiry = Math.floor(Date.now() / 1000) + ttl;
      const username = `${expiry}:${userId || 'relay'}`;
      const credential = crypto
        .createHmac('sha1', config.sharedSecret)
        .update(username)
        .digest('base64');
      return [
        {
          urls: config.uris,
          username,
          credential,
        },
      ];
    }

    if (config.username && config.credential) {
      return [
        {
          urls: config.uris,
          username: config.username,
          credential: config.credential,
        },
      ];
    }

    return [{ urls: config.uris }];
  }
}

module.exports = { VoipConfig };
