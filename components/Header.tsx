"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/microcms";
import { swatchOf } from "@/lib/format";
import { site } from "@/lib/site";

export function Header({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // ページを移動したらメニューを閉じる
  useEffect(() => setOpen(false), [pathname]);

  // メニューを開いている間は背面のスクロールを止める
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="site-header">
        <Link href="/" className="site-title">
          {site.name}
        </Link>

        <nav className="global-nav" aria-label="サイト内">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          className="hamburger"
          aria-label="メニューを開く"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {open && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="メニュー">
          <div className="mobile-menu-head">
            <span className="site-title">{site.name}</span>
            <button className="close-menu" aria-label="メニューを閉じる" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <p className="sidebar-label">MENU</p>
          <nav aria-label="サイト内">
            <Link href="/">雑記</Link>
            {site.nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.labelJa}
              </Link>
            ))}
          </nav>

          <hr />

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

          <hr style={{ marginTop: 22 }} />

          <div className="sns-links" style={{ fontSize: 13 }}>
            {site.sns.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
