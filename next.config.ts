import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy without nonces (https://nextjs.org/docs/app/guides/content-security-policy):
// scripts, styles, fonts and requests only from this site. Inline scripts are allowed: Next.js puts
// its own into every page. Inline styles too: the UI components position popups with them.
// React in development needs eval for its error stacks; production doesn't.
// No upgrade-insecure-requests: every server address is https already (HSTS below), and local runs
// and e2e are plain http on localhost.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Browsers remember for a year to open the app only over https; ignored on plain http
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // No other site may show the app in a frame (CSP frame-ancestors, and this for old browsers)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites get only the origin, never a path or a query with a contact's name
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app needs none of these
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No "X-Powered-By: Next.js": the app doesn't name its software
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
