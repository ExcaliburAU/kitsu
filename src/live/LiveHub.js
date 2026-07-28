const { EventEmitter } = require('events');

/**
 * Fans out Matrix timeline / room updates to SSE clients for snappy UI refresh.
 */
class LiveHub extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    /** @type {Set<import('http').ServerResponse>} */
    this.sseClients = new Set();
  }

  publish(event) {
    this.emit('live', event);
    const payload = `event: live\ndata: ${JSON.stringify(event)}\n\n`;
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

module.exports = { LiveHub };
