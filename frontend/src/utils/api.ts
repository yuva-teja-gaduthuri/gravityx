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
