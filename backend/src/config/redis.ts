// ─── In-Memory Cache (Redis replacement for local development) ───

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Cleanup expired entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, 30000);

export const testRedisConnection = async (): Promise<boolean> => {
  console.log('✅ In-memory cache initialized (Redis replacement)');
  return true;
};

// Cache helpers
export const cacheGet = async (key: string): Promise<string | null> => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

export const cacheSet = async (key: string, value: string, ttlSeconds: number = 300): Promise<void> => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

export const cacheDelete = async (key: string): Promise<void> => {
  cache.delete(key);
};

export const cacheGetJSON = async <T>(key: string): Promise<T | null> => {
  const data = await cacheGet(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const cacheSetJSON = async <T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> => {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
};

// Fake redis object so health check can call .ping()
const fakeRedis = {
  ping: async () => 'PONG',
};

export default fakeRedis;
