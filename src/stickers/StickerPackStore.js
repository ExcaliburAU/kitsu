const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BUILTIN_PACK_ID = 'builtin-emoji';
const BUNDLED_PACKS_ROOT = path.join(__dirname, '..', '..', 'assets', 'sticker-packs');

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 30000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        reject(new Error(`Download failed (${res.statusCode})`));
        return;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const stream = fs.createWriteStream(destPath);
      res.pipe(stream);
      stream.on('finish', () => resolve(destPath));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out'));
    });
  });
}

function parseTelegramPackName(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const match =
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/addstickers\/([A-Za-z0-9_]+)/i.exec(raw) ||
    /^([A-Za-z0-9_]+)$/.exec(raw);
  return match?.[1] || null;
}

function safePackDirName(name) {
  return String(name || 'pack')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
}

/**
 * Local sticker packs (bundled + Telegram imports).
 */
class StickerPackStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', '..', '.relay-data');
    this.stateFile = path.join(this.dataDir, 'sticker-packs.json');
    this.packsDir = path.join(this.dataDir, 'sticker-packs');
    this.bundledRoot = options.bundledRoot || BUNDLED_PACKS_ROOT;
  }

  setDataDir(dataDir) {
    this.dataDir = dataDir;
    this.stateFile = path.join(this.dataDir, 'sticker-packs.json');
    this.packsDir = path.join(this.dataDir, 'sticker-packs');
  }

  ensureDirs() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.packsDir, { recursive: true });
  }

  loadBundledPacks() {
    const packs = [];
    try {
      if (!fs.existsSync(this.bundledRoot)) return packs;
      const dirs = fs
        .readdirSync(this.bundledRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const dirName of dirs) {
        const metaPath = path.join(this.bundledRoot, dirName, 'pack.json');
        if (!fs.existsSync(metaPath)) continue;
        let meta;
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {
          continue;
        }
        const packId = String(meta.id || `bundled-${dirName}`);
        const stickers = (Array.isArray(meta.stickers) ? meta.stickers : [])
          .map((sticker, index) => {
            const fileName = String(sticker.fileName || '');
            if (!fileName) return null;
            const full = path.join(this.bundledRoot, dirName, path.basename(fileName));
            if (!fs.existsSync(full)) return null;
            return {
              id: String(sticker.id || `${packId}-${index}`),
              fileName: path.basename(fileName),
              emoji: String(sticker.emoji || ''),
              url: `/api/stickers/file/${encodeURIComponent(dirName)}/${encodeURIComponent(path.basename(fileName))}`,
            };
          })
          .filter(Boolean);
        if (!stickers.length) continue;
        packs.push({
          id: packId,
          name: String(meta.name || dirName),
          source: 'bundled',
          telegramName: dirName,
          dirName,
          stickers,
          bundled: true,
          builtin: false,
        });
      }
    } catch {
      // ignore missing bundled packs
    }
    return packs;
  }

  readState() {
    const bundled = this.loadBundledPacks();
    const bundledIds = bundled.map((pack) => pack.id);
    const defaultBundledId = bundledIds[0] || BUILTIN_PACK_ID;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      let favoritePackIds = Array.isArray(parsed?.favoritePackIds) ? parsed.favoritePackIds : [];
      let defaultPackId = parsed?.defaultPackId || defaultBundledId;
      // First run / empty favorites: prefer bundled image packs over emoji fallback.
      if (
        (!favoritePackIds.length ||
          (favoritePackIds.length === 1 && favoritePackIds[0] === BUILTIN_PACK_ID)) &&
        bundledIds.length
      ) {
        favoritePackIds = [...bundledIds];
      }
      if ((!defaultPackId || defaultPackId === BUILTIN_PACK_ID) && bundledIds.length) {
        defaultPackId = defaultBundledId;
      }
      return {
        telegramBotToken: String(parsed?.telegramBotToken || ''),
        defaultPackId,
        favoritePackIds,
        packs: Array.isArray(parsed?.packs) ? parsed.packs : [],
      };
    } catch {
      return {
        telegramBotToken: '',
        defaultPackId: defaultBundledId,
        favoritePackIds: [...bundledIds],
        packs: [],
      };
    }
  }

  writeState(state) {
    this.ensureDirs();
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  builtinPack() {
    return {
      id: BUILTIN_PACK_ID,
      name: 'Emoji (legacy)',
      source: 'builtin',
      telegramName: null,
      stickers: [],
      builtin: true,
    };
  }

  listPacks() {
    const state = this.readState();
    const bundled = this.loadBundledPacks();
    const packs = [...bundled, ...state.packs.filter((pack) => !pack.bundled)];
    return {
      telegramBotToken: state.telegramBotToken,
      hasTelegramToken: Boolean(state.telegramBotToken),
      defaultPackId: state.defaultPackId || bundled[0]?.id || BUILTIN_PACK_ID,
      favoritePackIds: state.favoritePackIds || [],
      packs,
    };
  }

  getPack(packId) {
    const id = String(packId || '');
    if (id === BUILTIN_PACK_ID) return this.builtinPack();
    const bundled = this.loadBundledPacks().find((pack) => pack.id === id);
    if (bundled) return bundled;
    return this.readState().packs.find((pack) => pack.id === id) || null;
  }

  setTelegramToken(token) {
    const state = this.readState();
    state.telegramBotToken = String(token || '').trim();
    this.writeState(state);
    return {
      ok: true,
      hasTelegramToken: Boolean(state.telegramBotToken),
    };
  }

  setDefaultPack(packId) {
    const state = this.readState();
    const id = String(packId || BUILTIN_PACK_ID);
    const bundled = this.loadBundledPacks();
    const allowed =
      id === BUILTIN_PACK_ID ||
      bundled.some((pack) => pack.id === id) ||
      state.packs.some((pack) => pack.id === id);
    if (!allowed) throw new Error('Pack not found');
    state.defaultPackId = id;
    this.writeState(state);
    return this.listPacks();
  }

  setFavoritePacks(packIds) {
    const state = this.readState();
    const bundled = this.loadBundledPacks();
    const allowed = new Set([
      BUILTIN_PACK_ID,
      ...bundled.map((pack) => pack.id),
      ...state.packs.map((pack) => pack.id),
    ]);
    state.favoritePackIds = (Array.isArray(packIds) ? packIds : [])
      .map((id) => String(id))
      .filter((id) => allowed.has(id));
    this.writeState(state);
    return this.listPacks();
  }

  resolveStickerFile(packIdOrName, fileName) {
    const safe = path.basename(String(fileName || ''));
    if (!safe || safe !== String(fileName || '')) return null;
    const key = String(packIdOrName || '');

    // Bundled packs live under assets/sticker-packs/<dirName>/
    const bundled = this.loadBundledPacks();
    const bundledPack =
      bundled.find((pack) => pack.id === key) ||
      bundled.find((pack) => pack.dirName === key) ||
      bundled.find((pack) => pack.telegramName === key) ||
      bundled.find((pack) => pack.id === `bundled-${key}`);
    if (bundledPack) {
      const full = path.join(this.bundledRoot, bundledPack.dirName, safe);
      if (fs.existsSync(full)) return full;
    }

    const state = this.readState();
    const pack =
      this.getPack(key) ||
      state.packs.find(
        (entry) =>
          entry.telegramName === key || entry.id === key || entry.id === `tg-${key}`,
      );
    if (!pack || pack.builtin || pack.bundled) return null;
    const full = path.join(
      this.packsDir,
      safePackDirName(pack.telegramName || pack.id),
      safe,
    );
    if (!fs.existsSync(full)) return null;
    return full;
  }

  async importTelegramPack(packUrl) {
    const state = this.readState();
    const token = state.telegramBotToken;
    if (!token) throw new Error('Add a Telegram bot token first');

    const packName = parseTelegramPackName(packUrl);
    if (!packName) {
      throw new Error('Paste a Telegram sticker pack link (t.me/addstickers/PackName)');
    }

    const meta = await requestJson(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getStickerSet?name=${encodeURIComponent(packName)}`,
    );
    if (!meta?.ok) {
      throw new Error(meta?.description || 'Could not load sticker pack from Telegram');
    }

    const set = meta.result || {};
    const stickers = Array.isArray(set.stickers) ? set.stickers : [];
    if (!stickers.length) throw new Error('That sticker pack is empty');

    const packDir = path.join(this.packsDir, safePackDirName(packName));
    fs.mkdirSync(packDir, { recursive: true });

    const imported = [];
    for (let i = 0; i < stickers.length; i += 1) {
      const sticker = stickers[i];
      const fileId = sticker?.file_id;
      if (!fileId) continue;
      const fileMeta = await requestJson(
        `https://api.telegram.org/bot${encodeURIComponent(token)}/getFile?file_id=${encodeURIComponent(fileId)}`,
      );
      if (!fileMeta?.ok || !fileMeta.result?.file_path) {
        continue;
      }
      const remotePath = String(fileMeta.result.file_path);
      const ext =
        path.extname(remotePath) || (sticker.is_animated || sticker.is_video ? '.tgs' : '.webp');
      const fileName = `${String(i).padStart(3, '0')}${ext}`;
      const dest = path.join(packDir, fileName);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${remotePath}`;
      await downloadFile(fileUrl, dest);
      imported.push({
        id: `${packName}-${i}`,
        fileName,
        emoji: sticker.emoji || '',
        url: `/api/stickers/file/${encodeURIComponent(packName)}/${encodeURIComponent(fileName)}`,
      });
    }

    if (!imported.length) {
      throw new Error('No stickers could be downloaded from that pack');
    }

    const packId = `tg-${packName}`;
    const nextPack = {
      id: packId,
      name: set.title || packName,
      source: 'telegram',
      telegramName: packName,
      stickers: imported,
      builtin: false,
      importedAt: Date.now(),
    };

    const existingIndex = state.packs.findIndex((pack) => pack.id === packId);
    if (existingIndex >= 0) state.packs[existingIndex] = nextPack;
    else state.packs.push(nextPack);

    if (!state.favoritePackIds.includes(packId)) {
      state.favoritePackIds.push(packId);
    }
    if (!state.defaultPackId || state.defaultPackId === BUILTIN_PACK_ID) {
      state.defaultPackId = packId;
    }

    this.writeState(state);
    return {
      ok: true,
      pack: nextPack,
      ...this.listPacks(),
    };
  }
}

module.exports = {
  StickerPackStore,
  BUILTIN_PACK_ID,
  parseTelegramPackName,
};
