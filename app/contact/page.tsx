import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { getSettings } from "@/lib/microcms";
import { snsLinks } from "@/lib/format";
import { site } from "@/lib/site";

export const revalidate = 60;
export const metadata: Metadata = { title: "お問い合わせ" };

export default async function ContactPage() {
  const settings = await getSettings();
  const sns = snsLinks(settings);

  return (
    <div className="body-grid">
      <Sidebar />

      <main className="main">
        <div className="section-head">
          <h1>お問い合わせ</h1>
        </div>

        <div className="page-body">
          <p style={{ margin: "0 0 26px", fontSize: 15, lineHeight: 2 }}>
            執筆・出演のご依頼、記事へのご感想などはこちらからお送りください。数日以内にご返信します。
          </p>

          <form className="form" action={site.formspree} method="POST">
            <div className="form-row">
              <label htmlFor="name">
                お名前<span className="required">必須</span>
              </label>
              <input type="text" id="name" name="name" required autoComplete="name" />
            </div>

            <div className="form-row">
              <label htmlFor="email">
                メールアドレス<span className="required">必須</span>
              </label>
              <input type="email" id="email" name="email" required autoComplete="email" />
            </div>

            <div className="form-row">
              <label htmlFor="subject">ご用件</label>
              <select id="subject" name="subject" defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                <option value="執筆のご依頼">執筆のご依頼</option>
                <option value="出演のご依頼">出演のご依頼</option>
                <option value="記事の感想">記事の感想</option>
                <option value="その他">その他</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="message">
                本文<span className="required">必須</span>
              </label>
              <textarea id="message" name="message" required />
            </div>

            <button type="submit" className="submit">
              送信する
            </button>
          </form>

          {sns.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "0.5px solid var(--rule)", margin: "30px 0 18px" }} />
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>SNSのDMでも受け付けています。</p>
              <div className="sns-links" style={{ fontSize: 13 }}>
                {sns.map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
