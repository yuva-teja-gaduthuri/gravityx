export const getApiUrl = (path: string = '') => {
  // If the production environment variable is set (e.g., on Render or Vercel), prioritize it
  if (process.env.NEXT_PUBLIC_API_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }

  // Dynamic resolution for client-side rendering across local, LAN, and PaaS deployments
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Auto-detect Render deployment domain
    if (hostname.includes('onrender.com')) {
      return `https://gravityx-api.onrender.com${path}`;
    }

    // Auto-detect Localtunnel or ngrok domain
    if (hostname.includes('loca.lt') || hostname.includes('ngrok')) {
      // If frontend is on a localtunnel domain, check if backend API URL is provided via window or query
      const customApi = (window as any).__GRAVITYX_API_URL__;
      if (customApi) return `${customApi.replace(/\/$/, '')}${path}`;
      // Fallback to current protocol & hostname (or default port 3001 if direct HTTP LAN)
      return `${window.location.protocol}//${hostname}${path}`;
    }

    // Auto-detect production HTTPS protocol
    if (window.location.protocol === 'https:') {
      return `https://${hostname}${path}`;
    }

    // Local / LAN IP testing
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
 * Safely parse JSON from a fetch Response, handling non-JSON error responses (like 502 Bad Gateway HTML/text)
 */
export const parseResponseJson = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      return await res.json();
    } catch {
      // Continue to text fallback if JSON parsing fails
    }
  }

  const rawText = await res.text().catch(() => '');

  if (res.status === 502 || rawText.toLowerCase().includes('bad gateway')) {
    throw new Error('Unable to connect to backend server (502 Bad Gateway). Please verify backend server is running on port 3001.');
  }
  if (res.status === 503 || res.status === 504 || rawText.toLowerCase().includes('gateway timeout')) {
    throw new Error(`Server temporarily unavailable (${res.status}). Please try again.`);
  }

  if (!res.ok) {
    throw new Error(rawText || `Server error (${res.status})`);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { text: rawText };
  }
};

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

  // 2. Fetch fresh telemetry from server with localtunnel bypass headers
  const token = typeof window !== 'undefined' ? localStorage.getItem('gravityx_token') : null;
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
    }
  });

  const data = await parseResponseJson(res);

  if (!res.ok) {
    throw new Error(data?.error || `API fetch error! status: ${res.status}`);
  }

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

