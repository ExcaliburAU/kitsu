const fs = require('fs');
const path = require('path');

/**
 * Persists workspace-rail space order / folders / hidden spaces under dataDir.
 * localStorage alone is not enough in Electron because the listen port changes
 * each launch (origin-scoped storage resets).
 */
class SidebarStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', '..', '.relay-data');
    this.file = path.join(this.dataDir, 'sidebar.json');
  }

  setDataDir(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'sidebar.json');
  }

  empty() {
    return {
      spaceOrder: [],
      spaceFolders: [],
      hiddenSpaces: [],
    };
  }

  read() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!raw || typeof raw !== 'object') return this.empty();
      return {
        spaceOrder: Array.isArray(raw.spaceOrder)
          ? raw.spaceOrder.filter((id) => typeof id === 'string')
          : [],
        spaceFolders: Array.isArray(raw.spaceFolders) ? raw.spaceFolders : [],
        hiddenSpaces: Array.isArray(raw.hiddenSpaces)
          ? raw.hiddenSpaces.filter((id) => typeof id === 'string')
          : [],
      };
    } catch {
      return this.empty();
    }
  }

  write(patch = {}) {
    const current = this.read();
    const next = {
      spaceOrder: Array.isArray(patch.spaceOrder)
        ? patch.spaceOrder.filter((id) => typeof id === 'string')
        : current.spaceOrder,
      spaceFolders: Array.isArray(patch.spaceFolders) ? patch.spaceFolders : current.spaceFolders,
      hiddenSpaces: Array.isArray(patch.hiddenSpaces)
        ? patch.hiddenSpaces.filter((id) => typeof id === 'string')
        : current.hiddenSpaces,
      updatedAt: Date.now(),
    };
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }
}

module.exports = { SidebarStore };
