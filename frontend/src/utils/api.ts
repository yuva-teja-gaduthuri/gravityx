export const getApiUrl = (path: string = '') => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001${path}`;
  }
  return `http://localhost:3001${path}`;
};
