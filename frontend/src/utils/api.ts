export const getApiUrl = (path: string = '') => {
  // If the production environment variable is set (e.g., on Vercel), prioritize it
  if (process.env.NEXT_PUBLIC_API_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }

  // Fallback to dynamic resolution for local/LAN Wi-Fi testing
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001${path}`;
  }
  return `http://localhost:3001${path}`;
};

// In-memory cache for API requests
interface CacheEntry {
  data: any;
  timestamp: number;
}

const apiCache: { [key: string]: CacheEntry } = {};

/**
 * Fetch helper with client-side cache and staleTime check
 * @param path API endpoint path
 * @param staleTime Expiration window in milliseconds (default 1 minute)
 */
export const fetchWithCache = async (path: string, staleTime: number = 60000) => {
  const url = getApiUrl(path);
  const cacheKey = url;
  const now = Date.now();

  // 1. Return fresh cached copy if available and not stale
  if (apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp) < staleTime) {
    return apiCache[cacheKey].data;
  }

  // 2. Fetch fresh telemetry from server
  const token = typeof window !== 'undefined' ? localStorage.getItem('gravityx_token') : null;
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`API fetch error! status: ${res.status}`);
  }
  
  const data = await res.json();

  // 3. Store fresh copy in cache
  apiCache[cacheKey] = {
    data,
    timestamp: now
  };

  return data;
};

/**
 * Manually invalidate cache for an endpoint (e.g., when buying/equipping skins)
 */
export const invalidateCache = (path: string) => {
  const url = getApiUrl(path);
  delete apiCache[url];
};
