/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['polymarket-upload.s3.us-east-2.amazonaws.com'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig; 