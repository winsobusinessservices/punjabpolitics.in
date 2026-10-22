const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8012/api";
const mediaOrigin = new URL(apiUrl);
const isLocalMediaOrigin = ["localhost", "127.0.0.1", "::1"].includes(mediaOrigin.hostname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Lets two local dev processes run from this same folder without competing
  // for Next.js's development lock/cache directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["punjab-politics.localhost", "*.localhost"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    ...(isLocalMediaOrigin ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      {
        protocol: mediaOrigin.protocol.replace(":", ""),
        hostname: mediaOrigin.hostname,
        port: mediaOrigin.port,
        pathname: "/uploads/**",
      },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/**" },
      { protocol: "https", hostname: "vumbnail.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
