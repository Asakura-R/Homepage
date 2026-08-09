import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "プロフィール" };

const history = [
  { year: "2020", event: "出来事がここに入ります" },
  { year: "2023", event: "出来事がここに入ります" },
  { year: "2026", event: "出来事がここに入ります" },
];

export default function AboutPage() {
  return (
    <div className="body-grid">
      {/* 本文にプロフィールが出るので、サイドバー側は省く */}
      <Sidebar showProfile={false} />

      <main className="main">
        <div className="section-head">
          <h1>プロフィール</h1>
        </div>

        <div className="page-body">
          <div className="profile">
            <Image
              src={site.avatar}
              alt=""
              width={170}
              height={210}
              className="profile-photo"
            />
            <div>
              <h1>{site.author}</h1>
              <p className="profile-en">{site.authorEn}</p>
              <p>
                プロフィール本文がここに入ります。芸人としての活動と、文章を書くことについて。
              </p>
              <p>サイト名の由来などもここで触れられます。</p>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "0.5px solid var(--rule)", margin: "0 0 26px" }} />

          <h2>経歴</h2>
          <dl className="history">
            {history.map((h) => (
              <div className="history-row" key={h.year}>
                <dt>{h.year}</dt>
                <dd>{h.event}</dd>
              </div>
            ))}
          </dl>

          <h2>お仕事のご依頼</h2>
          <p style={{ margin: "0 0 26px", fontSize: 15.5, lineHeight: 2 }}>
            執筆・出演のご依頼は
            <Link href="/contact" className="text-link" style={{ fontSize: "inherit" }}>
              お問い合わせフォーム
            </Link>
            からお願いします。
          </p>

          <hr style={{ border: "none", borderTop: "0.5px solid var(--rule)", margin: "0 0 18px" }} />

          <div className="sns-links" style={{ fontSize: 13 }}>
            {site.sns.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
