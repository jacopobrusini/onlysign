import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "172.20.10.3",
    "localhost",
    "priest-conditioning-corporate-specifications.trycloudflare.com",
  ],
  
};

export default nextConfig;