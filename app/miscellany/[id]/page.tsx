import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { getArticle, getArticles } from "@/lib/microcms";
import { descriptionOf } from "@/lib/format";

/**
 * 公開記事のページ。
 *
 * 事前に生成して60秒ごとに更新する（ISR）。
 * 下書きはここでは扱わない。下書きは /preview で確認する。
 * ここで URL の ?draftKey を読むと、Vercel のキャッシュと噛み合わず
 * 下書きが表示されなかったり、空のページが保存されたりするため。
 */

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

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

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;

  const article = await getArticle(id).catch(() => null);
  if (!article) notFound();

  return <ArticleView article={article} />;
}
