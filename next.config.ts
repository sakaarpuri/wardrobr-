import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'encrypted-tbn1.gstatic.com' },
      { protocol: 'https', hostname: 'encrypted-tbn2.gstatic.com' },
      { protocol: 'https', hostname: 'encrypted-tbn3.gstatic.com' },
      { protocol: 'https', hostname: 'images.asos-media.com' },
      { protocol: 'https', hostname: 'lp2.hm.com' },
      { protocol: 'https', hostname: 'static.zara.net' },
      { protocol: 'https', hostname: 'media.office.co.uk' },
      { protocol: 'https', hostname: 'whistles.scene7.com' },
    ],
  },
};

export default nextConfig;
