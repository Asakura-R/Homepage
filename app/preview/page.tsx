import type { Metadata } from "next";
import Link from "next/link";
import { ArticleView } from "@/components/ArticleView";
import { Sidebar } from "@/components/Sidebar";
import { getArticle } from "@/lib/microcms";
import { site } from "@/lib/site";

/**
 * 下書きプレビュー。
 *
 * microCMS の「画面プレビュー」に次の URL を登録する。
 *   https://サイトURL/preview?contentId={CONTENT_ID}&draftKey={DRAFT_KEY}
 *
 * - 毎回その場で組み立て、キャッシュしない（Vercel でも URL の値が確実に届く）
 * - 下書きキーが空のとき（公開中で下書きの変更がない記事など）は、公開中の内容を表示する
 * - 記事IDが届かないときは、実際に届いた値を画面に出して、設定の直し方を示す
 * - 検索エンジンには載せない
 */

export const dynamic = "force-dynamic";

type RawParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<RawParams> };

const PREVIEW_URL = `${site.url}/preview?contentId={CONTENT_ID}&draftKey={DRAFT_KEY}`;

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** 書き方の揺れも受け付ける（contentId / id、draftKey / draft_key、全角の＆や＝） */
function readParams(sp: RawParams) {
  let contentId = first(sp.contentId) || first(sp.id);
  let draftKey = first(sp.draftKey) || first(sp.draft_key);

  // 「＆」を全角で書いてしまうと、記事IDの後ろに下書きキーがくっついて届く
  const glued = contentId.match(/^(.*?)[＆&]draft_?key[=＝](.*)$/i);
  if (glued) {
    contentId = glued[1].trim();
    draftKey = draftKey || glued[2].trim();
  }
  return { contentId, draftKey };
}

/** 置き換えられずに残ったプレースホルダ（{CONTENT_ID} など） */
function isPlaceholder(v: string) {
  return /^\{.*\}$/.test(v);
}

async function load(contentId: string, draftKey: string) {
  if (!contentId || isPlaceholder(contentId)) return null;
  const key = draftKey && !isPlaceholder(draftKey) ? draftKey : undefined;
  return getArticle(contentId, key).catch(() => null);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { contentId, draftKey } = readParams(await searchParams);
  const noindex = { robots: { index: false, follow: false } } as const;
  const article = await load(contentId, draftKey);
  return { title: article ? `【プレビュー】${article.title}` : "プレビュー", ...noindex };
}

export default async function PreviewPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { contentId, draftKey } = readParams(sp);
  const hasDraftKey = Boolean(draftKey) && !isPlaceholder(draftKey);

  // 記事IDが届いていない・置き換えられていない → 設定の問題
  if (!contentId || isPlaceholder(contentId)) {
    return (
      <PreviewMessage>
        <p>記事IDがプレビューページに届いていません。microCMS の画面プレビューのURL設定を確認してください。</p>
        <ReceivedParams sp={sp} />
        <SettingHint />
      </PreviewMessage>
    );
  }

  const article = await load(contentId, draftKey);

  if (!article) {
    return (
      <PreviewMessage>
        {hasDraftKey ? (
          <p>
            下書きを取得できませんでした。下書きキーの有効期限が切れているか、記事が削除された可能性があります。microCMS で記事を開き直し、もう一度「画面プレビュー」を押してください。
          </p>
        ) : (
          <p>
            この記事はまだ一度も保存されていないか、公開されていないため表示できません。microCMS で一度「下書き保存」してから、もう一度「画面プレビュー」を押してください。
          </p>
        )}
        <ReceivedParams sp={sp} />
      </PreviewMessage>
    );
  }

  return (
    <ArticleView
      article={article}
      preview
      previewNote={
        hasDraftKey
          ? "この画面は本人確認用です。読者には公開されていません。"
          : "下書きの変更がないため、公開中の内容を表示しています。"
      }
    />
  );
}

/* --------------------------------------------------------------------------
   案内表示
   -------------------------------------------------------------------------- */

function PreviewMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="body-grid">
      <Sidebar />
      <main className="main">
        <div className="section-head">
          <h1>下書きプレビュー</h1>
        </div>
        <div className="page-body preview-help">
          {children}
          <p>
            <Link href="/" className="text-link">
              トップへ戻る
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

/** 実際に届いた値。下書きキーは途中を伏せる */
function ReceivedParams({ sp }: { sp: RawParams }) {
  const entries = Object.entries(sp);
  const mask = (k: string, v: string) =>
    /draft/i.test(k) && v.length > 6 ? `${v.slice(0, 3)}…${v.slice(-3)}` : v;

  return (
    <div className="preview-received">
      <p className="preview-received-label">このページに届いた値</p>
      {entries.length === 0 ? (
        <p>なし（URLの「?」以降が空です）</p>
      ) : (
        <dl>
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{mask(k, first(v)) || "（空）"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function SettingHint() {
  return (
    <>
      <p>articles の「API設定 → 画面プレビュー」に、次のURLをそのまま貼り付けてください。</p>
      <pre className="preview-url">{PREVIEW_URL}</pre>
      <p>
        「&」と「?」は半角、<code>{"{CONTENT_ID}"}</code> と <code>{"{DRAFT_KEY}"}</code>{" "}
        は大文字のまま書きます。
      </p>
    </>
  );
}
