const CALL_MEMBER_EVENT = 'org.matrix.msc3401.call.member';
const MEMBERSHIP_EXPIRY_MS = 60 * 60 * 1000;

function stripUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '')
    .replace(/^https?:\/\//i, '');
}

function withHttps(urlOrHost) {
  const raw = String(urlOrHost || '').trim().replace(/\/$/, '');
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getMxIdServer(id) {
  const value = String(id || '');
  const idx = value.lastIndexOf(':');
  if (idx === -1) return null;
  return value.slice(idx + 1) || null;
}

function getLiveKitFocus(wellKnown) {
  const foci = wellKnown?.['org.matrix.msc4143.rtc_foci'];
  if (!Array.isArray(foci)) return null;
  const focus = foci.find((entry) => entry && entry.type === 'livekit' && entry.livekit_service_url);
  return focus || null;
}

async function fetchWellKnown(baseUrl) {
  const root = withHttps(baseUrl);
  if (!root) throw new Error('Invalid homeserver URL');
  // Prefer client well-known on the server name host when possible
  const host = stripUrl(root);
  const candidates = [
    `https://${host}/.well-known/matrix/client`,
    `${root}/.well-known/matrix/client`,
  ];
  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        lastError = new Error(`well-known ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Failed to fetch well-known');
}

function resolveCallMemberUserId(event) {
  const sender = event.getSender?.();
  if (sender && String(sender).startsWith('@')) return sender;
  const key = String(event.getStateKey?.() || '');
  // State keys look like `@user:server_DEVICE` or `_@user:server_DEVICE`.
  const match = key.match(/@[^:]+:[^_]+/);
  return match ? match[0] : null;
}

function getActiveCallMembersFromRoom(room) {
  const members = [];
  const seen = new Set();
  const now = Date.now();
  if (!room?.currentState?.getStateEvents) return members;
  const events = room.currentState.getStateEvents(CALL_MEMBER_EVENT) || [];
  const list = Array.isArray(events) ? events : events ? [events] : [];

  const pushMember = (entry) => {
    if (!entry?.userId) return;
    const dedupe = `${entry.userId}|${entry.deviceId || ''}|${entry.callId || ''}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    members.push(entry);
  };

  for (const event of list) {
    const userId = resolveCallMemberUserId(event);
    const content = event.getContent?.() || {};
    if (!userId || !content || typeof content !== 'object') continue;
    const keys = Object.keys(content);
    if (keys.length === 0) continue;

    // MSC4143 / Element Call / Paarrot: per-device membership with focus_active.
    if ('focus_active' in content && typeof content.device_id === 'string') {
      const createdTs = Number(content.created_ts || event.getTs?.() || 0);
      const expiresMs = Number(content.expires || 4 * 60 * 60 * 1000);
      const expiresTs = createdTs + expiresMs;
      if (expiresTs > now) {
        pushMember({
          userId,
          deviceId: content.device_id || null,
          sessionId: content.created_ts ? String(content.created_ts) : null,
          expiresTs,
          callId: typeof content.call_id === 'string' ? content.call_id : null,
        });
      }
      continue;
    }

    // Legacy MSC3401: m.calls / m.devices with absolute expires_ts.
    const calls = content['m.calls'];
    if (Array.isArray(calls)) {
      for (const call of calls) {
        const devices = call?.['m.devices'];
        if (!Array.isArray(devices)) continue;
        for (const device of devices) {
          const expiresTs = Number(device?.expires_ts || 0);
          if (expiresTs > now) {
            pushMember({
              userId,
              deviceId: device.device_id || null,
              sessionId: device.session_id || null,
              expiresTs,
              callId: call['m.call_id'] || null,
            });
          }
        }
      }
      continue;
    }

    // Older "memberships" array shape (still seen on some servers).
    const memberships = content.memberships;
    if (Array.isArray(memberships)) {
      for (const membership of memberships) {
        if (!membership || typeof membership !== 'object') continue;
        const createdTs = Number(membership.created_ts || event.getTs?.() || 0);
        const expiresMs = Number(membership.expires || 4 * 60 * 60 * 1000);
        const expiresTs = createdTs + expiresMs;
        if (expiresTs <= now) continue;
        pushMember({
          userId,
          deviceId: membership.device_id || null,
          sessionId: membership.membershipID || null,
          expiresTs,
          callId: typeof membership.call_id === 'string' ? membership.call_id : null,
        });
      }
    }
  }
  return members;
}

function homeserverPriority({ room, userHomeserver, myUserId }) {
  const servers = [];
  const push = (value) => {
    const url = withHttps(value);
    if (!url) return;
    if (!servers.includes(url)) servers.push(url);
  };

  const members = room?.getMembers?.() || [];
  const memberCount = members.length || room?.getJoinedMemberCount?.() || 0;
  const isDm = memberCount > 0 && memberCount <= 2;
  const active = getActiveCallMembersFromRoom(room);
  const hasActiveCall = active.length > 0;
  const roomServer = getMxIdServer(room?.roomId);
  const userDomain = stripUrl(userHomeserver);

  if (hasActiveCall) {
    push(roomServer);
    push(userHomeserver);
    if (isDm) {
      const other = members.find((m) => m.userId && m.userId !== myUserId)?.userId;
      push(getMxIdServer(other));
    }
  } else if (isDm) {
    push(userHomeserver);
    const other = members.find((m) => m.userId && m.userId !== myUserId)?.userId;
    push(getMxIdServer(other));
  } else {
    push(roomServer);
    push(userHomeserver);
  }

  if (!servers.length) push(userHomeserver);
  return servers;
}

async function requestOpenIdToken(homeserverBaseUrl, userId, accessToken) {
  const root = withHttps(homeserverBaseUrl);
  const url = `${root}/_matrix/client/v3/user/${encodeURIComponent(userId)}/openid/request_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenID token failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchLiveKitJWT(livekitServiceUrl, roomId, userId, deviceId, openIdToken) {
  const memberId = `${deviceId}_${Date.now()}`;
  const res = await fetch(livekitServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      openid_token: openIdToken,
      room_id: roomId,
      slot_id: 'm.call',
      member: {
        id: memberId,
        claimed_user_id: userId,
        claimed_device_id: deviceId,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiveKit JWT failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchLiveKitJWTFromServers({
  homeservers,
  userHomeserver,
  roomId,
  userId,
  deviceId,
  accessToken,
}) {
  const errors = [];
  for (const homeserver of homeservers) {
    try {
      const wellKnown = await fetchWellKnown(homeserver);
      const focus = getLiveKitFocus(wellKnown);
      if (!focus) {
        errors.push(`${homeserver}: no livekit focus`);
        continue;
      }
      const openIdToken = await requestOpenIdToken(userHomeserver, userId, accessToken);
      const jwt = await fetchLiveKitJWT(
        focus.livekit_service_url,
        roomId,
        userId,
        deviceId,
        openIdToken,
      );
      return {
        jwt,
        homeserver,
        livekitServiceUrl: focus.livekit_service_url,
      };
    } catch (error) {
      errors.push(`${homeserver}: ${error?.message || error}`);
    }
  }
  return { jwt: null, errors };
}

function makeMembershipStateKey(userId, deviceId, roomVersion) {
  const stateKey = `${userId}_${deviceId}`;
  if (/^org\.matrix\.msc(3757|3779)\b/.test(String(roomVersion || ''))) {
    return stateKey;
  }
  return `_${stateKey}`;
}

function buildCallMemberContent({
  callId,
  deviceId,
  active,
  livekitServiceUrl = null,
  createdTs = null,
} = {}) {
  if (!active) return {};
  const fociPreferred = [];
  if (livekitServiceUrl) {
    fociPreferred.push({
      type: 'livekit',
      livekit_service_url: String(livekitServiceUrl),
    });
  }
  const content = {
    // Room-scoped MatrixRTC session (MSC4143) — same shape Paarrot/Element Call use.
    call_id: typeof callId === 'string' && callId.length ? callId : '',
    scope: 'm.room',
    application: 'm.call',
    device_id: deviceId,
    expires: MEMBERSHIP_EXPIRY_MS,
    focus_active: { type: 'livekit', focus_selection: 'oldest_membership' },
    foci_preferred: fociPreferred,
  };
  if (createdTs) content.created_ts = Number(createdTs);
  return content;
}

module.exports = {
  CALL_MEMBER_EVENT,
  MEMBERSHIP_EXPIRY_MS,
  getLiveKitFocus,
  fetchWellKnown,
  getActiveCallMembersFromRoom,
  homeserverPriority,
  fetchLiveKitJWTFromServers,
  buildCallMemberContent,
  makeMembershipStateKey,
  withHttps,
  stripUrl,
  getMxIdServer,
};
