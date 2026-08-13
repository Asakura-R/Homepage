/**
 * サイト名・紹介文・SNSリンク・OGP画像・宣材写真は
 * microCMS の settings から読むので、ここには置かない。
 * ここに残すのは CMS で扱わない固定値だけ。
 */
export const site = {
  /** 公開URL。OGP画像は絶対URLでないとSNSに反映されないので必須 */
  url: "https://nomimonodo.vendies.net",

  /** Formspree のエンドポイント */
  formspree: "https://formspree.io/f/xxxxxxxx",

  /** settings に画像が無いときの代替 */
  fallbackOgImage: "/ogp.png",
  fallbackAvatar: "/avatar.png",

  nav: [
    { label: "ABOUT", labelJa: "プロフィール", href: "/about" },
    { label: "EVENT", labelJa: "イベント情報", href: "/event" },
    { label: "CONTACT", labelJa: "お問い合わせ", href: "/contact" },
  ],
};
