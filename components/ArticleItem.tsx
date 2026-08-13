import Link from "next/link";
import type { Article } from "@/lib/microcms";
import { articleDate, categoryVars, excerptOf, formatDate } from "@/lib/format";

export function ArticleItem({ article }: { article: Article }) {
  const date = articleDate(article);

  return (
    <li className="article-item" style={categoryVars(article.category)}>
      <Link href={`/miscellany/${article.id}`}>
        <div className="article-meta">
          <time className="article-date" dateTime={date}>
            {formatDate(date)}
          </time>
          {article.category && (
            <span className="category-tag">{article.category.name}</span>
          )}
        </div>
        <h2>{article.title}</h2>
        <p className="article-excerpt">{excerptOf(article)}</p>
      </Link>
    </li>
  );
}
