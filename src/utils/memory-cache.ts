/**
 * In-memory TTL cache for fetch results. Works without Redis.
 * Keys expire after ttlSeconds. Values are JSON-serialized.
 */

const store = new Map<string, { value: string; expiresAt: number }>();

function get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    try {
        return JSON.parse(entry.value) as T;
    } catch {
        return null;
    }
}

function set<T>(key: string, value: T, ttlSeconds: number): void {
    store.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}

/** Get cached value or run fetcher, then cache and return. TTL in seconds. */
async function fetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const existing = get<T>(key);
    if (existing !== null) return existing;
    const value = await fetcher();
    set(key, value, ttlSeconds);
    return value;
}

export default { get, set, fetch };
