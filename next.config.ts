import type { NextConfig } from "next";

// Report-Only for now: logs violations in the browser console without blocking.
// TODO: move script-src to per-request nonces, then switch the key to
// "Content-Security-Policy" to enforce.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Builder logos come from Google's favicon service and arbitrary logo URLs.
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com https://github.com",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages don't need cross-origin reads; override Vercel's static-file `*`.
      // Static assets under /_next keep the default.
      {
        source: "/((?!_next/).*)",
        headers: [{ key: "Access-Control-Allow-Origin", value: "https://aarm.dev" }],
      },
    ];
  },
};

export default nextConfig;
