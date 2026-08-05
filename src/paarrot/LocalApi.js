/**
 * Paarrot-compatible localhost control API (port 33384).
 * Lean: talks to MatrixSession + AppControl directly (no renderer IPC).
 */
const http = require('http');
const { LOCAL_API_HOST, LOCAL_API_PORT, RoomKind, RoomType } = require('./constants');

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function isSpaceLikeRoom(matrix, room) {
  if (!room) return false;
  if (typeof room.isSpaceRoom === 'function' && room.isSpaceRoom()) return true;
  if (matrix.getPaarrotRoomKind?.(room) === RoomKind.ForumSpace) return true;
  return matrix.getRoomCreateType?.(room) === RoomType.Forum;
}

class LocalApi {
  constructor({ matrix, appControl } = {}) {
    this.matrix = matrix;
    this.appControl = appControl;
    this.server = null;
    this.host = LOCAL_API_HOST;
    this.port = LOCAL_API_PORT;
    /** @type {{ at: number, data: any[] } | null} */
    this.channelsCache = null;
  }

  listChannels() {
    const now = Date.now();
    if (this.channelsCache && now - this.channelsCache.at < 1500) {
      return this.channelsCache.data;
    }
    const rooms = this.matrix.client?.getRooms?.() || [];
    const channels = [];
    for (const room of rooms) {
      if (isSpaceLikeRoom(this.matrix, room)) continue;
      const roomId = room.roomId;
      const colon = String(roomId || '').lastIndexOf(':');
      channels.push({
        roomId,
        name: room.name || 'Unnamed Room',
        server: colon >= 0 ? roomId.slice(colon + 1) : null,
        isDirect:
          room.getMyMembership?.() === 'invite' ? false : room.guessDMUserId?.() != null,
        avatar: room.getMxcAvatarUrl?.() || null,
      });
    }
    channels.sort((a, b) => a.name.localeCompare(b.name));
    this.channelsCache = { at: now, data: channels };
    return channels;
  }

  async handle(req, res) {
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }

    // Avoid URL() alloc on every request — path only.
    const raw = req.url || '/';
    const q = raw.indexOf('?');
    const path = q >= 0 ? raw.slice(0, q) : raw;

    try {
      if (req.method === 'GET' && path === '/health') {
        send(res, 200, {
          status: 'ok',
          success: true,
          app: 'Kitsu',
          compatible: 'paarrot',
          version: '1.0.0',
        });
        return;
      }

      if (req.method === 'GET' && path === '/status') {
        send(res, 200, { success: true, data: this.appControl.getStatus(this.matrix) });
        return;
      }

      if (req.method === 'POST' && path === '/mute') {
        const body = await readJson(req);
        send(res, 200, { success: true, data: this.appControl.setMute(Boolean(body.muted)) });
        return;
      }

      if (req.method === 'POST' && path === '/mute/toggle') {
        send(res, 200, { success: true, data: this.appControl.toggleMute() });
        return;
      }

      if (req.method === 'POST' && path === '/deafen') {
        const body = await readJson(req);
        send(res, 200, { success: true, data: this.appControl.setDeafen(Boolean(body.deafened)) });
        return;
      }

      if (req.method === 'POST' && path === '/deafen/toggle') {
        send(res, 200, { success: true, data: this.appControl.toggleDeafen() });
        return;
      }

      if (req.method === 'POST' && path === '/channel') {
        const body = await readJson(req);
        const roomId = String(body.roomId || '').trim();
        if (!roomId) {
          send(res, 400, { success: false, error: 'roomId is required' });
          return;
        }
        const room = this.matrix.client?.getRoom?.(roomId);
        const result = this.appControl.changeChannel(roomId);
        send(res, 200, {
          success: true,
          data: {
            ...result,
            roomName: room?.name || 'Unnamed Room',
          },
        });
        return;
      }

      if (req.method === 'GET' && path === '/channels') {
        send(res, 200, { success: true, data: this.listChannels() });
        return;
      }

      if (req.method === 'POST' && path === '/message') {
        const body = await readJson(req);
        const roomId = String(body.roomId || '').trim();
        const message = String(body.message || '');
        if (!roomId || !message.trim()) {
          send(res, 400, { success: false, error: 'roomId and message are required' });
          return;
        }
        const result = await this.matrix.sendText(roomId, message.trim());
        send(res, 200, {
          success: true,
          data: { eventId: result?.eventId || result?.event_id || null, roomId },
        });
        return;
      }

      if (req.method === 'POST' && path === '/message/current') {
        const body = await readJson(req);
        const message = String(body.message || '');
        const roomId = this.appControl.currentRoomId;
        if (!roomId) {
          send(res, 400, { success: false, error: 'No room currently active' });
          return;
        }
        if (!message.trim()) {
          send(res, 400, { success: false, error: 'message is required' });
          return;
        }
        const result = await this.matrix.sendText(roomId, message.trim());
        send(res, 200, {
          success: true,
          data: { eventId: result?.eventId || result?.event_id || null, roomId },
        });
        return;
      }

      if (req.method === 'GET' && path === '/room/current') {
        const roomId = this.appControl.currentRoomId;
        if (!roomId) {
          send(res, 400, { success: false, error: 'No room currently active' });
          return;
        }
        const room = this.matrix.client?.getRoom?.(roomId);
        if (!room) {
          send(res, 404, { success: false, error: `Current room not found: ${roomId}` });
          return;
        }
        const serverMatch = String(room.roomId || '').match(/:(.+)$/);
        send(res, 200, {
          success: true,
          data: {
            roomId: room.roomId,
            name: room.name || 'Unnamed Room',
            server: serverMatch ? serverMatch[1] : null,
            avatar: room.getMxcAvatarUrl?.() || null,
            isDirect: room.guessDMUserId?.() != null,
          },
        });
        return;
      }

      send(res, 404, {
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
          'GET /health',
          'GET /status',
          'POST /mute',
          'POST /mute/toggle',
          'POST /deafen',
          'POST /deafen/toggle',
          'POST /channel',
          'GET /channels',
          'POST /message',
          'POST /message/current',
          'GET /room/current',
        ],
      });
    } catch (error) {
      send(res, 500, { success: false, error: error?.message || String(error) });
    }
  }

  start({ host = this.host, port = this.port } = {}) {
    if (this.server) return Promise.resolve({ host: this.host, port: this.port });
    this.host = host;
    this.port = port;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        void this.handle(req, res);
      });
      this.server.once('error', (error) => {
        this.server = null;
        reject(error);
      });
      this.server.listen(port, host, () => {
        console.log(`[relay] Paarrot local API on http://${host}:${port}`);
        resolve({ host, port });
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      const server = this.server;
      this.server = null;
      server.close(() => resolve());
    });
  }
}

module.exports = { LocalApi };
