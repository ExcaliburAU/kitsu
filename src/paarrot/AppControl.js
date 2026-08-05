/**
 * Shared ephemeral app state for Paarrot-compatible local control.
 * Mute/deafen/nav commands fan out over LiveHub SSE — no Electron IPC.
 */
class AppControl {
  constructor({ liveHub } = {}) {
    this.liveHub = liveHub || null;
    this.currentRoomId = null;
    this.muted = false;
    this.deafened = false;
    this.inCall = false;
    this.callRoomId = null;
  }

  publish(action, params = {}) {
    this.liveHub?.publish({
      kind: 'paarrot-control',
      action,
      ...params,
      ts: Date.now(),
    });
  }

  setCurrentRoom(roomId) {
    const next = roomId ? String(roomId) : null;
    if (next === this.currentRoomId) return this.currentRoomId;
    this.currentRoomId = next;
    return this.currentRoomId;
  }

  syncCallState({ muted, deafened, inCall, roomId } = {}) {
    if (typeof muted === 'boolean') this.muted = muted;
    if (typeof deafened === 'boolean') this.deafened = deafened;
    if (typeof inCall === 'boolean') this.inCall = inCall;
    if (roomId !== undefined) this.callRoomId = roomId || null;
    return this.getCallState();
  }

  getCallState() {
    return {
      muted: this.muted,
      deafened: this.deafened,
      inCall: this.inCall,
      callRoomId: this.callRoomId,
    };
  }

  getStatus(matrix) {
    return {
      muted: this.muted,
      deafened: this.deafened,
      currentRoom: this.currentRoomId,
      connected: Boolean(matrix?.client && matrix.ready),
      userId: matrix?.client?.getUserId?.() || null,
      inCall: this.inCall,
    };
  }

  setMute(muted) {
    const next = Boolean(muted);
    if (next === this.muted) return { muted: this.muted };
    this.muted = next;
    this.publish('set-mute', { muted: this.muted });
    return { muted: this.muted };
  }

  toggleMute() {
    if (!this.inCall) {
      return { muted: this.muted, message: 'No active call to mute/unmute' };
    }
    return this.setMute(!this.muted);
  }

  setDeafen(deafened) {
    const next = Boolean(deafened);
    if (next === this.deafened) return { deafened: this.deafened };
    this.deafened = next;
    this.publish('set-deafen', { deafened: this.deafened });
    return { deafened: this.deafened };
  }

  toggleDeafen() {
    if (!this.inCall) {
      return { deafened: this.deafened, message: 'No active call to deafen/undeafen' };
    }
    return this.setDeafen(!this.deafened);
  }

  changeChannel(roomId) {
    const id = String(roomId || '').trim();
    if (!id) throw new Error('roomId is required');
    if (id === this.currentRoomId) return { roomId: id };
    this.currentRoomId = id;
    this.publish('change-channel', { roomId: id });
    return { roomId: id };
  }
}

module.exports = { AppControl };
