import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { getSettings } from "@/lib/microcms";
import { snsLinks } from "@/lib/format";
import { site } from "@/lib/site";

export const revalidate = 60;
export const metadata: Metadata = { title: "プロフィール" };

export default async function AboutPage() {
  const settings = await getSettings();
  const sns = snsLinks(settings);
  const photo = settings.profileImage?.url ?? site.fallbackAvatar;

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
              {settings.artistLabel && <p>{settings.artistLabel}</p>}
              {settings.siteDescription && <p>{settings.siteDescription}</p>}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "0.5px solid var(--rule)", margin: "0 0 26px" }} />

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
              <hr style={{ border: "none", borderTop: "0.5px solid var(--rule)", margin: "0 0 18px" }} />
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
