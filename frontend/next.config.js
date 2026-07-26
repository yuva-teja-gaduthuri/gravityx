// next.config.js
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' wss: ws: https://gravityx-nu.vercel.app https://gravityx-api.onrender.com wss://gravityx-api.onrender.com http://localhost:3001 ws://localhost:3001;
  img-src 'self' data: blob:;
  font-src 'self' data:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};