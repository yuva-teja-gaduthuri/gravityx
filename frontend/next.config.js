// next.config.js
const csp = `
  default-src 'self' * data: blob: 'unsafe-inline' 'unsafe-eval';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *;
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline' *;
  connect-src 'self' wss: ws: https: http: *.loca.lt wss://*.loca.lt *.ngrok-free.app wss://*.ngrok-free.app http://localhost:3001 ws://localhost:3001;
  img-src 'self' data: blob: *;
  font-src 'self' data: *;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

module.exports = {
  // Automatically proxy API requests and Socket.IO connections from Next.js server to Express backend
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Bypass-Tunnel-Reminder', value: 'true' },
        ],
      },
    ];
  },
};

