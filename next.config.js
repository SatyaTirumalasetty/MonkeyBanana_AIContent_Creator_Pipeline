/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'fluent-ffmpeg'],
    outputFileTracingIncludes: {
      '/api/pipeline/stitch': ['./node_modules/@ffmpeg-installer/**/*'],
    },
  },
}
module.exports = nextConfig
