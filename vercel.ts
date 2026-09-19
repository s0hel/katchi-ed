import type { VercelConfig } from "@vercel/config/v1";

/**
 * Deployment config. The catalog is static, so grade and practice pages are
 * prerendered and cached hard at the edge; only the three question/grading
 * endpoints run per request.
 *
 * Every `value` below is a plain string literal, and deliberately so. Vercel
 * validates this file's schema before the build, reading it statically rather
 * than executing it: anything it cannot evaluate -- a `routes.*` helper call,
 * an array `.join()`, even a hoisted `const` -- reads as a missing property
 * and fails the deployment before a build machine is assigned. That failure
 * arrives with no build log, so it is worth the repetition to avoid.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",

  headers: [
    // Prerendered catalog pages change only when the catalog does. `/learn` is
    // listed separately because `/learn/(.*)` does not match a bare `/learn`.
    // The cache value is spelled out per rule rather than shared: see above.
    {
      source: "/practice/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
    },
    {
      source: "/learn",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
    },
    {
      source: "/learn/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        // The directives, for anyone editing the one-liner below:
        //   script-src/style-src allow inline -- Next injects bootstrap
        //     scripts and Tailwind emits inline styles
        //   img-src allows i.ytimg.com for lesson video thumbnails
        //   frame-src is YouTube's privacy-enhanced player and nothing else
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; font-src 'self' data:; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
        },
      ],
    },
  ],
};

export default config;
