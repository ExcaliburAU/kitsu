/**
 * Kitsu Stream Deck Plugin (Paarrot-compatible)
 * Talks to Kitsu/Paarrot local API on http://127.0.0.1:33384
 *
 * Action UUIDs stay com.paarrot.streamdeck.* so existing Paarrot button
 * layouts keep working when Kitsu is the app on that port.
 */

const API_BASE_URL = 'http://127.0.0.1:33384';
const POLL_INTERVAL = 1000;

let websocket = null;
let pluginUUID = null;
let statusPollInterval = null;

const actionStates = new Map();

const ACTIONS = {
  TOGGLE_MUTE: 'com.paarrot.streamdeck.togglemute',
  TOGGLE_DEAFEN: 'com.paarrot.streamdeck.toggledeafen',
  CHANGE_CHANNEL: 'com.paarrot.streamdeck.changechannel',
  SEND_MESSAGE: 'com.paarrot.streamdeck.sendmessage',
  GET_STATUS: 'com.paarrot.streamdeck.getstatus',
};

async function callAPI(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    // Paarrot/Kitsu action responses use { success, data }.
    // /health returns { status: 'ok' } without success.
    if (endpoint !== '/health' && data.success === false) {
      throw new Error(data.error || 'API call failed');
    }
    if (endpoint !== '/health' && data.success !== true && data.data === undefined) {
      throw new Error(data.error || 'API call failed');
    }

    return data.data !== undefined ? data.data : data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    showAlert();
    throw error;
  }
}

async function getStatus() {
  return await callAPI('/status');
}

async function setMute(muted) {
  return await callAPI('/mute', 'POST', { muted });
}

async function setDeafen(deafened) {
  return await callAPI('/deafen', 'POST', { deafened });
}

async function changeChannel(roomId) {
  return await callAPI('/channel', 'POST', { roomId });
}

async function sendMessage(message) {
  return await callAPI('/message/current', 'POST', { message });
}

async function getChannels() {
  return await callAPI('/channels');
}

function updateButtonStates(status) {
  actionStates.forEach((state, context) => {
    if (state.action === ACTIONS.TOGGLE_MUTE) {
      const newState = status.muted ? 1 : 0;
      if (state.currentState !== newState) {
        setState(context, newState);
        state.currentState = newState;
      }
    } else if (state.action === ACTIONS.TOGGLE_DEAFEN) {
      const newState = status.deafened ? 1 : 0;
      if (state.currentState !== newState) {
        setState(context, newState);
        state.currentState = newState;
      }
    } else if (state.action === ACTIONS.GET_STATUS) {
      const title = `${status.muted ? 'M' : ''}${status.deafened ? 'D' : ''}${
        !status.muted && !status.deafened ? 'OK' : ''
      }`;
      setTitle(context, title);
    }
  });
}

function startStatusPolling() {
  if (statusPollInterval) return;
  statusPollInterval = setInterval(async () => {
    try {
      const status = await getStatus();
      updateButtonStates(status);
    } catch {
      // App not running
    }
  }, POLL_INTERVAL);
}

function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

function sendToStreamDeck(event, context, payload = {}) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ event, context, ...payload }));
  }
}

function setState(context, state) {
  sendToStreamDeck('setState', context, { payload: { state } });
}

function setTitle(context, title) {
  sendToStreamDeck('setTitle', context, { payload: { title } });
}

function showAlert(context) {
  if (context) sendToStreamDeck('showAlert', context);
}

function showOk(context) {
  sendToStreamDeck('showOk', context);
}

async function handleKeyDown(context, settings, action) {
  try {
    switch (action) {
      case ACTIONS.TOGGLE_MUTE: {
        const status = await getStatus();
        await setMute(!status.muted);
        showOk(context);
        break;
      }
      case ACTIONS.TOGGLE_DEAFEN: {
        const status = await getStatus();
        await setDeafen(!status.deafened);
        showOk(context);
        break;
      }
      case ACTIONS.CHANGE_CHANNEL:
        if (settings.roomId) {
          await changeChannel(settings.roomId);
          showOk(context);
        } else {
          showAlert(context);
        }
        break;
      case ACTIONS.SEND_MESSAGE:
        if (settings.message) {
          await sendMessage(settings.message);
          showOk(context);
        } else {
          showAlert(context);
        }
        break;
      case ACTIONS.GET_STATUS: {
        const status = await getStatus();
        updateButtonStates(status);
        showOk(context);
        break;
      }
    }

    const status = await getStatus();
    updateButtonStates(status);
  } catch {
    showAlert(context);
  }
}

function handleWillAppear(context, settings, action) {
  actionStates.set(context, { action, settings, currentState: 0 });
  getStatus()
    .then((status) => updateButtonStates(status))
    .catch(() => {});
}

function handleWillDisappear(context) {
  actionStates.delete(context);
}

function handleDidReceiveSettings(context, settings) {
  const state = actionStates.get(context);
  if (state) state.settings = settings;
}

function handleSendToPlugin(context, action, payload) {
  if (payload.event === 'getChannels') {
    getChannels()
      .then((channels) => {
        sendToStreamDeck('sendToPropertyInspector', context, {
          action,
          payload: { event: 'channelList', channels },
        });
      })
      .catch((error) => {
        console.error('Failed to get channels:', error);
      });
  }
}

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent) {
  pluginUUID = inPluginUUID;
  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket.send(
      JSON.stringify({
        event: inRegisterEvent,
        uuid: inPluginUUID,
      }),
    );
    startStatusPolling();
  };

  websocket.onmessage = (evt) => {
    try {
      const message = JSON.parse(evt.data);
      const { event, action, context, payload } = message;
      const settings = payload?.settings || {};

      switch (event) {
        case 'keyDown':
          handleKeyDown(context, settings, action);
          break;
        case 'willAppear':
          handleWillAppear(context, settings, action);
          break;
        case 'willDisappear':
          handleWillDisappear(context);
          break;
        case 'didReceiveSettings':
          handleDidReceiveSettings(context, settings, action);
          break;
        case 'sendToPlugin':
          handleSendToPlugin(context, action, payload);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  websocket.onclose = () => {
    stopStatusPolling();
  };
}
