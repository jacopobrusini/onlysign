import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "172.20.10.3",
    "localhost",
    "https://whereas-lexmark-collections-excluded.trycloudflare.com",
  ],
  
};

export default nextConfig;