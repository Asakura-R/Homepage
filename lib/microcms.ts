import { createClient } from "microcms-js-sdk";
import type { MicroCMSQueries } from "microcms-js-sdk";

/* --------------------------------------------------------------------------
   エンドポイント
   microCMS 管理画面の「API設定 → 基本情報 → エンドポイント」の値。
   変更があればここだけ直せばよい。
   -------------------------------------------------------------------------- */

export const ENDPOINTS = {
  articles: "articles",
  categories: "categories",
  events: "lives",
} as const;

/* --------------------------------------------------------------------------
   クライアント
   -------------------------------------------------------------------------- */

if (!process.env.MICROCMS_SERVICE_DOMAIN) {
  throw new Error("MICROCMS_SERVICE_DOMAIN が設定されていません");
}
if (!process.env.MICROCMS_API_KEY) {
  throw new Error("MICROCMS_API_KEY が設定されていません");
}

export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
});

/* --------------------------------------------------------------------------
   型
   -------------------------------------------------------------------------- */

/** カテゴリ色。値は microCMS のセレクトフィールドの選択肢と一致させる */
export type CategoryColorKey =
  | "green"
  | "olive"
  | "amber"
  | "orange"
  | "red"
  | "magenta"
  | "blue";

export type Category = {
  id: string;
  name: string;
  /** microCMS のセレクトは配列で返る */
  color?: CategoryColorKey[];
};

export type Article = {
  id: string;
  title: string;
  body: string;
  category?: Category;
  publishedAt?: string;
  revisedAt?: string;
  createdAt: string;
};

export type Event = {
  id: string;
  title: string;
  /** ISO 8601 */
  date: string;
  venue?: string;
  detail?: string;
  reserveUrl?: string;
};

type ListResponse<T> = {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
};

/* --------------------------------------------------------------------------
   取得関数

   一覧系はすべて try で囲んである。
   エンドポイントが未作成だったり中身が0件でも、
   ビルド全体が落ちずにその部分だけ空で表示される。
   -------------------------------------------------------------------------- */

export const ARTICLES_PER_PAGE = 10;

const EMPTY_LIST = { contents: [], totalCount: 0, offset: 0, limit: 0 };

export async function getArticles(queries?: MicroCMSQueries) {
  try {
    return await client.get<ListResponse<Article>>({
      endpoint: ENDPOINTS.articles,
      queries: { limit: ARTICLES_PER_PAGE, orders: "-publishedAt", ...queries },
    });
  } catch (e) {
    console.error("記事一覧の取得に失敗しました", e);
    return EMPTY_LIST as ListResponse<Article>;
  }
}

/** 記事詳細。存在しなければ呼び出し側で notFound() させたいので、ここでは投げる */
export async function getArticle(id: string, draftKey?: string) {
  return client.getListDetail<Article>({
    endpoint: ENDPOINTS.articles,
    contentId: id,
    queries: draftKey ? { draftKey } : undefined,
  });
}

export async function getCategories() {
  try {
    const res = await client.get<ListResponse<Category>>({
      endpoint: ENDPOINTS.categories,
      queries: { limit: 20 },
    });
    return res.contents;
  } catch (e) {
    console.error("カテゴリの取得に失敗しました", e);
    return [];
  }
}

/**
 * 前後の記事。公開日で挟み撃ちして1件ずつ取る。
 * 一覧を全件持ってくるより負荷が軽い。
 */
export async function getAdjacentArticles(publishedAt: string) {
  try {
    const [newer, older] = await Promise.all([
      client.get<ListResponse<Article>>({
        endpoint: ENDPOINTS.articles,
        queries: {
          limit: 1,
          orders: "publishedAt",
          filters: `publishedAt[greater_than]${publishedAt}`,
          fields: "id,title",
        },
      }),
      client.get<ListResponse<Article>>({
        endpoint: ENDPOINTS.articles,
        queries: {
          limit: 1,
          orders: "-publishedAt",
          filters: `publishedAt[less_than]${publishedAt}`,
          fields: "id,title",
        },
      }),
    ]);
    return { prev: older.contents[0] ?? null, next: newer.contents[0] ?? null };
  } catch (e) {
    console.error("前後記事の取得に失敗しました", e);
    return { prev: null, next: null };
  }
}

/** 同じカテゴリの新しい記事を、自分自身を除いて取得 */
export async function getRelatedArticles(
  categoryId: string,
  excludeId: string,
  limit = 3
) {
  try {
    const res = await client.get<ListResponse<Article>>({
      endpoint: ENDPOINTS.articles,
      queries: {
        limit: limit + 1,
        orders: "-publishedAt",
        filters: `category[equals]${categoryId}`,
        fields: "id,title,publishedAt,category",
      },
    });
    return res.contents.filter((a) => a.id !== excludeId).slice(0, limit);
  } catch (e) {
    console.error("関連記事の取得に失敗しました", e);
    return [];
  }
}

/** 直近の1件（サイドバー用）。予定がなければ null。失敗時も null で欄ごと消える */
export async function getNextEvent() {
  try {
    const res = await client.get<ListResponse<Event>>({
      endpoint: ENDPOINTS.events,
      queries: {
        limit: 1,
        orders: "date",
        filters: `date[greater_than]${new Date().toISOString()}`,
      },
    });
    return res.contents[0] ?? null;
  } catch (e) {
    console.error("イベントの取得に失敗しました", e);
    return null;
  }
}

export async function getEvents() {
  const now = new Date().toISOString();
  try {
    const [upcoming, past] = await Promise.all([
      client.get<ListResponse<Event>>({
        endpoint: ENDPOINTS.events,
        queries: { limit: 50, orders: "date", filters: `date[greater_than]${now}` },
      }),
      client.get<ListResponse<Event>>({
        endpoint: ENDPOINTS.events,
        queries: { limit: 50, orders: "-date", filters: `date[less_than]${now}` },
      }),
    ]);
    return { upcoming: upcoming.contents, past: past.contents };
  } catch (e) {
    console.error("イベント一覧の取得に失敗しました", e);
    return { upcoming: [], past: [] };
  }
}
