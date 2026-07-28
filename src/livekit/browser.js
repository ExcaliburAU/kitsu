import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
} from 'livekit-client';

function randomId(prefix = '') {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

class RelayLiveKitManager {
  constructor() {
    this.state = 'idle';
    this.roomId = null;
    this.callId = null;
    this.direction = 'outbound';
    this.withVideo = false;
    this.isMuted = false;
    this.isDeafened = false;
    this.isVideoEnabled = false;
    this.isScreenSharing = false;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.remoteScreenStream = null;
    this.listeners = new Set();
    this.livekitRoom = null;
    this.myUserId = null;
    this.wasMutedBeforeDeafen = false;
    this.audioElements = new Map();
    this.membershipTimer = null;
    this.backend = 'livekit';
    this.livekitServiceUrl = null;
    /** @type {Set<string>} */
    this.speakingIds = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, detail = {}) {
    const payload = {
      type,
      ...detail,
      state: this.state,
      roomId: this.roomId,
      callId: this.callId,
      backend: 'livekit',
    };
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch {
        // ignore
      }
    }
  }

  async api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
    return data;
  }

  async start(sessionUserId) {
    this.myUserId = sessionUserId || null;
  }

  stop() {
    void this.hangup('user_hangup', false);
  }

  getSnapshot() {
    return {
      state: this.state,
      roomId: this.roomId,
      callId: this.callId,
      direction: this.direction,
      withVideo: this.withVideo || this.isVideoEnabled || this.isScreenSharing,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      isVideoEnabled: this.isVideoEnabled,
      isScreenSharing: this.isScreenSharing || Boolean(this.remoteScreenStream),
      pendingInvite: null,
      backend: 'livekit',
      participants: this.getParticipants(),
      hasRemoteVideo: Boolean(this.remoteStream?.getVideoTracks?.().length),
    };
  }

  getParticipants() {
    if (this.state === 'idle' || !this.livekitRoom) return [];
    const out = [];
    if (this.myUserId) {
      out.push({
        userId: this.myUserId,
        self: true,
        speaking: this.speakingIds.has(this.myUserId),
      });
    }
    for (const participant of this.livekitRoom.remoteParticipants.values()) {
      out.push({
        userId: participant.identity,
        self: false,
        speaking: this.speakingIds.has(participant.identity),
      });
    }
    return out;
  }

  getSpeakingIds() {
    return [...this.speakingIds];
  }

  setSpeakingFromActive(speakers) {
    const next = new Set();
    for (const speaker of speakers || []) {
      const id = speaker?.identity;
      if (!id) continue;
      if (this.isMuted && id === this.myUserId) continue;
      next.add(id);
    }
    let changed = next.size !== this.speakingIds.size;
    if (!changed) {
      for (const id of next) {
        if (!this.speakingIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    this.speakingIds = next;
    this.emit('speaking', { speakers: [...this.speakingIds] });
  }

  async isSupported(roomId) {
    if (!roomId) return false;
    try {
      const status = await this.api(
        `/api/voip/livekit/status?roomId=${encodeURIComponent(roomId)}`,
      );
      return Boolean(status.supported);
    } catch {
      return false;
    }
  }

  collectLocalStream() {
    if (!this.livekitRoom?.localParticipant) return null;
    const tracks = [];
    for (const pub of this.livekitRoom.localParticipant.trackPublications.values()) {
      if (pub.track?.mediaStreamTrack && pub.source !== Track.Source.ScreenShare) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    }
    this.localStream = tracks.length ? new MediaStream(tracks) : null;
    return this.localStream;
  }

  ensureRemoteStream() {
    if (!this.remoteStream) this.remoteStream = new MediaStream();
    return this.remoteStream;
  }

  attachRemoteAudio(participant, track, publication) {
    const key = `${participant.identity}:${publication.trackSid || publication.source}`;
    const existing = this.audioElements.get(key);
    if (existing) {
      existing.remove();
      this.audioElements.delete(key);
    }
    const el = track.attach();
    el.id = `lk-audio-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    el.autoplay = true;
    el.playsInline = true;
    if (this.isDeafened) el.muted = true;
    document.body.appendChild(el);
    this.audioElements.set(key, el);
  }

  clearAudioElements() {
    for (const el of this.audioElements.values()) el.remove();
    this.audioElements.clear();
  }

  setupHandlers() {
    const room = this.livekitRoom;
    if (!room) return;

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Connected) {
        this.state = 'connected';
        this.emit('state');
      } else if (state === ConnectionState.Reconnecting) {
        this.state = 'connecting';
        this.emit('state');
      } else if (state === ConnectionState.Disconnected && this.state !== 'idle') {
        void this.cleanupLocal();
        this.emit('ended', { reason: 'disconnected' });
        this.emit('state');
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (!track) return;
      const isScreen =
        publication.source === Track.Source.ScreenShare ||
        publication.source === Track.Source.ScreenShareAudio;

      if (track.kind === 'audio') {
        this.attachRemoteAudio(participant, track, publication);
        if (!isScreen) {
          const remote = this.ensureRemoteStream();
          remote.addTrack(track.mediaStreamTrack);
          this.emit('remote-stream', { stream: remote });
        }
        return;
      }

      if (track.kind === 'video') {
        if (isScreen) {
          this.remoteScreenStream = new MediaStream([track.mediaStreamTrack]);
          this.emit('local-screen', { stream: this.remoteScreenStream, remote: true });
          this.emit('state');
          return;
        }
        const remote = this.ensureRemoteStream();
        for (const existing of remote.getVideoTracks()) remote.removeTrack(existing);
        remote.addTrack(track.mediaStreamTrack);
        this.emit('remote-stream', { stream: remote });
        this.emit('state');
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (!track) return;
      const key = `${participant.identity}:${publication.trackSid || publication.source}`;
      const el = this.audioElements.get(key);
      if (el) {
        el.remove();
        this.audioElements.delete(key);
      }
      if (publication.source === Track.Source.ScreenShare) {
        this.remoteScreenStream = null;
        this.emit('local-screen', { stream: null, remote: true });
      }
      this.emit('state');
    });

    room.on(RoomEvent.LocalTrackPublished, () => {
      const stream = this.collectLocalStream();
      this.emit('local-stream', { stream });
    });

    room.on(RoomEvent.ParticipantConnected, () => this.emit('state'));
    room.on(RoomEvent.ParticipantDisconnected, () => this.emit('state'));

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      this.setSpeakingFromActive(speakers);
    });
  }

  async placeCall(roomId, { video = false } = {}) {
    if (this.state !== 'idle') throw new Error('Already in a call');
    if (!roomId) throw new Error('Room required');

    this.roomId = roomId;
    this.withVideo = Boolean(video);
    this.isVideoEnabled = Boolean(video);
    this.state = 'connecting';
    this.direction = 'outbound';
    this.emit('state');

    try {
      const creds = await this.api('/api/voip/livekit/join', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      this.livekitServiceUrl = creds.livekitServiceUrl || null;

      this.livekitRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: window.RelayMediaPrefs?.livekitAudioCaptureOptions?.() || undefined,
        audioOutput: (() => {
          const id = window.RelayMediaPrefs?.get?.()?.audioOutput;
          return id ? { deviceId: id } : undefined;
        })(),
      });
      this.setupHandlers();
      await this.livekitRoom.connect(creds.url, creds.jwt);

      await this.livekitRoom.localParticipant.setMicrophoneEnabled(
        true,
        window.RelayMediaPrefs?.livekitAudioCaptureOptions?.() || undefined,
      );
      if (video) {
        await this.livekitRoom.localParticipant.setCameraEnabled(true);
      }

      const membership = await this.api('/api/voip/livekit/membership', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          active: true,
          livekitServiceUrl: this.livekitServiceUrl,
        }),
      });
      this.callId = membership.callId || '';
      this.startMembershipRefresh();

      this.state = 'connected';
      const local = this.collectLocalStream();
      this.emit('local-stream', { stream: local });
      this.emit('state');
    } catch (error) {
      await this.cleanupLocal();
      this.emit('error', { error: error?.message || String(error) });
      this.emit('state');
      throw error;
    }
  }

  startMembershipRefresh() {
    this.stopMembershipRefresh();
    this.membershipTimer = setInterval(() => {
      if (!this.roomId || this.state === 'idle') return;
      void this.api('/api/voip/livekit/membership', {
        method: 'POST',
        body: JSON.stringify({
          roomId: this.roomId,
          active: true,
          callId: this.callId,
          livekitServiceUrl: this.livekitServiceUrl,
        }),
      }).catch(() => {});
    }, 45 * 60 * 1000);
  }

  stopMembershipRefresh() {
    if (this.membershipTimer) {
      clearInterval(this.membershipTimer);
      this.membershipTimer = null;
    }
  }

  async hangup(_reason = 'user_hangup', _notifyRemote = true) {
    const roomId = this.roomId;
    const wasActive = this.state !== 'idle';
    this.stopMembershipRefresh();
    if (wasActive && roomId) {
      try {
        await this.api('/api/voip/livekit/membership', {
          method: 'POST',
          body: JSON.stringify({ roomId, active: false, callId: this.callId }),
        });
      } catch {
        // ignore
      }
    }
    await this.cleanupLocal();
    if (wasActive) this.emit('ended', { reason: _reason });
    this.emit('state');
  }

  async cleanupLocal() {
    this.stopMembershipRefresh();
    this.clearAudioElements();
    if (this.livekitRoom) {
      try {
        this.livekitRoom.disconnect();
      } catch {
        // ignore
      }
      this.livekitRoom = null;
    }
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) track.stop();
      this.screenStream = null;
    }
    this.localStream = null;
    this.remoteStream = null;
    this.remoteScreenStream = null;
    this.roomId = null;
    this.callId = null;
    this.livekitServiceUrl = null;
    this.withVideo = false;
    this.isMuted = false;
    this.isDeafened = false;
    this.isVideoEnabled = false;
    this.isScreenSharing = false;
    this.wasMutedBeforeDeafen = false;
    this.speakingIds = new Set();
    this.state = 'idle';
    this.emit('speaking', { speakers: [] });
  }

  toggleMute() {
    if (!this.livekitRoom?.localParticipant) return this.isMuted;
    if (!this.isMuted && this.isDeafened) {
      this.isDeafened = false;
      this.applyDeafenToRemote(false);
      this.emit('deafen', { deafened: false });
    }
    this.isMuted = !this.isMuted;
    void this.livekitRoom.localParticipant.setMicrophoneEnabled(!this.isMuted);
    if (this.isMuted && this.myUserId) {
      this.speakingIds.delete(this.myUserId);
      this.emit('speaking', { speakers: [...this.speakingIds] });
    }
    this.emit('state');
    return this.isMuted;
  }

  applyDeafenToRemote(deafened) {
    for (const el of this.audioElements.values()) el.muted = Boolean(deafened);
    if (this.livekitRoom) {
      for (const participant of this.livekitRoom.remoteParticipants.values()) {
        for (const pub of participant.audioTrackPublications.values()) {
          if (pub.track?.setMuted) pub.track.setMuted(Boolean(deafened));
        }
      }
    }
  }

  toggleDeafen() {
    if (!this.livekitRoom?.localParticipant) return this.isDeafened;
    this.isDeafened = !this.isDeafened;
    this.applyDeafenToRemote(this.isDeafened);
    if (this.isDeafened) {
      this.wasMutedBeforeDeafen = this.isMuted;
      if (!this.isMuted) {
        this.isMuted = true;
        void this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
      }
    } else if (!this.wasMutedBeforeDeafen && this.isMuted) {
      this.isMuted = false;
      void this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
    }
    this.emit('deafen', { deafened: this.isDeafened });
    this.emit('state');
    return this.isDeafened;
  }

  toggleVideo() {
    if (!this.livekitRoom?.localParticipant) return this.isVideoEnabled;
    this.isVideoEnabled = !this.isVideoEnabled;
    void this.livekitRoom.localParticipant.setCameraEnabled(this.isVideoEnabled).then(() => {
      this.withVideo = this.isVideoEnabled || this.isScreenSharing;
      this.emit('local-stream', { stream: this.collectLocalStream() });
      this.emit('state');
    });
    this.withVideo = this.isVideoEnabled || this.isScreenSharing;
    this.emit('state');
    return this.isVideoEnabled;
  }

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      await this.stopScreenShare();
      return false;
    }
    return this.startScreenShare();
  }

  async startScreenShare() {
    if (!this.livekitRoom?.localParticipant || this.state === 'idle') {
      throw new Error('No active call');
    }
    const share = window.RelayMediaPrefs?.livekitScreenShareOptions?.() || {
      capture: { audio: true, resolution: { width: 1920, height: 1080, frameRate: 30 } },
      publish: undefined,
    };
    await this.livekitRoom.localParticipant.setScreenShareEnabled(
      true,
      share.capture,
      share.publish,
    );
    const pub = [...this.livekitRoom.localParticipant.trackPublications.values()].find(
      (entry) => entry.source === Track.Source.ScreenShare,
    );
    if (pub?.track?.mediaStreamTrack) {
      this.screenStream = new MediaStream([pub.track.mediaStreamTrack]);
      this.emit('local-screen', { stream: this.screenStream });
    }
    this.isScreenSharing = true;
    this.withVideo = true;
    this.emit('state');
    return true;
  }

  async stopScreenShare() {
    if (!this.livekitRoom?.localParticipant) return true;
    await this.livekitRoom.localParticipant.setScreenShareEnabled(false);
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) track.stop();
      this.screenStream = null;
    }
    this.isScreenSharing = false;
    this.withVideo = this.isVideoEnabled;
    this.emit('local-screen', { stream: null });
    this.emit('state');
    return true;
  }

  // Classic-only APIs kept as no-ops for facade compatibility
  async answerCall() {
    throw new Error('LiveKit calls are joined from the room');
  }

  async rejectCall() {
    return undefined;
  }
}

window.RelayLiveKit = new RelayLiveKitManager();
