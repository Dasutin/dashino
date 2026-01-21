const STORAGE_KEY = "dashino:debugOverlay";

function normalizeBool(value: string | null): boolean | null {
  if (value === null) return null;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}

export function parseDebugFromUrl(search?: string): boolean | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(search ?? window.location.search);
  const raw = params.get("debug");
  return normalizeBool(raw);
}

export function loadDebugFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = normalizeBool(raw);
  return parsed ?? false;
}

export function saveDebugToStorage(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}
