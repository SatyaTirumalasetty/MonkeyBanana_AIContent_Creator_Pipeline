/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'fluent-ffmpeg', '@napi-rs/canvas'],
    outputFileTracingIncludes: {
      '/api/pipeline/stitch': ['./node_modules/@ffmpeg-installer/**/*'],
      '/api/pipeline/clip': ['./node_modules/@ffmpeg-installer/**/*'],
    },
  },
}
module.exports = nextConfig
