/**
 * Conduit 1:1 WebRTC calls with Matrix signaling via the local API.
 * ICE/TURN comes from /api/voip/ice (homeserver + Conduit TURN config).
 */
(() => {
  const CALL_TIMEOUT_MS = 60_000;
  const VOIP_VERSION = '1';

  function randomId(prefix = '') {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}${hex}`;
  }

  class RelayCallManager {
    constructor() {
      this.partyId = randomId('p');
      this.state = 'idle';
      this.roomId = null;
      this.callId = null;
      this.direction = null;
      this.withVideo = false;
      this.pc = null;
      this.localStream = null;
      this.remoteStream = null;
      this.screenStream = null;
      this.cameraVideoTrack = null;
      this.isMuted = false;
      this.isDeafened = false;
      this.isVideoEnabled = false;
      this.isScreenSharing = false;
      this.ice = null;
      this.inviteTimer = null;
      this.candidateBuffer = [];
      this.listeners = new Set();
      this.eventSource = null;
      this.myUserId = null;
      this.pendingInvite = null;
      this.makingOffer = false;
      this.ignoreOffer = false;
      this.isSettingRemoteAnswerPending = false;
      /** @type {Set<string>} */
      this.speakingIds = new Set();
      this._speechRaf = 0;
      this._speechCtx = null;
      this._localAnalyser = null;
      this._remoteAnalyser = null;
    }

    on(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    emit(type, detail = {}) {
      const payload = { type, ...detail, state: this.state, roomId: this.roomId, callId: this.callId };
      for (const fn of this.listeners) {
        try {
          fn(payload);
        } catch {
          // ignore listener errors
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
      if (this.eventSource) return;
      this.eventSource = new EventSource('/api/voip/events');
      this.eventSource.addEventListener('call', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          void this.onSignalingEvent(data);
        } catch {
          // ignore
        }
      });
      this.eventSource.onerror = () => {
        // EventSource reconnects automatically
      };
    }

    stop() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      void this.hangup('user_hangup', false);
    }

    getSnapshot() {
      return {
        state: this.state,
        roomId: this.roomId,
        callId: this.callId,
        direction: this.direction,
        withVideo: this.withVideo,
        isMuted: this.isMuted,
        isDeafened: this.isDeafened,
        isVideoEnabled: this.isVideoEnabled,
        isScreenSharing: this.isScreenSharing,
        pendingInvite: this.pendingInvite,
        backend: 'webrtc',
        participants: this.getParticipants(),
        speakers: [...this.speakingIds],
        hasRemoteVideo: Boolean(
          this.remoteStream?.getVideoTracks?.().some((track) => track.readyState === 'live'),
        ),
      };
    }

    getSpeakingIds() {
      return [...this.speakingIds];
    }

    getParticipants() {
      if (this.state === 'idle' || !this.roomId) return [];
      const mine = this.myUserId
        ? [{ userId: this.myUserId, self: true, speaking: this.speakingIds.has(this.myUserId) }]
        : [];
      const other =
        this.pendingInvite?.sender && this.pendingInvite.sender !== this.myUserId
          ? [
              {
                userId: this.pendingInvite.sender,
                self: false,
                speaking: this.speakingIds.has(this.pendingInvite.sender),
              },
            ]
          : this.state === 'connected' || this.state === 'connecting' || this.state === 'invite_sent'
            ? [
                {
                  userId: 'peer',
                  self: false,
                  placeholder: true,
                  speaking: this.speakingIds.has('peer'),
                },
              ]
            : [];
      return [...mine, ...other];
    }

    peerSpeakingId() {
      if (this.pendingInvite?.sender && this.pendingInvite.sender !== this.myUserId) {
        return this.pendingInvite.sender;
      }
      return 'peer';
    }

    ensureSpeechContext() {
      if (this._speechCtx) return this._speechCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this._speechCtx = new Ctx();
      return this._speechCtx;
    }

    bindAnalyser(stream) {
      const ctx = this.ensureSpeechContext();
      if (!ctx || !stream?.getAudioTracks?.().length) return null;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        return { analyser, source, data: new Uint8Array(analyser.frequencyBinCount) };
      } catch {
        return null;
      }
    }

    analyserLoud(binding, threshold = 18) {
      if (!binding?.analyser) return false;
      binding.analyser.getByteFrequencyData(binding.data);
      let sum = 0;
      const len = Math.min(binding.data.length, 64);
      for (let i = 0; i < len; i += 1) sum += binding.data[i];
      return sum / len > threshold;
    }

    startSpeechMonitor() {
      this.stopSpeechMonitor(false);
      const tick = () => {
        this._speechRaf = requestAnimationFrame(tick);
        if (this.state === 'idle') return;

        if (!this._localAnalyser && this.localStream) {
          this._localAnalyser = this.bindAnalyser(this.localStream);
        }
        if (!this._remoteAnalyser && this.remoteStream?.getAudioTracks?.().length) {
          this._remoteAnalyser = this.bindAnalyser(this.remoteStream);
        }
        if (this._speechCtx?.state === 'suspended') {
          void this._speechCtx.resume().catch(() => {});
        }

        const next = new Set();
        if (!this.isMuted && this.myUserId && this.analyserLoud(this._localAnalyser)) {
          next.add(this.myUserId);
        }
        if (this.analyserLoud(this._remoteAnalyser)) {
          next.add(this.peerSpeakingId());
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
      };
      this._speechRaf = requestAnimationFrame(tick);
    }

    stopSpeechMonitor(emitClear = true) {
      if (this._speechRaf) {
        cancelAnimationFrame(this._speechRaf);
        this._speechRaf = 0;
      }
      this._localAnalyser = null;
      this._remoteAnalyser = null;
      if (this._speechCtx) {
        try {
          void this._speechCtx.close();
        } catch {
          // ignore
        }
        this._speechCtx = null;
      }
      if (this.speakingIds.size) {
        this.speakingIds = new Set();
        if (emitClear) this.emit('speaking', { speakers: [] });
      }
    }

    async refreshIce() {
      this.ice = await this.api('/api/voip/ice');
      return this.ice;
    }

    async ensureMedia(withVideo) {
      if (this.localStream) {
        for (const track of this.localStream.getTracks()) track.stop();
        this.localStream = null;
      }
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: window.RelayMediaPrefs?.audioConstraints?.() || true,
        video: Boolean(withVideo),
      });
      this.isVideoEnabled = Boolean(withVideo);
      this.isMuted = false;
      const cam = this.localStream.getVideoTracks()[0] || null;
      this.cameraVideoTrack = cam;
      return this.localStream;
    }

    findVideoSender() {
      if (!this.pc) return null;
      const withVideo = this.pc.getSenders().find((sender) => sender.track?.kind === 'video');
      if (withVideo) return withVideo;
      const transceiver = this.pc
        .getTransceivers()
        .find(
          (entry) =>
            entry.receiver?.track?.kind === 'video' ||
            entry.sender?.track?.kind === 'video' ||
            entry.mid === 'video',
        );
      return transceiver?.sender || null;
    }

    async createPeerConnection() {
      if (!this.ice) await this.refreshIce();
      const iceServers = this.ice?.iceServers || [];
      const forceTurn = Boolean(this.ice?.forceTurn);
      if (!iceServers.length) {
        console.warn('[voip] No ICE servers configured — NAT traversal may fail');
      }

      this.pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: forceTurn ? 'relay' : 'all',
        bundlePolicy: 'max-bundle',
      });

      this.remoteStream = new MediaStream();
      this.pc.addEventListener('track', (ev) => {
        for (const track of ev.streams[0]?.getTracks?.() || [ev.track]) {
          this.remoteStream.addTrack(track);
        }
        this._remoteAnalyser = null;
        this.startSpeechMonitor();
        this.emit('remote-stream', { stream: this.remoteStream });
      });

      this.pc.addEventListener('icecandidate', (ev) => {
        if (!ev.candidate) {
          void this.sendCandidates([null]);
          return;
        }
        const c = ev.candidate.toJSON();
        this.candidateBuffer.push(c);
        if (this.candidateBuffer.length >= 3) {
          void this.flushCandidates();
        } else {
          clearTimeout(this._candTimer);
          this._candTimer = setTimeout(() => void this.flushCandidates(), 200);
        }
      });

      this.pc.addEventListener('connectionstatechange', () => {
        const cs = this.pc?.connectionState;
        if (cs === 'connected') {
          this.state = 'connected';
          this.clearInviteTimer();
          this.startSpeechMonitor();
          this.emit('state');
          void this.publishCallMembership(true);
        } else if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
          if (this.state !== 'idle') {
            void this.hangup(cs === 'failed' ? 'ice_failed' : 'user_hangup', true);
          }
        }
      });

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          this.pc.addTrack(track, this.localStream);
        }
      }

      // Ensure we can later attach a screen/camera video track on voice calls.
      if (!this.localStream?.getVideoTracks?.().length) {
        this.pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    }

    async flushCandidates() {
      if (!this.candidateBuffer.length || !this.callId || !this.roomId) return;
      const batch = this.candidateBuffer.splice(0);
      await this.sendCandidates(batch);
    }

    async sendCandidates(candidates) {
      if (!this.callId || !this.roomId) return;
      const cleaned = candidates
        .filter((c) => c)
        .map((c) => ({
          candidate: c.candidate,
          sdpMid: c.sdpMid ?? null,
          sdpMLineIndex: c.sdpMLineIndex ?? null,
        }));
      // End-of-candidates: empty list is intentional for MSC2746-style completion
      try {
        await this.api('/api/voip/signal', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'm.call.candidates',
            content: {
              version: VOIP_VERSION,
              call_id: this.callId,
              party_id: this.partyId,
              candidates: cleaned,
            },
          }),
        });
      } catch (error) {
        console.warn('[voip] candidate send failed', error);
      }
    }

    clearInviteTimer() {
      if (this.inviteTimer) {
        clearTimeout(this.inviteTimer);
        this.inviteTimer = null;
      }
    }

    async placeCall(roomId, { video = false } = {}) {
      if (this.state !== 'idle') throw new Error('Already in a call');
      if (!roomId) throw new Error('Room required');

      this.roomId = roomId;
      this.callId = randomId();
      this.direction = 'outbound';
      this.withVideo = Boolean(video);
      this.state = 'connecting';
      this.emit('state');

      try {
        await this.ensureMedia(this.withVideo);
        this.emit('local-stream', { stream: this.localStream });
        await this.createPeerConnection();

        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await this.pc.setLocalDescription(offer);

        await this.api('/api/voip/signal', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'm.call.invite',
            content: {
              version: VOIP_VERSION,
              call_id: this.callId,
              party_id: this.partyId,
              lifetime: CALL_TIMEOUT_MS,
              offer: this.pc.localDescription.toJSON(),
              capabilities: { 'm.call.transferee': false, 'm.call.dtmf': false },
            },
          }),
        });

        this.state = 'invite_sent';
        this.emit('state');
        this.inviteTimer = setTimeout(() => {
          if (this.state === 'invite_sent') {
            void this.hangup('invite_timeout', true);
          }
        }, CALL_TIMEOUT_MS);
      } catch (error) {
        await this.cleanupLocal();
        this.state = 'idle';
        this.emit('error', { error: error?.message || String(error) });
        this.emit('state');
        throw error;
      }
    }

    async answerCall() {
      const invite = this.pendingInvite;
      if (!invite || this.state !== 'ringing') throw new Error('No incoming call');

      this.withVideo = Boolean(
        invite.content?.offer?.sdp && /m=video/i.test(invite.content.offer.sdp),
      );
      this.state = 'connecting';
      this.emit('state');

      try {
        await this.ensureMedia(this.withVideo);
        this.emit('local-stream', { stream: this.localStream });
        await this.createPeerConnection();

        const offer = invite.content.offer;
        await this.pc.setRemoteDescription(offer);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        await this.api('/api/voip/signal', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'm.call.answer',
            content: {
              version: VOIP_VERSION,
              call_id: this.callId,
              party_id: this.partyId,
              answer: this.pc.localDescription.toJSON(),
              capabilities: { 'm.call.transferee': false, 'm.call.dtmf': false },
            },
          }),
        });

        this.pendingInvite = null;
        this.state = 'connecting';
        this.emit('state');
      } catch (error) {
        await this.hangup('user_hangup', true);
        throw error;
      }
    }

    async rejectCall() {
      if (!this.pendingInvite || !this.roomId || !this.callId) {
        this.pendingInvite = null;
        this.state = 'idle';
        this.emit('state');
        return;
      }
      try {
        await this.api('/api/voip/signal', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'm.call.reject',
            content: {
              version: VOIP_VERSION,
              call_id: this.callId,
              party_id: this.partyId,
            },
          }),
        });
      } catch {
        // ignore
      }
      this.pendingInvite = null;
      this.roomId = null;
      this.callId = null;
      this.state = 'idle';
      this.emit('state');
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      for (const track of this.localStream?.getAudioTracks?.() || []) {
        track.enabled = !this.isMuted;
      }
      if (this.isMuted && this.myUserId && this.speakingIds.has(this.myUserId)) {
        this.speakingIds.delete(this.myUserId);
        this.emit('speaking', { speakers: [...this.speakingIds] });
      }
      this.emit('state');
      return this.isMuted;
    }

    toggleDeafen() {
      this.isDeafened = !this.isDeafened;
      this.emit('deafen', { deafened: this.isDeafened });
      this.emit('state');
      return this.isDeafened;
    }

    toggleVideo() {
      if (this.isScreenSharing) {
        // Camera is parked while screen-sharing; remember preferred cam state.
        this.isVideoEnabled = !this.isVideoEnabled;
        this.emit('state');
        return this.isVideoEnabled;
      }
      const videoTracks = this.localStream?.getVideoTracks?.() || [];
      if (!videoTracks.length) {
        void this.enableCamera().catch((error) => {
          this.emit('error', { error: error?.message || String(error) });
        });
        return this.isVideoEnabled;
      }
      this.isVideoEnabled = !this.isVideoEnabled;
      for (const track of videoTracks) track.enabled = this.isVideoEnabled;
      this.withVideo = this.isVideoEnabled || this.isScreenSharing;
      this.emit('local-stream', { stream: this.localStream });
      this.emit('state');
      return this.isVideoEnabled;
    }

    async enableCamera() {
      if (!this.pc || this.state === 'idle') return false;
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = camStream.getVideoTracks()[0];
      if (!track) return false;
      this.cameraVideoTrack = track;
      if (this.localStream) this.localStream.addTrack(track);
      else this.localStream = camStream;
      const sender = this.findVideoSender();
      if (sender) await sender.replaceTrack(track);
      else {
        this.pc.addTrack(track, this.localStream);
        await this.renegotiate();
      }
      this.isVideoEnabled = true;
      this.withVideo = true;
      this.emit('local-stream', { stream: this.localStream });
      this.emit('state');
      return true;
    }

    async toggleScreenShare() {
      if (this.isScreenSharing) {
        await this.stopScreenShare();
        return false;
      }
      return this.startScreenShare();
    }

    async startScreenShare() {
      if (!this.pc || this.state === 'idle') throw new Error('No active call');
      if (this.isScreenSharing) return true;

      const stream = await navigator.mediaDevices.getDisplayMedia(
        window.RelayMediaPrefs?.displayMediaConstraints?.() || {
          video: {
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        },
      );
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error('No screen video track');
      }

      screenTrack.addEventListener('ended', () => {
        void this.stopScreenShare();
      });

      const sender = this.findVideoSender();
      const current = sender?.track || null;
      if (current && current !== this.cameraVideoTrack) {
        // keep camera reference if we somehow already had one
      }
      if (current?.readyState === 'live' && current !== screenTrack) {
        this.cameraVideoTrack = current;
      } else if (this.localStream?.getVideoTracks?.()[0]) {
        this.cameraVideoTrack = this.localStream.getVideoTracks()[0];
      }

      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        this.pc.addTrack(screenTrack, stream);
        await this.renegotiate();
      }

      // Optional system audio from the share
      for (const audioTrack of stream.getAudioTracks()) {
        this.pc.addTrack(audioTrack, stream);
      }

      this.screenStream = stream;
      this.isScreenSharing = true;
      this.withVideo = true;
      this.emit('local-screen', { stream });
      this.emit('state');
      return true;
    }

    async stopScreenShare() {
      if (!this.isScreenSharing) return true;
      const sender = this.findVideoSender();
      const restore = this.isVideoEnabled ? this.cameraVideoTrack : null;
      if (sender) {
        try {
          await sender.replaceTrack(restore && restore.readyState !== 'ended' ? restore : null);
        } catch (error) {
          console.warn('[voip] restore camera after screen share failed', error);
        }
      }

      if (this.screenStream) {
        for (const track of this.screenStream.getTracks()) track.stop();
        this.screenStream = null;
      }

      this.isScreenSharing = false;
      this.withVideo = this.isVideoEnabled;
      this.emit('local-screen', { stream: null });
      this.emit('local-stream', { stream: this.localStream });
      this.emit('state');
      return true;
    }

    async renegotiate() {
      if (!this.pc || !this.roomId || !this.callId) return;
      try {
        this.makingOffer = true;
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.api('/api/voip/signal', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            type: 'm.call.negotiate',
            content: {
              version: VOIP_VERSION,
              call_id: this.callId,
              party_id: this.partyId,
              description: this.pc.localDescription.toJSON(),
            },
          }),
        });
      } catch (error) {
        console.warn('[voip] renegotiate failed', error);
      } finally {
        this.makingOffer = false;
      }
    }

    async hangup(reason = 'user_hangup', notifyRemote = true) {
      const roomId = this.roomId;
      const callId = this.callId;
      const partyId = this.partyId;
      const wasActive = this.state !== 'idle';

      if (notifyRemote && wasActive && roomId && callId) {
        try {
          await this.api('/api/voip/signal', {
            method: 'POST',
            body: JSON.stringify({
              roomId,
              type: 'm.call.hangup',
              content: {
                version: VOIP_VERSION,
                call_id: callId,
                party_id: partyId,
                reason: reason || 'user_hangup',
              },
            }),
          });
        } catch {
          // ignore
        }
      }

      if (wasActive && roomId) {
        await this.publishCallMembership(false);
      }

      await this.cleanupLocal();
      if (wasActive) {
        this.emit('ended', { reason });
      }
      this.emit('state');
    }

    async publishCallMembership(active) {
      if (!this.roomId) return;
      try {
        await this.api('/api/voip/livekit/membership', {
          method: 'POST',
          body: JSON.stringify({
            roomId: this.roomId,
            active: Boolean(active),
            callId: '',
          }),
        });
      } catch {
        // Soft-fail — room list still shows local participants while in-call.
      }
    }

    async cleanupLocal() {
      this.clearInviteTimer();
      clearTimeout(this._candTimer);
      this.stopSpeechMonitor(true);
      this.candidateBuffer = [];
      this.pendingInvite = null;
      this.makingOffer = false;
      this.ignoreOffer = false;
      this.isSettingRemoteAnswerPending = false;

      if (this.screenStream) {
        for (const track of this.screenStream.getTracks()) track.stop();
        this.screenStream = null;
      }
      if (this.cameraVideoTrack && this.cameraVideoTrack.readyState !== 'ended') {
        // camera track may also live on localStream; stop via stream below
      }

      if (this.pc) {
        try {
          this.pc.close();
        } catch {
          // ignore
        }
        this.pc = null;
      }
      if (this.localStream) {
        for (const track of this.localStream.getTracks()) track.stop();
        this.localStream = null;
      }
      this.remoteStream = null;
      this.cameraVideoTrack = null;
      this.roomId = null;
      this.callId = null;
      this.direction = null;
      this.withVideo = false;
      this.isMuted = false;
      this.isDeafened = false;
      this.isVideoEnabled = false;
      this.isScreenSharing = false;
      this.state = 'idle';
    }

    async onSignalingEvent(event) {
      if (!event?.type?.startsWith('m.call.')) return;
      if (event.sender && this.myUserId && event.sender === this.myUserId) return;

      const content = event.content || {};
      const callId = content.call_id;

      if (event.type === 'm.call.invite') {
        if (this.state !== 'idle') {
          // Busy — reject
          try {
            await this.api('/api/voip/signal', {
              method: 'POST',
              body: JSON.stringify({
                roomId: event.roomId,
                type: 'm.call.hangup',
                content: {
                  version: VOIP_VERSION,
                  call_id: callId,
                  party_id: this.partyId,
                  reason: 'user_busy',
                },
              }),
            });
          } catch {
            // ignore
          }
          return;
        }
        this.roomId = event.roomId;
        this.callId = callId;
        this.direction = 'inbound';
        this.pendingInvite = event;
        this.state = 'ringing';
        this.emit('incoming', { event });
        this.emit('state');
        return;
      }

      if (!this.callId || callId !== this.callId) return;

      if (event.type === 'm.call.answer' && this.direction === 'outbound' && this.pc) {
        try {
          await this.pc.setRemoteDescription(content.answer);
          this.state = 'connecting';
          this.clearInviteTimer();
          this.emit('state');
        } catch (error) {
          console.warn('[voip] setRemoteDescription(answer) failed', error);
          await this.hangup('set_remote_description', true);
        }
        return;
      }

      if (event.type === 'm.call.candidates' && this.pc) {
        for (const c of content.candidates || []) {
          if (!c || !c.candidate) continue;
          try {
            await this.pc.addIceCandidate(c);
          } catch (error) {
            console.warn('[voip] addIceCandidate failed', error);
          }
        }
        return;
      }

      if (event.type === 'm.call.negotiate' && this.pc && content.description) {
        try {
          const description = content.description;
          const offerCollision =
            description.type === 'offer' &&
            (this.makingOffer || this.pc.signalingState !== 'stable');
          const polite = this.direction === 'inbound';
          this.ignoreOffer = !polite && offerCollision;
          if (this.ignoreOffer) return;

          this.isSettingRemoteAnswerPending = description.type === 'answer';
          await this.pc.setRemoteDescription(description);
          this.isSettingRemoteAnswerPending = false;

          if (description.type === 'offer') {
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            await this.api('/api/voip/signal', {
              method: 'POST',
              body: JSON.stringify({
                roomId: this.roomId,
                type: 'm.call.negotiate',
                content: {
                  version: VOIP_VERSION,
                  call_id: this.callId,
                  party_id: this.partyId,
                  description: this.pc.localDescription.toJSON(),
                },
              }),
            });
          }
          this.emit('remote-stream', { stream: this.remoteStream });
          this.emit('state');
        } catch (error) {
          console.warn('[voip] negotiate failed', error);
        }
        return;
      }

      if (event.type === 'm.call.hangup' || event.type === 'm.call.reject') {
        await this.cleanupLocal();
        this.emit('ended', { reason: content.reason || event.type });
        this.emit('state');
      }
    }
  }

  window.RelayVoipClassic = new RelayCallManager();

  function activeBackend() {
    const lk = window.RelayLiveKit;
    if (lk && lk.state && lk.state !== 'idle') return lk;
    const classic = window.RelayVoipClassic;
    if (classic && classic.state && classic.state !== 'idle') return classic;
    return null;
  }

  window.RelayVoip = {
    backend: null,
    on(fn) {
      const offClassic = window.RelayVoipClassic.on(fn);
      const offLive = window.RelayLiveKit?.on?.(fn);
      return () => {
        offClassic();
        offLive?.();
      };
    },
    async start(sessionUserId) {
      await window.RelayVoipClassic.start(sessionUserId);
      await window.RelayLiveKit?.start?.(sessionUserId);
    },
    stop() {
      window.RelayLiveKit?.stop?.();
      window.RelayVoipClassic.stop();
    },
    getSnapshot() {
      return (activeBackend() || window.RelayVoipClassic).getSnapshot();
    },
    getSpeakingIds() {
      const active = activeBackend() || window.RelayVoipClassic;
      if (typeof active.getSpeakingIds === 'function') return active.getSpeakingIds();
      return active.getSnapshot?.()?.speakers || [];
    },
    async placeCall(roomId, options = {}) {
      const livekit = window.RelayLiveKit;
      if (livekit && (await livekit.isSupported(roomId))) {
        this.backend = 'livekit';
        return livekit.placeCall(roomId, options);
      }
      this.backend = 'webrtc';
      return window.RelayVoipClassic.placeCall(roomId, options);
    },
    answerCall(...args) {
      return window.RelayVoipClassic.answerCall(...args);
    },
    rejectCall(...args) {
      return window.RelayVoipClassic.rejectCall(...args);
    },
    hangup(...args) {
      const active = activeBackend() || window.RelayVoipClassic;
      return active.hangup(...args);
    },
    toggleMute() {
      return (activeBackend() || window.RelayVoipClassic).toggleMute?.();
    },
    toggleDeafen() {
      return (activeBackend() || window.RelayVoipClassic).toggleDeafen?.();
    },
    toggleVideo() {
      return (activeBackend() || window.RelayVoipClassic).toggleVideo?.();
    },
    toggleScreenShare() {
      return (activeBackend() || window.RelayVoipClassic).toggleScreenShare?.();
    },
  };
})();
