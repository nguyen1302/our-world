/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run separately (npm run lint); skipping it during `next build`
  // cuts a lot of memory on tiny servers (EC2 1GB).
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["sharp", "exifr"],
  },
};

export default nextConfig;
