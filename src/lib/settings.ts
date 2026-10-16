export interface Settings {
  deepseekApiKey: string;
  attachmentThresholdBytes: number;
}

const STORAGE_KEY = "calendar-importer.settings";
export const DEFAULT_ATTACHMENT_THRESHOLD_BYTES = 300 * 1024;

const defaults: Settings = {
  deepseekApiKey: "",
  attachmentThresholdBytes: DEFAULT_ATTACHMENT_THRESHOLD_BYTES,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return {
      deepseekApiKey: typeof parsed.deepseekApiKey === "string" ? parsed.deepseekApiKey : "",
      attachmentThresholdBytes:
        typeof parsed.attachmentThresholdBytes === "number"
          ? parsed.attachmentThresholdBytes
          : DEFAULT_ATTACHMENT_THRESHOLD_BYTES,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
