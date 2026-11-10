import type { NextConfig } from "next";

// Enforced CSP. 'unsafe-inline' is still needed for Next's inline bootstrap
// scripts; moving script-src to per-request nonces is the next hardening step.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  // Builder logos come from Google's favicon service and arbitrary logo URLs.
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://va.vercel-scripts.com",
  "frame-src 'self'",
  // 'self' (not 'none'): the review console iframes /api/intercept/paper.
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com https://github.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Nothing here needs cross-origin reads; override Vercel's default `*`
      // (including on /_next static assets, which are only loaded same-origin).
      {
        source: "/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "https://aarm.dev" }],
      },
    ];
  },
};

export default nextConfig;
