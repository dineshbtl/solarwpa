import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  extendDefaultRuntimeCaching: true,

  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        // Cache Next.js App Router RSC payloads (for offline client-side navigation)
        urlPattern: ({ request, url }) => {
          return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc') || url.pathname.startsWith('/_next/data/');
        },
        handler: 'NetworkFirst',
        options: {
          cacheName: 'rsc-payloads-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
          networkTimeoutSeconds: 3,
        },
      },
      {
        // Cache local API routes (/api/installations/list, /api/surveys/list, etc.)
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'local-api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200, 206],
          },
          networkTimeoutSeconds: 5, // Fallback to cache if network doesn't respond in 5s
        },
      },
      {
        // Cache Supabase API requests (works for cloud supabase.co and self-hosted custom domains like /supabase/rest/v1/)
        urlPattern: /^https?:\/\/[^\/]+.*\/rest\/v1\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200, 206],
          },
          networkTimeoutSeconds: 5, // Fallback to cache if network doesn't respond in 5s
        },
      },
      // Exclude Supabase Auth requests so sessions don't get messed up
      {
        urlPattern: /^https?:\/\/[^\/]+.*\/auth\/.*/i,
        handler: 'NetworkOnly',
      }
    ]
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    proxyClientMaxBodySize: '25mb',
  },
}

export default withPWA(nextConfig)

