import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import {
  getAdjacentArticles,
  getArticle,
  getArticles,
  getRelatedArticles,
} from "@/lib/microcms";
import {
  articleDate,
  categoryVars,
  descriptionOf,
  enhanceBody,
  formatDate,
} from "@/lib/format";

export const revalidate = 60;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draftKey?: string }>;
};

/** 公開済みの記事は事前に静的生成しておく */
export async function generateStaticParams() {
  const { contents } = await getArticles({ limit: 100, fields: "id" });
  return contents.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const article = await getArticle(id);
    const description = descriptionOf(article);
    return {
      title: article.title,
      description,
      openGraph: { title: article.title, description, type: "article" },
      // 限定公開の記事は検索避け
      robots: article.limited ? { index: false, follow: false } : undefined,
    };
  } catch {
    return { title: "記事が見つかりません" };
  }
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { draftKey } = await searchParams;

  const article = await getArticle(id, draftKey).catch(() => null);
  if (!article) notFound();

  const date = articleDate(article);

  const [adjacent, related] = await Promise.all([
    getAdjacentArticles(date),
    article.category
      ? getRelatedArticles(article.category.id, article.id)
      : Promise.resolve([]),
  ]);

  const vars = categoryVars(article.category);

  return (
    <div className="body-grid">
      <Sidebar />

      <main className="main">
        <article className="article" style={vars}>
          <header className="article-header">
            <div className="article-meta">
              <time className="article-date" dateTime={date}>
                {formatDate(date)}
              </time>
              {article.category && (
                <span className="category-tag">{article.category.name}</span>
              )}
            </div>
            <h1 className="article-title">{article.title}</h1>
            <div className="article-rule" aria-hidden="true" />
          </header>

          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: enhanceBody(article.content) }}
          />

          <nav className="adjacent-nav" aria-label="前後の記事">
            <div className="prev">
              {adjacent.prev && (
                <Link href={`/miscellany/${adjacent.prev.id}`}>
                  <p className="adjacent-label">PREV</p>
                  <p className="adjacent-title">{adjacent.prev.title}</p>
                </Link>
              )}
            </div>
            <div className="next">
              {adjacent.next && (
                <Link href={`/miscellany/${adjacent.next.id}`}>
                  <p className="adjacent-label">NEXT</p>
                  <p className="adjacent-title">{adjacent.next.title}</p>
                </Link>
              )}
            </div>
          </nav>
        </article>

        {/* 同じカテゴリの記事が無ければセクションごと出さない */}
        {related.length > 0 && article.category && (
          <section className="related" style={vars}>
            <div className="related-head">
              <h2>同じカテゴリの記事</h2>
              <span className="category-tag">{article.category.name}</span>
            </div>

            {related.map((a) => (
              <Link key={a.id} href={`/miscellany/${a.id}`}>
                <div className="related-item">
                  <p>{formatDate(articleDate(a))}</p>
                  <h3>{a.title}</h3>
                </div>
              </Link>
            ))}

            <p style={{ marginTop: 16 }}>
              <Link href={`/category/${article.category.slug}`} className="text-link">
                {article.category.name}の記事をすべて見る
              </Link>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
