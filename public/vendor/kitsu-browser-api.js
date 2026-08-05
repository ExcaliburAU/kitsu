/**
 * Kitsu standalone browser backend.
 * Patches fetch + EventSource so the existing desktop UI talks to matrix-js-sdk
 * in-process (Capacitor / phone) instead of the Node Express API.
 */
(() => {
  const SESSION_KEY = 'kitsu.browser.session';
  const ENABLED =
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    localStorage.getItem('kitsu.standalone') === '1' ||
    /(?:\?|&)standalone=1(?:&|$)/.test(location.search) ||
    location.protocol === 'capacitor:' ||
    location.protocol === 'https:' && /kitsu/i.test(location.hostname);

  if (!ENABLED) {
    window.KitsuStandalone = { enabled: false };
    return;
  }

  /** @type {import('matrix-js-sdk').MatrixClient | null} */
  let client = null;
  let ready = false;
  let restoring = false;
  let lastError = null;
  /** @type {Set<(payload: object) => void>} */
  const liveListeners = new Set();

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function errorResponse(message, status = 400) {
    return jsonResponse({ error: String(message || 'Error') }, status);
  }

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveStoredSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function sdk() {
    const s = window.MatrixBrowserSdk;
    if (!s) {
      const detail = window.__kitsuMatrixBootError?.message || 'matrix-js-sdk not loaded';
      throw new Error(detail);
    }
    return s;
  }

  function mxcToHttp(mxc, width = 96) {
    if (!client || !mxc || typeof mxc !== 'string' || !mxc.startsWith('mxc://')) return null;
    try {
      return client.mxcUrlToHttp(mxc, width, width, 'crop') || client.mxcUrlToHttp(mxc);
    } catch {
      return null;
    }
  }

  function displayNameFor(userId, room = null) {
    if (!userId) return 'unknown';
    try {
      const member = room?.getMember?.(userId);
      const name = member?.name || member?.rawDisplayName;
      if (name && name !== userId) return name;
    } catch {
      /* ignore */
    }
    try {
      const user = client?.getUser?.(userId);
      if (user?.displayName) return user.displayName;
    } catch {
      /* ignore */
    }
    if (userId.startsWith('@') && userId.includes(':')) {
      return userId.slice(1).split(':')[0] || userId;
    }
    return userId;
  }

  function isSpaceRoom(room) {
    try {
      const type = room.getType?.() || room.currentState?.getStateEvents?.('m.room.create', '')?.getContent?.()?.type;
      return type === 'm.space';
    } catch {
      return false;
    }
  }

  function isJoined(room) {
    try {
      return room.getMyMembership?.() === 'join';
    } catch {
      return false;
    }
  }

  function getDirectIds() {
    const set = new Set();
    try {
      const map = client?.getAccountData?.('m.direct')?.getContent?.() || {};
      for (const rooms of Object.values(map)) {
        for (const id of rooms || []) set.add(id);
      }
    } catch {
      /* ignore */
    }
    return set;
  }

  function publicState() {
    if (!client) {
      return {
        connected: false,
        ready: false,
        restoring: false,
        userId: null,
        displayName: null,
        homeserver: null,
        deviceId: null,
        avatarUrl: null,
        error: lastError,
      };
    }
    const userId = client.getUserId();
    const profile = client.getUser?.(userId);
    const avatarMxc = profile?.avatarUrl || null;
    return {
      connected: true,
      ready,
      restoring,
      userId,
      displayName: profile?.displayName || displayNameFor(userId),
      homeserver: client.getHomeserverUrl?.() || client.baseUrl || null,
      deviceId: client.getDeviceId?.() || null,
      avatarUrl: mxcToHttp(avatarMxc, 96),
      hasAvatar: Boolean(avatarMxc),
      error: lastError,
    };
  }

  function serializeRoom(room, { isDirect = false } = {}) {
    const myUserId = client.getUserId();
    let dmUserId = null;
    if (isDirect) {
      const members = room.getJoinedMembers?.() || [];
      const other = members.find((m) => m.userId !== myUserId);
      dmUserId = other?.userId || null;
    }
    const avatarMxc = room.getMxcAvatarUrl?.() || null;
    const last = room.getLastLiveEvent?.() || room.getLiveTimeline?.()?.getEvents?.()?.slice(-1)?.[0];
    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      topic: room.currentState?.getStateEvents?.('m.room.topic', '')?.getContent?.()?.topic || '',
      unread: room.getUnreadNotificationCount?.() || 0,
      lastEventTs: last?.getTs?.() || room.getLastActiveTimestamp?.() || 0,
      encrypted: Boolean(room.hasEncryptionStateEvent?.()),
      isSpace: false,
      isDirect,
      dmUserId,
      presence: null,
      online: false,
      alias: room.getCanonicalAlias?.() || null,
      permalink: `https://matrix.to/#/${room.roomId}`,
      avatarUrl: mxcToHttp(avatarMxc, 96),
      avatarUrlLg: mxcToHttp(avatarMxc, 256),
      hasAvatar: Boolean(avatarMxc),
      memberCount: room.getJoinedMemberCount?.() || 0,
      pinnedCount: 0,
      voiceMembers: [],
      creatorUserId: null,
      creatorName: null,
      createdTs: null,
      joinRule: room.getJoinRule?.() || 'invite',
    };
  }

  function listRooms(filter = 'home') {
    if (!client) return [];
    const directIds = getDirectIds();
    return (client.getRooms?.() || [])
      .filter((room) => {
        if (!isJoined(room) || isSpaceRoom(room)) return false;
        if (filter === 'dms') return directIds.has(room.roomId);
        if (filter && filter.startsWith('!')) return false; // spaces later
        return true;
      })
      .map((room) => serializeRoom(room, { isDirect: directIds.has(room.roomId) }))
      .sort((a, b) => b.lastEventTs - a.lastEventTs);
  }

  function serializeEvent(room, event) {
    const type = event.getType?.() || event.getWireType?.() || '';
    const sender = event.getSender?.() || '';
    const content = event.getContent?.() || {};
    const myUserId = client.getUserId();
    const isMine = sender === myUserId;
    const redacted = Boolean(event.isRedacted?.());
    let body = content.body || null;
    let msgtype = content.msgtype || null;
    let encrypted = type === 'm.room.encrypted';
    if (encrypted && !body) body = '[Unable to decrypt]';

    const clear = event.isDecryptionFailure?.() ? null : event;
    const clearContent = clear?.getContent?.() || content;
    if (clear && type === 'm.room.encrypted') {
      encrypted = false;
      body = clearContent.body || body;
      msgtype = clearContent.msgtype || msgtype;
    }

    const imageMxc = msgtype === 'm.image' ? clearContent.url : null;
    const videoMxc = msgtype === 'm.video' ? clearContent.url : null;

    return {
      eventId: event.getId?.(),
      type: clear?.getType?.() || type,
      sender,
      senderName: displayNameFor(sender, room),
      senderAvatarUrl: mxcToHttp(room.getMember?.(sender)?.getMxcAvatarUrl?.() || client.getUser?.(sender)?.avatarUrl, 96),
      hasSenderAvatar: true,
      senderStyle: null,
      isMine,
      canRedact: isMine,
      ts: event.getTs?.() || 0,
      body: redacted ? null : body,
      html: redacted ? null : clearContent.formatted_body || null,
      msgtype: redacted ? null : msgtype,
      imageUrl: imageMxc ? mxcToHttp(imageMxc, 512) : null,
      imageFullUrl: imageMxc ? mxcToHttp(imageMxc) : null,
      imageMxc,
      imageFilename: clearContent.body || null,
      imageInfo: clearContent.info || null,
      videoUrl: videoMxc ? mxcToHttp(videoMxc) : null,
      videoFullUrl: videoMxc ? mxcToHttp(videoMxc) : null,
      videoMxc,
      videoFilename: clearContent.body || null,
      videoInfo: clearContent.info || null,
      encrypted,
      redacted,
      readBy: [],
      reactions: [],
      canEdit: isMine && msgtype === 'm.text',
      canPin: false,
      isPinned: false,
    };
  }

  function getTimeline(roomId) {
    const room = client?.getRoom?.(roomId);
    if (!room) return { roomId, messages: [], atStart: true, history: null };
    const events = room.getLiveTimeline?.()?.getEvents?.() || [];
    const messages = [];
    for (const event of events) {
      const type = event.getType?.() || '';
      if (type === 'm.room.redaction') continue;
      if (event.isRelation?.('m.replace')) continue;
      if (
        type === 'm.room.message' ||
        type === 'm.room.encrypted' ||
        type === 'm.room.member' ||
        type === 'm.room.name' ||
        type === 'm.room.topic' ||
        type === 'm.room.avatar'
      ) {
        if (type.startsWith('m.room.') && type !== 'm.room.message' && type !== 'm.room.encrypted') {
          // lightweight system rows
          messages.push({
            ...serializeEvent(room, event),
            systemKind: type === 'm.room.member' ? 'membership' : 'room',
            systemAction: type === 'm.room.member' ? event.getContent?.()?.membership || 'join' : 'room_name',
            body: event.getContent?.()?.body || event.getContent?.()?.membership || type,
          });
        } else {
          messages.push(serializeEvent(room, event));
        }
      }
    }
    return {
      roomId,
      messages,
      atStart: true,
      history: null,
    };
  }

  function emitLive(payload) {
    for (const fn of liveListeners) {
      try {
        fn(payload);
      } catch {
        /* ignore */
      }
    }
  }

  function wireClient(c) {
    c.on?.('sync', (state) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        ready = true;
        restoring = false;
        emitLive({ kind: 'sync', state, live: true });
      }
    });
    c.on?.('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline || !ready || !room) return;
      const type = event.getType?.() || '';
      if (
        type === 'm.room.message' ||
        type === 'm.room.encrypted' ||
        type === 'm.room.redaction' ||
        type === 'm.reaction'
      ) {
        emitLive({
          kind: 'timeline',
          roomId: room.roomId,
          eventId: event.getId?.(),
          type,
          sender: event.getSender?.(),
          live: true,
        });
      }
    });
    c.on?.('Event.decrypted', (event) => {
      const roomId = event.getRoomId?.();
      if (!roomId || !ready) return;
      emitLive({
        kind: 'timeline',
        roomId,
        eventId: event.getId?.(),
        type: event.getType?.(),
        sender: event.getSender?.(),
        live: true,
        decrypted: true,
      });
    });
  }

  async function resolveHomeserver(homeserver) {
    const Matrix = sdk();
    const input = String(homeserver || '').trim();
    if (!input) throw new Error('Homeserver is required');
    try {
      if (Matrix.AutoDiscovery?.findClientConfig) {
        const conf = await Matrix.AutoDiscovery.findClientConfig(input.replace(/^https?:\/\//, '').split('/')[0]);
        const url = conf?.['m.homeserver']?.base_url;
        if (url) return url.replace(/\/$/, '');
      }
    } catch {
      /* fall through */
    }
    if (/^https?:\/\//i.test(input)) return input.replace(/\/$/, '');
    return `https://${input.replace(/\/$/, '')}`;
  }

  async function startFromSession(session) {
    const Matrix = sdk();
    restoring = true;
    ready = false;
    lastError = null;
    const c = Matrix.createClient({
      baseUrl: session.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
    });
    wireClient(c);
    client = c;
    try {
      await Matrix.ensureCryptoWasm?.();
      await c.initRustCrypto({
        useIndexedDB: true,
        cryptoDatabasePrefix: `kitsu-crypto-${session.userId}-${session.deviceId}`,
      });
    } catch (error) {
      console.warn('[kitsu-standalone] crypto init', error);
      lastError = error?.message || String(error);
    }
    c.startClient({ initialSyncLimit: 30 });
    // ready flips on sync event
    window.setTimeout(() => {
      if (!ready) {
        ready = true;
        restoring = false;
      }
    }, 8000);
  }

  async function login({ homeserver, user, password, deviceName }) {
    await logout({ clearStorage: false });
    const Matrix = sdk();
    const baseUrl = await resolveHomeserver(homeserver);
    const bootstrap = Matrix.createClient({ baseUrl });
    const response = await bootstrap.login('m.login.password', {
      user: String(user || '').trim(),
      password: String(password || ''),
      initial_device_display_name: deviceName || 'Kitsu Android',
    });
    const session = {
      baseUrl,
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id,
    };
    saveStoredSession(session);
    await startFromSession(session);
    return publicState();
  }

  async function logout({ clearStorage = true } = {}) {
    try {
      await client?.logout?.(true);
    } catch {
      /* ignore */
    }
    try {
      client?.stopClient?.();
    } catch {
      /* ignore */
    }
    client = null;
    ready = false;
    restoring = false;
    if (clearStorage) saveStoredSession(null);
    emitLive({ kind: 'session', connected: false, live: true });
  }

  async function boot() {
    const session = loadStoredSession();
    if (!session?.accessToken) return;
    try {
      await startFromSession(session);
    } catch (error) {
      console.warn('[kitsu-standalone] restore failed', error);
      lastError = error?.message || String(error);
      restoring = false;
    }
  }

  async function handleApi(method, pathname, url, body) {
    const path = pathname.replace(/\/$/, '') || '/';

    if (path === '/api/health' && method === 'GET') {
      return jsonResponse({
        ok: true,
        name: 'kitsu',
        version: '0.3.5-android',
        standalone: true,
        mode: 'browser-matrix',
      });
    }

    if (path === '/api/session' && method === 'GET') return jsonResponse(publicState());
    if (path === '/api/login' && method === 'POST') {
      try {
        return jsonResponse(await login(body || {}));
      } catch (error) {
        return errorResponse(error?.message || error, 400);
      }
    }
    if (path === '/api/logout' && method === 'POST') {
      await logout({ clearStorage: true });
      return jsonResponse({ ok: true });
    }

    if (path === '/api/rooms' && method === 'GET') {
      const filter = url.searchParams.get('space') || url.searchParams.get('filter') || 'home';
      return jsonResponse({ rooms: listRooms(filter), filter, ready, groups: [] });
    }

    const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && method === 'GET') {
      const roomId = decodeURIComponent(roomMatch[1]);
      const room = client?.getRoom?.(roomId);
      if (!room) return errorResponse('Room not found', 404);
      return jsonResponse(serializeRoom(room, { isDirect: getDirectIds().has(roomId) }));
    }

    const messagesMatch = path.match(/^\/api\/rooms\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      return jsonResponse(getTimeline(decodeURIComponent(messagesMatch[1])));
    }

    const sendMatch = path.match(/^\/api\/rooms\/([^/]+)\/send$/);
    if (sendMatch && method === 'POST') {
      const roomId = decodeURIComponent(sendMatch[1]);
      const text = String(body?.body || '');
      if (!client) return errorResponse('Not logged in', 401);
      if (!text.trim()) return errorResponse('Empty message');
      try {
        const result = await client.sendTextMessage(roomId, text);
        return jsonResponse({ eventId: result?.event_id || null });
      } catch (error) {
        return errorResponse(error?.message || error);
      }
    }

    const readMatch = path.match(/^\/api\/rooms\/([^/]+)\/read$/);
    if (readMatch && method === 'POST') {
      const roomId = decodeURIComponent(readMatch[1]);
      try {
        const room = client?.getRoom?.(roomId);
        const events = room?.getLiveTimeline?.()?.getEvents?.() || [];
        const last = events[events.length - 1];
        if (last) await client.sendReadReceipt(last);
      } catch {
        /* ignore */
      }
      return jsonResponse({ ok: true });
    }

    const typingMatch = path.match(/^\/api\/rooms\/([^/]+)\/typing$/);
    if (typingMatch && method === 'POST') {
      try {
        await client?.sendTyping?.(decodeURIComponent(typingMatch[1]), Boolean(body?.typing), 10000);
      } catch {
        /* ignore */
      }
      return jsonResponse({ ok: true });
    }
    if (typingMatch && method === 'GET') {
      return jsonResponse({ typing: [] });
    }

    // Soft stubs so the desktop UI doesn't hard-crash on phone.
    if (path.startsWith('/api/')) {
      if (method === 'GET') {
        if (path === '/api/spaces') return jsonResponse({ spaces: [] });
        if (path === '/api/invites') return jsonResponse({ invites: [] });
        if (path === '/api/activity') return jsonResponse({ items: [], cursor: 0 });
        if (path === '/api/stickers') return jsonResponse({ packs: [], favorites: [] });
        if (path === '/api/plugins') return jsonResponse({ plugins: [] });
        if (path === '/api/themes') return jsonResponse({ themes: [] });
        if (path === '/api/account') return jsonResponse({ ...publicState() });
        if (path === '/api/devices') return jsonResponse({ devices: [] });
        if (path === '/api/sidebar') return jsonResponse({ folders: [] });
        if (path.endsWith('/members')) return jsonResponse({ members: [] });
        if (path.endsWith('/pins')) return jsonResponse({ pins: [] });
        if (path.endsWith('/threads')) return jsonResponse({ threads: [] });
        if (path.endsWith('/media')) return jsonResponse({ media: [] });
        if (path.includes('/embed-filters')) return jsonResponse({ personal: [], room: [] });
        if (path === '/api/voip/config') return jsonResponse({});
        if (path === '/api/voip/ice') return jsonResponse({ iceServers: [] });
        if (path === '/api/control/status') return jsonResponse({});
        if (path === '/api/notifications/rules') return jsonResponse({ rules: [] });
        if (path === '/api/account/fav-emojis') return jsonResponse({ emojis: [] });
        if (path === '/api/paarrot-colors') return jsonResponse({ colors: {} });
        return jsonResponse({});
      }
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        return jsonResponse({ ok: true });
      }
    }

    return null;
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) {
      return origFetch(input, init);
    }
    // Wait briefly for SDK if still loading
    for (let i = 0; i < 50 && !window.MatrixBrowserSdk; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    let body = null;
    if (init.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
    }
    try {
      const handled = await handleApi((init.method || 'GET').toUpperCase(), url.pathname, url, body);
      if (handled) return handled;
    } catch (error) {
      return errorResponse(error?.message || error, 500);
    }
    return origFetch(input, init);
  };

  // SSE live feed from in-process sync
  const OrigES = window.EventSource;
  window.EventSource = function PatchedEventSource(url, config) {
    const href = String(url || '');
    if (!href.includes('/api/live')) {
      return new OrigES(url, config);
    }
    const target = new EventTarget();
    let closed = false;
    const listener = (payload) => {
      if (closed) return;
      const ev = new MessageEvent('live', { data: JSON.stringify(payload) });
      target.dispatchEvent(ev);
      if (typeof target.onmessage === 'function') target.onmessage(ev);
    };
    liveListeners.add(listener);
    queueMicrotask(() => {
      target.dispatchEvent(new MessageEvent('ready', { data: JSON.stringify({ ok: true }) }));
    });
    return {
      url: href,
      readyState: 1,
      withCredentials: false,
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
      onopen: null,
      onmessage: null,
      onerror: null,
      addEventListener: (type, fn) => target.addEventListener(type, fn),
      removeEventListener: (type, fn) => target.removeEventListener(type, fn),
      close() {
        closed = true;
        liveListeners.delete(listener);
      },
      dispatchEvent: (e) => target.dispatchEvent(e),
    };
  };
  window.EventSource.CONNECTING = 0;
  window.EventSource.OPEN = 1;
  window.EventSource.CLOSED = 2;

  window.KitsuStandalone = {
    enabled: true,
    publicState,
    boot,
    login,
    logout,
  };

  // Boot after SDK script loads
  const start = () => {
    void boot();
  };
  if (window.MatrixBrowserSdk) start();
  else {
    const timer = setInterval(() => {
      if (window.MatrixBrowserSdk) {
        clearInterval(timer);
        start();
      }
    }, 50);
    setTimeout(() => clearInterval(timer), 30000);
  }

  console.info('[kitsu] standalone browser backend armed');
})();
