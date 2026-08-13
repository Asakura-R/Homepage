import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { getProfile, getSettings } from "@/lib/microcms";
import { enhanceBody, normalizeBiography, snsLinks } from "@/lib/format";
import { site } from "@/lib/site";

export const revalidate = 60;
export const metadata: Metadata = { title: "プロフィール" };

export default async function AboutPage() {
  const [settings, profile] = await Promise.all([getSettings(), getProfile()]);

  const sns = snsLinks(settings);
  const photo = settings.profileImage?.url ?? site.fallbackAvatar;
  const history = normalizeBiography(profile?.biograpy);

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
              src={photo}
              alt=""
              width={170}
              height={210}
              className="profile-photo"
            />
            <div>
              <p className="profile-name">{settings.artistName}</p>
              {settings.artistNameEn && (
                <p className="profile-en">{settings.artistNameEn}</p>
              )}
              {settings.artistLabel && (
                <p className="profile-label">{settings.artistLabel}</p>
              )}
              {profile?.catchphrase && (
                <p className="profile-catch">{profile.catchphrase}</p>
              )}
            </div>
          </div>

          {profile?.introduction && (
            <div
              className="prose profile-intro"
              dangerouslySetInnerHTML={{ __html: enhanceBody(profile.introduction) }}
            />
          )}

          {history.length > 0 && (
            <>
              <hr className="page-rule" />
              <h2>経歴</h2>
              <dl className="history">
                {history.map((h, i) => (
                  <div className="history-row" key={i}>
                    <dt>{h.year}</dt>
                    <dd>{h.body}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          <hr className="page-rule" />

          <h2>お仕事のご依頼</h2>
          <p style={{ margin: "0 0 26px", fontSize: 15.5, lineHeight: 2 }}>
            執筆・出演のご依頼は
            <Link href="/contact" className="text-link" style={{ fontSize: "inherit" }}>
              お問い合わせフォーム
            </Link>
            からお願いします。
          </p>

          {sns.length > 0 && (
            <>
              <hr className="page-rule" />
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
