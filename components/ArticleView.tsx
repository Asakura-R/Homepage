import Link from "next/link";
import { ArticleBody } from "@/components/ArticleBody";
import { Sidebar } from "@/components/Sidebar";
import { getAdjacentArticles, getRelatedArticles } from "@/lib/microcms";
import type { Article } from "@/lib/microcms";
import { articleDate, categoryVars, formatDate } from "@/lib/format";

/**
 * 記事1本分の見た目。
 * 公開ページ（/miscellany/[id]）と下書きプレビュー（/preview）の両方で使う。
 *
 * preview が true のとき
 * - 上部に「下書きプレビュー」の帯を出す（previewNote で帯の文言を変えられる）
 * - 分岐の書き間違いを表示する
 */
export async function ArticleView({
  article,
  preview = false,
  previewNote = "この画面は本人確認用です。読者には公開されていません。",
}: {
  article: Article;
  preview?: boolean;
  previewNote?: string;
}) {
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
        {preview && (
          <div className="preview-banner" role="status">
            <span className="preview-banner-label">下書きプレビュー</span>
            <span>{previewNote}</span>
          </div>
        )}

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

          <ArticleBody article={article} showIssues={preview} />

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
