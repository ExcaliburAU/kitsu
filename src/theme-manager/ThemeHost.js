const https = require('https');
const http = require('http');

/**
 * ThemeHost — remote theme catalog + CSS packs.
 *
 * Built-in themes ship with Kitsu. Extra packs will live in a dedicated Themes
 * repository. Wire it with RELAY_THEMES_INDEX / RELAY_THEMES_BASE (or constructor
 * options). Until then the API stays available and returns an empty catalog.
 *
 * Expected layout (when configured):
 *   {indexUrl}  → { themes: ["pack-id", ...] }
 *   {baseUrl}{id}.json → metadata (label, scheme, colors, optional cssUrl)
 *   {baseUrl}packs/{id}.css → theme CSS
 */
class ThemeHost {
  constructor(options = {}) {
    this.remoteIndexUrl =
      options.remoteIndexUrl || process.env.RELAY_THEMES_INDEX || '';
    this.remoteBaseUrl =
      options.remoteBaseUrl || process.env.RELAY_THEMES_BASE || '';
    this.cacheDir = options.cacheDir || null;

    this.catalog = [];
    this.cssById = new Map();
    this.fetchedAt = null;
  }

  isConfigured() {
    return Boolean(this.remoteIndexUrl && this.remoteBaseUrl);
  }

  /**
   * Returns the last successfully fetched catalog (sync).
   */
  getCachedCatalog() {
    return this.catalog;
  }

  /**
   * Fetches theme catalog from remote index + per-theme metadata.
   * On failure returns the last cached catalog or [].
   */
  async getCatalog() {
    if (!this.isConfigured()) {
      return this.catalog.length > 0 ? this.catalog : [];
    }

    try {
      const indexData = await this.fetchJson(this.remoteIndexUrl);
      if (!indexData || !Array.isArray(indexData.themes)) {
        return this.catalog.length > 0 ? this.catalog : [];
      }

      const metadataPromises = indexData.themes.map(async (themeId) => {
        try {
          const metaUrl = `${this.remoteBaseUrl}${themeId}.json`;
          const meta = await this.fetchJson(metaUrl);
          return meta ? { id: themeId, ...meta } : null;
        } catch {
          return null;
        }
      });

      const themes = (await Promise.all(metadataPromises)).filter(Boolean);
      if (themes.length > 0) {
        this.catalog = themes;
        this.fetchedAt = Date.now();
      }

      return this.catalog.length > 0 ? this.catalog : [];
    } catch {
      return this.catalog.length > 0 ? this.catalog : [];
    }
  }

  /**
   * Fetches CSS for a theme by id. Returns cached text or null if unavailable.
   */
  async getThemeCss(id) {
    if (!id || !/^[a-z0-9-]+$/i.test(id)) {
      return null;
    }

    if (this.cssById.has(id)) {
      return this.cssById.get(id);
    }

    if (!this.isConfigured() && !this.catalog.some((theme) => theme.id === id)) {
      return null;
    }

    try {
      let cssUrl = this.remoteBaseUrl
        ? `${this.remoteBaseUrl}packs/${id}.css`
        : null;

      const cachedMeta = this.catalog.find((theme) => theme.id === id);
      if (cachedMeta && cachedMeta.cssUrl) {
        cssUrl = cachedMeta.cssUrl;
      } else if (this.remoteBaseUrl) {
        try {
          const meta = await this.fetchJson(`${this.remoteBaseUrl}${id}.json`);
          if (meta && meta.cssUrl) {
            cssUrl = meta.cssUrl;
          }
        } catch {
          // Fall back to default packs URL.
        }
      }

      if (!cssUrl) return null;

      const css = await this.fetchText(cssUrl);
      if (!css) {
        return null;
      }

      this.cssById.set(id, css);
      return css;
    } catch {
      return null;
    }
  }

  /**
   * Fetches JSON from HTTP/HTTPS URL.
   */
  fetchJson(url) {
    return this.fetchText(url).then((text) => {
      const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
      return JSON.parse(cleaned);
    });
  }

  /**
   * Fetches raw text from HTTP/HTTPS URL.
   */
  fetchText(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const request = client.get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchText(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Timeout fetching ${url}`));
      });
    });
  }
}

module.exports = { ThemeHost };
