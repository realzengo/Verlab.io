import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The video downloader was removed (2026-11-26): old /downloads links land
  // on the dashboard home instead of a 404.
  async redirects() {
    return [
      { source: "/downloads", destination: "/", permanent: true },
      { source: "/app/downloads", destination: "/", permanent: true },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
