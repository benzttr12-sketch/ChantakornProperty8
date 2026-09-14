/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Remote images are already resized by their source URL. Loading them
    // directly also keeps local previews working when the image optimizer
    // cannot reach third-party hosts from the dev server.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      }
    ],
  },
};

export default nextConfig;
