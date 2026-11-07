import type { Metadata } from "next";
import Link from "next/link";
import { ArticleView } from "@/components/ArticleView";
import { Sidebar } from "@/components/Sidebar";
import { getArticle } from "@/lib/microcms";

/**
 * 下書きプレビュー。
 *
 * microCMS の「画面プレビュー」に次の URL を登録する。
 *   https://サイトURL/preview?contentId={CONTENT_ID}&draftKey={DRAFT_KEY}
 *
 * - 毎回その場で組み立て、キャッシュしない（Vercel でも ?draftKey が確実に届く）
 * - draftKey がないと下書きは取得できないので、URLを知らない人には中身は見えない
 * - 検索エンジンには載せない
 */

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ contentId?: string; draftKey?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { contentId, draftKey } = await searchParams;
  const noindex = { robots: { index: false, follow: false } } as const;

  if (!contentId || !draftKey) return { title: "プレビュー", ...noindex };

  try {
    const article = await getArticle(contentId, draftKey);
    return { title: `【プレビュー】${article.title}`, ...noindex };
  } catch {
    return { title: "プレビュー", ...noindex };
  }
}

export default async function PreviewPage({ searchParams }: Props) {
  const { contentId, draftKey } = await searchParams;

  if (!contentId || !draftKey) {
    return (
      <PreviewMessage>
        プレビューのURLに記事IDか下書きキーが含まれていません。microCMS の「画面プレビュー」ボタンから開いてください。
      </PreviewMessage>
    );
  }

  const article = await getArticle(contentId, draftKey).catch(() => null);

  if (!article) {
    return (
      <PreviewMessage>
        下書きを取得できませんでした。下書きキーの有効期限が切れているか、記事が削除された可能性があります。microCMS で記事を開き直し、もう一度「画面プレビュー」を押してください。
      </PreviewMessage>
    );
  }

  return <ArticleView article={article} preview />;
}

function PreviewMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="body-grid">
      <Sidebar />
      <main className="main">
        <div className="section-head">
          <h1>下書きプレビュー</h1>
        </div>
        <div className="page-body">
          <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 2 }}>{children}</p>
          <Link href="/" className="text-link">
            トップへ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
