// Notification sound utility
// Creates and manages audio notifications

let messageSound = null;
let callSound = null;
let notificationSound = null;
let callFallbackTimer = null;
const SETTINGS_KEY = "skillx_sound_settings";

const DEFAULT_SETTINGS = {
  muted: false,
  masterVolume: 0.6,
  messageVolume: 0.6,
  callVolume: 0.7,
  notificationVolume: 0.6,
};

let soundSettings = { ...DEFAULT_SETTINGS };

const clamp01 = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
};

const normalizeSettings = (raw = {}) => ({
  muted: Boolean(raw.muted),
  masterVolume: clamp01(raw.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
  messageVolume: clamp01(raw.messageVolume ?? DEFAULT_SETTINGS.messageVolume),
  callVolume: clamp01(raw.callVolume ?? DEFAULT_SETTINGS.callVolume),
  notificationVolume: clamp01(raw.notificationVolume ?? DEFAULT_SETTINGS.notificationVolume),
});

const getChannelVolume = (channel) => {
  switch (channel) {
    case "message":
      return soundSettings.messageVolume;
    case "call":
      return soundSettings.callVolume;
    case "notification":
    default:
      return soundSettings.notificationVolume;
  }
};

const getEffectiveVolume = (channel, base = 1) => {
  if (soundSettings.muted) return 0;
  return clamp01(base) * soundSettings.masterVolume * getChannelVolume(channel);
};

const applyAudioVolumes = () => {
  if (messageSound) messageSound.volume = getEffectiveVolume("message", 1);
  if (callSound) callSound.volume = getEffectiveVolume("call", 1);
  if (notificationSound) notificationSound.volume = getEffectiveVolume("notification", 1);
};

export const loadSoundSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    soundSettings = raw ? normalizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    soundSettings = { ...DEFAULT_SETTINGS };
  }

  applyAudioVolumes();
  return { ...soundSettings };
};

export const saveSoundSettings = (nextSettings = {}) => {
  soundSettings = normalizeSettings({ ...soundSettings, ...nextSettings });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(soundSettings));
  applyAudioVolumes();

  if (soundSettings.muted) {
    stopCallSound();
  }

  return { ...soundSettings };
};

export const getSoundSettings = () => ({ ...soundSettings });

const hasAudioContext = () =>
  typeof window !== "undefined" &&
  (window.AudioContext || window.webkitAudioContext);

const playBeep = (frequency = 880, durationMs = 180, volume = 0.06, channel = "notification") => {
  if (!hasAudioContext()) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(getEffectiveVolume(channel, volume), ctx.currentTime);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);

  oscillator.onended = () => {
    ctx.close().catch(() => {});
  };
};

const playBeepPattern = (pattern, channel) => {
  pattern.forEach((item) => {
    setTimeout(() => playBeep(item.freq, item.duration, item.volume, channel), item.delay);
  });
};

const playAudioWithFallback = (audio, fallbackPattern, channel, { loopFallback = false } = {}) => {
  if (soundSettings.muted) return;

  if (audio) {
    audio.volume = getEffectiveVolume(channel, 1);
    audio.currentTime = 0;
    audio.play().catch(() => {
      if (loopFallback) {
        playBeepPattern(fallbackPattern, channel);
        if (callFallbackTimer) clearInterval(callFallbackTimer);
        callFallbackTimer = setInterval(() => playBeepPattern(fallbackPattern, channel), 1800);
      } else {
        playBeepPattern(fallbackPattern, channel);
      }
    });
    return;
  }

  if (loopFallback) {
    playBeepPattern(fallbackPattern, channel);
    if (callFallbackTimer) clearInterval(callFallbackTimer);
    callFallbackTimer = setInterval(() => playBeepPattern(fallbackPattern, channel), 1800);
  } else {
    playBeepPattern(fallbackPattern, channel);
  }
};

// Initialize sounds (call once on app load)
export const initNotificationSounds = () => {
  loadSoundSettings();

  // Message received sound
  messageSound = new Audio("/sounds/message.mp3");
  
  // Call incoming sound
  callSound = new Audio("/sounds/call.mp3");
  callSound.loop = true; // Loop for calls
  
  // General notification sound
  notificationSound = new Audio("/sounds/notification.mp3");

  applyAudioVolumes();
};

// Play message received sound
export const playMessageSound = () => {
  playAudioWithFallback(messageSound, [
    { delay: 0, freq: 900, duration: 120, volume: 0.06 },
  ], "message");
};

// Play call incoming sound (loops)
export const playCallSound = () => {
  playAudioWithFallback(
    callSound,
    [
      { delay: 0, freq: 720, duration: 220, volume: 0.07 },
      { delay: 280, freq: 620, duration: 220, volume: 0.07 },
    ],
    "call",
    { loopFallback: true }
  );
};

// Stop call sound
export const stopCallSound = () => {
  if (callSound) {
    callSound.pause();
    callSound.currentTime = 0;
  }

  if (callFallbackTimer) {
    clearInterval(callFallbackTimer);
    callFallbackTimer = null;
  }
};

// Play general notification sound
export const playNotificationSound = () => {
  playAudioWithFallback(notificationSound, [
    { delay: 0, freq: 840, duration: 140, volume: 0.06 },
    { delay: 180, freq: 980, duration: 120, volume: 0.06 },
  ], "notification");
};

// Play sound based on type
export const playSound = (type) => {
  switch (type) {
    case "message":
      playMessageSound();
      break;
    case "call":
      playCallSound();
      break;
    case "notification":
      playNotificationSound();
      break;
    default:
      playNotificationSound();
  }
};
