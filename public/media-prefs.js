(() => {
  const KEYS = {
    audioInput: 'relay.media.audioInput',
    audioOutput: 'relay.media.audioOutput',
    noiseSuppression: 'relay.media.noiseSuppression',
    echoCancellation: 'relay.media.echoCancellation',
    autoGainControl: 'relay.media.autoGainControl',
    screenResolution: 'relay.media.screenResolution',
    screenBitrate: 'relay.media.screenBitrate',
    screenFps: 'relay.media.screenFps',
    showRemoteCursor: 'relay.media.showRemoteCursor',
  };

  const RESOLUTION = {
    source: null,
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
  };

  const BITRATE = {
    low: 1_000_000,
    medium: 2_500_000,
    high: 5_000_000,
    ultra: 10_000_000,
  };

  function readBool(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return raw === '1' || raw === 'true';
    } catch {
      return fallback;
    }
  }

  function writeBool(key, value) {
    try {
      localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function readString(key, fallback = '') {
    try {
      const raw = localStorage.getItem(key);
      return raw == null || raw === '' ? fallback : raw;
    } catch {
      return fallback;
    }
  }

  function writeString(key, value) {
    try {
      if (value == null || value === '') localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      // ignore
    }
  }

  function get() {
    return {
      audioInput: readString(KEYS.audioInput, ''),
      audioOutput: readString(KEYS.audioOutput, ''),
      noiseSuppression: readBool(KEYS.noiseSuppression, false),
      echoCancellation: readBool(KEYS.echoCancellation, false),
      autoGainControl: readBool(KEYS.autoGainControl, true),
      screenResolution: readString(KEYS.screenResolution, 'source'),
      screenBitrate: readString(KEYS.screenBitrate, 'ultra'),
      screenFps: Number(readString(KEYS.screenFps, '15')) || 15,
      showRemoteCursor: readBool(KEYS.showRemoteCursor, true),
    };
  }

  function set(partial = {}) {
    if ('audioInput' in partial) writeString(KEYS.audioInput, partial.audioInput || '');
    if ('audioOutput' in partial) writeString(KEYS.audioOutput, partial.audioOutput || '');
    if ('noiseSuppression' in partial) writeBool(KEYS.noiseSuppression, Boolean(partial.noiseSuppression));
    if ('echoCancellation' in partial) writeBool(KEYS.echoCancellation, Boolean(partial.echoCancellation));
    if ('autoGainControl' in partial) writeBool(KEYS.autoGainControl, Boolean(partial.autoGainControl));
    if ('screenResolution' in partial) {
      writeString(KEYS.screenResolution, partial.screenResolution || 'source');
    }
    if ('screenBitrate' in partial) writeString(KEYS.screenBitrate, partial.screenBitrate || 'ultra');
    if ('screenFps' in partial) writeString(KEYS.screenFps, String(partial.screenFps || 15));
    if ('showRemoteCursor' in partial) writeBool(KEYS.showRemoteCursor, Boolean(partial.showRemoteCursor));
    return get();
  }

  function audioConstraints() {
    const prefs = get();
    const audio = {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseSuppression,
      autoGainControl: prefs.autoGainControl,
    };
    if (prefs.audioInput) audio.deviceId = { ideal: prefs.audioInput };
    return audio;
  }

  function screenResolutionSize() {
    const prefs = get();
    return RESOLUTION[prefs.screenResolution] || null;
  }

  function screenMaxBitrate() {
    const prefs = get();
    return BITRATE[prefs.screenBitrate] || BITRATE.ultra;
  }

  function displayMediaConstraints() {
    const prefs = get();
    const fps = Math.max(1, Math.min(60, Number(prefs.screenFps) || 15));
    const size = screenResolutionSize();
    const video = {
      frameRate: { ideal: fps, max: fps },
      cursor: prefs.showRemoteCursor ? 'always' : 'never',
    };
    if (size) {
      video.width = { ideal: size.width, max: size.width };
      video.height = { ideal: size.height, max: size.height };
    }
    return { video, audio: true };
  }

  function livekitAudioCaptureOptions() {
    const prefs = get();
    const options = {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseSuppression,
      autoGainControl: prefs.autoGainControl,
    };
    if (prefs.audioInput) options.deviceId = prefs.audioInput;
    return options;
  }

  function livekitScreenShareOptions() {
    const prefs = get();
    const fps = Math.max(1, Math.min(60, Number(prefs.screenFps) || 15));
    const size = screenResolutionSize() || { width: 1920, height: 1080 };
    return {
      capture: {
        audio: true,
        resolution: { width: size.width, height: size.height, frameRate: fps },
        contentHint: 'detail',
      },
      publish: {
        videoEncoding: {
          maxBitrate: screenMaxBitrate(),
          maxFramerate: fps,
        },
      },
    };
  }

  async function applyAudioOutput(element) {
    if (!element || typeof element.setSinkId !== 'function') return false;
    const prefs = get();
    try {
      await element.setSinkId(prefs.audioOutput || '');
      return true;
    } catch {
      return false;
    }
  }

  window.RelayMediaPrefs = {
    KEYS,
    get,
    set,
    audioConstraints,
    displayMediaConstraints,
    livekitAudioCaptureOptions,
    livekitScreenShareOptions,
    screenMaxBitrate,
    applyAudioOutput,
  };
})();
