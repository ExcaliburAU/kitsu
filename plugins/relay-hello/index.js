module.exports = {
  async onLoad(ctx) {
    ctx.log('loaded');
    ctx.ui.enableFeature('hello-badge');

    ctx.events.on('sync-state', (payload) => {
      ctx.log('sync-state', payload?.state);
    });

    ctx.events.on('session-start', (payload) => {
      ctx.log('session-start', payload?.userId);
    });

    ctx.events.on('room-timeline', (payload) => {
      ctx.log('timeline', payload?.roomId, payload?.type);
    });
  },

  async onUnload(ctx) {
    ctx.log('unloaded');
  },
};
