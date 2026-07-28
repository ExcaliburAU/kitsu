const { EventEmitter } = require('events');

/**
 * Fans out Matrix m.call.* events to SSE / VoIP clients.
 */
class VoipHub extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    /** @type {Set<import('http').ServerResponse>} */
    this.sseClients = new Set();
  }

  publish(event) {
    this.emit('call-event', event);
    const payload = `event: call\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of this.sseClients) {
      try {
        res.write(payload);
      } catch {
        this.sseClients.delete(res);
      }
    }
  }

  addSseClient(res) {
    this.sseClients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  }

  removeSseClient(res) {
    this.sseClients.delete(res);
  }
}

module.exports = { VoipHub };
