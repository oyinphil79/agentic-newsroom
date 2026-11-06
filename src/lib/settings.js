const STORAGE_KEY = 'agentic-newsroom:settings';

export const DEFAULT_SETTINGS = {
  openaiKey: '',
  serpKey: '',
  model: 'gpt-6.1-sol',
  remember: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), remember: true };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    if (settings.remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
