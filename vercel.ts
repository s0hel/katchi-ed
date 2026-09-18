import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * Deployment config. The catalog is static, so grade and practice pages are
 * prerendered and cached hard at the edge; only the three question/grading
 * endpoints run per request.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",

  headers: [
    // Prerendered skill pages change only when the catalog does.
    routes.cacheControl("/practice/(.*)", { public: true, maxAge: "1 hour", staleWhileRevalidate: "1 day" }),
    routes.cacheControl("/learn/(.*)", { public: true, maxAge: "1 hour", staleWhileRevalidate: "1 day" }),
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Next injects inline bootstrap scripts and Tailwind emits inline styles
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://i.ytimg.com",
            "font-src 'self' data:",
            "connect-src 'self'",
            // lesson videos, via YouTube's privacy-enhanced player only
            "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default config;
