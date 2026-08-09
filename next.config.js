/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // microCMS にアップロードした画像
      { protocol: "https", hostname: "images.microcms-assets.io" },
    ],
  },

  async redirects() {
    return [
      // 一覧はトップに統合したので、旧一覧ページを流す
      { source: "/miscellany", destination: "/", permanent: true },
      // ライブ情報 → イベント情報
      { source: "/live", destination: "/event", permanent: true },
      { source: "/live/:path*", destination: "/event", permanent: true },
    ];
  },
};

module.exports = nextConfig;
