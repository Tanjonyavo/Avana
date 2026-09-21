export interface StorageParser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export function readStorage<T>(storage: Storage, key: string, schema: StorageParser<T>, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(storage: Storage, key: string, value: T) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}
