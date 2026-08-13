"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/microcms";
import { ArticleItem } from "./ArticleItem";

/** 自動で読み込む回数。これを超えたらボタンに切り替える。
 *  そうしないとスクロールしても下部のプロフィールに永久に到達できない。 */
const AUTO_LOAD_LIMIT = 2;

type Props = {
  initialArticles: Article[];
  totalCount: number;
  /** カテゴリ絞り込み時の microCMS 内部ID */
  categoryId?: string;
};

export function ArticleList({ initialArticles, totalCount, categoryId }: Props) {
  const [articles, setArticles] = useState(initialArticles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [autoLoads, setAutoLoads] = useState(0);

  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = articles.length < totalCount;
  const autoMode = autoLoads < AUTO_LOAD_LIMIT;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({ offset: String(articles.length) });
      if (categoryId) params.set("category", categoryId);

      const res = await fetch(`/api/articles?${params}`);
      if (!res.ok) throw new Error("読み込みに失敗しました");

      const data: { contents: Article[] } = await res.json();
      setArticles((prev) => [...prev, ...data.contents]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [articles.length, categoryId, hasMore, loading]);

  // 自動読み込み。末尾の目印が見えたら次を取りに行く
  useEffect(() => {
    if (!autoMode || !hasMore || !sentinel.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setAutoLoads((n) => n + 1);
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [autoMode, hasMore, loadMore, loading]);

  return (
    <>
      <ul className="article-list">
        {articles.map((a) => (
          <ArticleItem key={a.id} article={a} />
        ))}
      </ul>

      {/* 読み込み状況は視覚だけでなく読み上げにも伝える */}
      <div aria-live="polite">
        {loading && <p className="list-status">読み込み中</p>}

        {error && (
          <p className="list-status">
            読み込めませんでした。
            <button className="text-link" onClick={loadMore} style={{ marginLeft: 8 }}>
              もう一度試す
            </button>
          </p>
        )}
      </div>

      {hasMore && !autoMode && !loading && !error && (
        <button className="load-more" onClick={loadMore}>
          もっと読む
        </button>
      )}

      {hasMore && autoMode && <div ref={sentinel} aria-hidden="true" />}
    </>
  );
}
