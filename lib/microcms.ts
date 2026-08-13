import { createClient } from "microcms-js-sdk";
import type { MicroCMSQueries } from "microcms-js-sdk";

/* --------------------------------------------------------------------------
   エンドポイント
   -------------------------------------------------------------------------- */

export const ENDPOINTS = {
  articles: "articles",
  categories: "categories",
  events: "lives",
  settings: "settings",
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
   型（microCMS のフィールドIDに合わせてある）
   -------------------------------------------------------------------------- */

/** categories の color（セレクトフィールド）。microCMS の選択肢と文字列を揃える */
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
  slug: string;
  /** microCMS のセレクトは配列で返る */
  color?: CategoryColorKey[];
};

export type Article = {
  id: string;
  title: string;
  content: string;
  /** 手入力の抜粋。空なら本文から自動生成する */
  excerpt?: string;
  /** 限定公開。true の記事は一覧に出さない（URL直打ちでは読める） */
  limited?: boolean;
  category?: Category;
  publishedAt?: string;
  revisedAt?: string;
  createdAt: string;
};

export type Event = {
  id: string;
  title: string;
  date: string;
  venue?: string;
  openTime?: string;
  startTime?: string;
  ticketUrl?: string;
  note?: string;
  isPublished?: boolean;
};

export type MicroCMSImage = {
  url: string;
  width?: number;
  height?: number;
};

export type Settings = {
  siteName: string;
  siteDescription?: string;
  artistName?: string;
  artistNameEn?: string;
  artistLabel?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  ogImage?: MicroCMSImage;
  profileImage?: MicroCMSImage;
};

type ListResponse<T> = {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
};

const EMPTY_LIST = { contents: [], totalCount: 0, offset: 0, limit: 0 };

/* --------------------------------------------------------------------------
   記事

   limited（限定公開）が true のものは一覧から除く。
   記事URLを直接開けば読めるので、身内向けの記事などに使える。
   -------------------------------------------------------------------------- */

export const ARTICLES_PER_PAGE = 10;

const PUBLIC_FILTER = "limited[not_equals]true";

/** 呼び出し側の filters と限定公開の除外を [and] で連結する */
function withPublicFilter(filters?: string) {
  return filters ? `${filters}[and]${PUBLIC_FILTER}` : PUBLIC_FILTER;
}

export async function getArticles(queries?: MicroCMSQueries) {
  const { filters, ...rest } = queries ?? {};
  try {
    return await client.get<ListResponse<Article>>({
      endpoint: ENDPOINTS.articles,
      queries: {
        limit: ARTICLES_PER_PAGE,
        orders: "-publishedAt",
        filters: withPublicFilter(filters),
        ...rest,
      },
    });
  } catch (e) {
    console.error("記事一覧の取得に失敗しました", e);
    return EMPTY_LIST as ListResponse<Article>;
  }
}

/** 記事詳細。存在しなければ呼び出し側で notFound() させたいのでここでは投げる */
export async function getArticle(id: string, draftKey?: string) {
  return client.getListDetail<Article>({
    endpoint: ENDPOINTS.articles,
    contentId: id,
    queries: draftKey ? { draftKey } : undefined,
  });
}

/** 前後の記事。公開日で挟み撃ちして1件ずつ取る */
export async function getAdjacentArticles(publishedAt: string) {
  try {
    const [newer, older] = await Promise.all([
      client.get<ListResponse<Article>>({
        endpoint: ENDPOINTS.articles,
        queries: {
          limit: 1,
          orders: "publishedAt",
          filters: withPublicFilter(`publishedAt[greater_than]${publishedAt}`),
          fields: "id,title",
        },
      }),
      client.get<ListResponse<Article>>({
        endpoint: ENDPOINTS.articles,
        queries: {
          limit: 1,
          orders: "-publishedAt",
          filters: withPublicFilter(`publishedAt[less_than]${publishedAt}`),
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
        filters: withPublicFilter(`category[equals]${categoryId}`),
        fields: "id,title,publishedAt,category",
      },
    });
    return res.contents.filter((a) => a.id !== excludeId).slice(0, limit);
  } catch (e) {
    console.error("関連記事の取得に失敗しました", e);
    return [];
  }
}

/* --------------------------------------------------------------------------
   カテゴリ

   URL には slug を使う（/category/nichijo）。
   内部IDより読みやすく、あとから表示名を変えても URL が変わらない。
   -------------------------------------------------------------------------- */

export async function getCategories() {
  try {
    const res = await client.get<ListResponse<Category>>({
      endpoint: ENDPOINTS.categories,
      queries: { limit: 30 },
    });
    return res.contents;
  } catch (e) {
    console.error("カテゴリの取得に失敗しました", e);
    return [];
  }
}

export async function getCategoryBySlug(slug: string) {
  const categories = await getCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

/* --------------------------------------------------------------------------
   イベント（lives）

   isPublished が true のものだけ表示する。
   -------------------------------------------------------------------------- */

const PUBLISHED_EVENT = "isPublished[equals]true";

/** 直近の1件（サイドバー用）。予定がなければ null */
export async function getNextEvent() {
  try {
    const res = await client.get<ListResponse<Event>>({
      endpoint: ENDPOINTS.events,
      queries: {
        limit: 1,
        orders: "date",
        filters: `${PUBLISHED_EVENT}[and]date[greater_than]${new Date().toISOString()}`,
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
        queries: {
          limit: 50,
          orders: "date",
          filters: `${PUBLISHED_EVENT}[and]date[greater_than]${now}`,
        },
      }),
      client.get<ListResponse<Event>>({
        endpoint: ENDPOINTS.events,
        queries: {
          limit: 50,
          orders: "-date",
          filters: `${PUBLISHED_EVENT}[and]date[less_than]${now}`,
        },
      }),
    ]);
    return { upcoming: upcoming.contents, past: past.contents };
  } catch (e) {
    console.error("イベント一覧の取得に失敗しました", e);
    return { upcoming: [], past: [] };
  }
}

/* --------------------------------------------------------------------------
   サイト設定

   オブジェクト形式・リスト形式のどちらでも読めるようにしてある。
   取得できなければ FALLBACK_SETTINGS で表示だけは維持する。
   -------------------------------------------------------------------------- */

export const FALLBACK_SETTINGS: Settings = {
  siteName: "飲み物堂",
  artistName: "アサクラ",
  artistNameEn: "ASAKURA",
};

export async function getSettings(): Promise<Settings> {
  try {
    return await client.getObject<Settings>({ endpoint: ENDPOINTS.settings });
  } catch {
    try {
      const res = await client.get<ListResponse<Settings>>({
        endpoint: ENDPOINTS.settings,
        queries: { limit: 1 },
      });
      if (res.contents[0]) return res.contents[0];
    } catch (e) {
      console.error("サイト設定の取得に失敗しました", e);
    }
    return FALLBACK_SETTINGS;
  }
}
