const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const { EventEmitter } = require('events');

/**
 * Lean PluginHost for Kitsu.
 * Loads CJS plugins from pluginsDir with onLoad/onUnload + settings + events.
 */
class PluginHost {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || path.join(__dirname, '..', '..', 'plugins');
    this.disabledFile = path.join(this.pluginsDir, '.disabled-plugins.json');
    this.disabledPluginIds = new Set();
    this.loaded = new Map();
    this.eventBus = new EventEmitter();
    this.featuresByPlugin = new Map();
  }

  async init() {
    await fs.mkdir(this.pluginsDir, { recursive: true });
    await this.loadDisabledList();
    await this.loadInstalledPlugins();
  }

  async loadDisabledList() {
    try {
      const raw = await fs.readFile(this.disabledFile, 'utf8');
      const parsed = JSON.parse(raw);
      this.disabledPluginIds = new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.disabledPluginIds = new Set();
    }
  }

  async saveDisabledList() {
    await fs.mkdir(path.dirname(this.disabledFile), { recursive: true });
    await fs.writeFile(this.disabledFile, JSON.stringify([...this.disabledPluginIds], null, 2), 'utf8');
  }

  createContext(pluginId, pluginPath) {
    const settingsPath = path.join(pluginPath, 'settings.json');
    const features = new Set();
    this.featuresByPlugin.set(pluginId, features);

    return {
      pluginId,
      pluginPath,
      log: (...args) => console.log(`[plugin:${pluginId}]`, ...args),
      events: {
        on: (event, handler) => this.eventBus.on(event, handler),
        off: (event, handler) => this.eventBus.off(event, handler),
        emit: (event, payload) => this.eventBus.emit(event, payload),
      },
      settings: {
        get: async () => {
          try {
            return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
          } catch {
            return {};
          }
        },
        set: async (value) => {
          await fs.writeFile(settingsPath, JSON.stringify(value ?? {}, null, 2), 'utf8');
        },
      },
      ui: {
        enableFeature: (name) => {
          if (typeof name === 'string' && name) features.add(name);
        },
        disableFeature: (name) => {
          features.delete(name);
        },
      },
    };
  }

  async loadInstalledPlugins() {
    let entries = [];
    try {
      entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      if (this.disabledPluginIds.has(entry.name)) continue;
      await this.loadPlugin(entry.name);
    }
  }

  async loadPlugin(pluginId) {
    if (this.loaded.has(pluginId)) return;

    const pluginPath = path.join(this.pluginsDir, pluginId);
    const indexPath = path.join(pluginPath, 'index.js');
    if (!fssync.existsSync(indexPath)) return;

    // Fresh require each load
    delete require.cache[require.resolve(indexPath)];
    const mod = require(indexPath);
    const api = mod && typeof mod === 'object' ? mod : {};
    const ctx = this.createContext(pluginId, pluginPath);

    if (typeof api.onLoad === 'function') {
      await api.onLoad(ctx);
    } else if (typeof api.activate === 'function') {
      await api.activate(ctx);
    }

    this.loaded.set(pluginId, { api, ctx, pluginPath });
  }

  async unloadPlugin(pluginId) {
    const entry = this.loaded.get(pluginId);
    if (!entry) return;

    try {
      if (typeof entry.api.onUnload === 'function') {
        await entry.api.onUnload(entry.ctx);
      } else if (typeof entry.api.deactivate === 'function') {
        await entry.api.deactivate(entry.ctx);
      }
    } catch (error) {
      console.error(`[PluginHost] unload failed for ${pluginId}:`, error);
    }

    this.loaded.delete(pluginId);
    this.featuresByPlugin.delete(pluginId);
  }

  async setEnabled(pluginId, enabled) {
    if (enabled) {
      this.disabledPluginIds.delete(pluginId);
      await this.saveDisabledList();
      await this.loadPlugin(pluginId);
    } else {
      this.disabledPluginIds.add(pluginId);
      await this.saveDisabledList();
      await this.unloadPlugin(pluginId);
    }
  }

  emit(event, payload) {
    this.eventBus.emit(event, payload);
  }

  listPlugins() {
    let dirs = [];
    try {
      dirs = fssync
        .readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name);
    } catch {
      dirs = [];
    }

    return dirs.map((pluginId) => {
      const pluginPath = path.join(this.pluginsDir, pluginId);
      let meta = { id: pluginId, name: pluginId, version: '0.0.0' };
      try {
        const pkg = JSON.parse(fssync.readFileSync(path.join(pluginPath, 'package.json'), 'utf8'));
        meta = {
          id: pluginId,
          name: pkg.displayName || pkg.name || pluginId,
          version: pkg.version || '0.0.0',
          description: pkg.description || '',
        };
      } catch {
        // ignore
      }

      const features = [...(this.featuresByPlugin.get(pluginId) || [])];
      return {
        ...meta,
        enabled: !this.disabledPluginIds.has(pluginId),
        loaded: this.loaded.has(pluginId),
        features,
      };
    });
  }
}

module.exports = { PluginHost };
