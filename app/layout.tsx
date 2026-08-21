import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Header } from "@/components/Header";
import { getCategories, getSettings } from "@/lib/microcms";
import { site } from "@/lib/site";
import "./globals.css";

/* 使うのは 400 / 500 / 700 の3つだけ。
   9ウェイト全部読み込むと数MBになる。 */
const notoSerif = Noto_Serif_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const ogImage = settings.ogImage?.url ?? site.fallbackOgImage;

  return {
    metadataBase: new URL(site.url),
    title: { default: settings.siteName, template: `%s｜${settings.siteName}` },
    description: settings.siteDescription,
    openGraph: {
      type: "website",
      siteName: settings.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);

  return (
    <html lang="ja" className={notoSerif.variable}>
      <body style={{ fontFamily: "var(--font-serif), serif" }}>
        <div className="page">
          <Header categories={categories} settings={settings} />
          {children}
          <footer className="site-footer">
            © {new Date().getFullYear()} {settings.siteName}
          </footer>
        </div>

        {/* Cookie を使わない計測。同意バナーは不要 */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
