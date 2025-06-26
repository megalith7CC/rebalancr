import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    dirs: ['src', 'generated'],
  },
  
};

export default nextConfig;
