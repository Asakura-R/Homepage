import Link from "next/link";
import Image from "next/image";
import { getCategories, getNextEvent } from "@/lib/microcms";
import { formatEventDate, swatchOf } from "@/lib/format";
import { site } from "@/lib/site";

/**
 * ABOUT ページではプロフィール欄が本文と重複するので
 * showProfile={false} で落とせるようにしてある。
 */
export async function Sidebar({ showProfile = true }: { showProfile?: boolean }) {
  const [categories, nextEvent] = await Promise.all([getCategories(), getNextEvent()]);

  return (
    <aside className="sidebar">
      {showProfile && (
        <div className="sidebar-block sidebar-profile">
          <Image
            src={site.avatar}
            alt=""
            width={76}
            height={76}
            className="avatar"
          />
          <div>
            <p className="sidebar-name">{site.author}</p>
            <p className="sidebar-name-en">{site.authorEn}</p>
            <p className="sidebar-bio">{site.bio}</p>
            <Link href="/about" className="text-link">
              プロフィール
            </Link>
          </div>
        </div>
      )}

      <div className="sidebar-block">
        <p className="sidebar-label">CATEGORY</p>
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.id}`}>
                <span
                  className="category-swatch"
                  style={{ ["--category" as string]: swatchOf(c).base }}
                  aria-hidden="true"
                />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* 予定がないときは枠ごと出さない */}
      {nextEvent && (
        <div className="sidebar-block">
          <p className="sidebar-label">EVENT</p>
          <p className="event-date">{formatEventDate(nextEvent.date).full}</p>
          <p className="event-title">{nextEvent.title}</p>
          {nextEvent.venue && <p className="event-venue">{nextEvent.venue}</p>}
        </div>
      )}

      <div className="sidebar-block">
        <div className="sns-links">
          {site.sns.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
