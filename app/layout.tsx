import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import { Header } from "@/components/Header";
import { getCategories } from "@/lib/microcms";
import { site } from "@/lib/site";
import "./globals.css";

/* 本文と見出しで使うのは 400 / 500 / 700 の3つだけ。
   9ウェイト全部読み込むと数MBになる。 */
const notoSerif = Noto_Serif_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s｜${site.name}` },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    images: [{ url: site.ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getCategories();

  return (
    <html lang="ja" className={notoSerif.variable}>
      <body style={{ fontFamily: "var(--font-serif), serif" }}>
        <div className="page">
          <Header categories={categories} />
          {children}
          <footer className="site-footer">
            © {new Date().getFullYear()} {site.name}
          </footer>
        </div>
      </body>
    </html>
  );
}
