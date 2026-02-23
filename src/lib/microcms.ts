import { createClient } from 'microcms-js-sdk';

// microCMSクライアント
export const client = createClient({
  serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: import.meta.env.MICROCMS_API_KEY,
});

// 型定義
export type Profile = {
  catchphrase: string;
  introduction: string;
  biography: {
    year: string;
    content: string;
  }[];
};

export type Live = {
  id: string;
  title: string;
  date: string;
  venue: string;
  openTime?: string;
  startTime?: string;
  ticketUrl?: string;
  note?: string;
  isPublished: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  color: 'teal' | 'pink' | 'violet';
};

export type Article = {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  category?: Category;
  publishedAt: string;
  limited?: boolean;
};

export type Settings = {
  siteName: string;
  siteDescription?: string;
  artistName: string;
  artistNameEn: string;
  artistLabel: string;
  twitterUrl?: string;
  instagramUrl?: string;
  ogImage?: { url: string };
  profileImage?: { url: string };
};

// API取得関数
export async function getSettings(): Promise<Settings> {
  return await client.get({ endpoint: 'settings' });
}

export async function getProfile(): Promise<Profile> {
  return await client.get({ endpoint: 'profile' });
}

export async function getLives() {
  const today = new Date().toISOString().split('T')[0];
  
  const [upcoming, past] = await Promise.all([
    client.get<{ contents: Live[] }>({
      endpoint: 'lives',
      queries: {
        filters: `date[greater_than]${today}[and]isPublished[equals]true`,
        orders: 'date',
      },
    }),
    client.get<{ contents: Live[] }>({
      endpoint: 'lives',
      queries: {
        filters: `date[less_than]${today}[and]isPublished[equals]true`,
        orders: '-date',
      },
    }),
  ]);
  
  return { upcoming: upcoming.contents, past: past.contents };
}

export async function getNextLive(): Promise<Live | null> {
  const today = new Date().toISOString().split('T')[0];
  const result = await client.get<{ contents: Live[] }>({
    endpoint: 'lives',
    queries: {
      filters: `date[greater_than]${today}[and]isPublished[equals]true`,
      orders: 'date',
      limit: 1,
    },
  });
  return result.contents[0] || null;
}

export async function getArticles(options?: { limit?: number; offset?: number; categoryId?: string }) {
  const queries: Record<string, unknown> = {
    limit: options?.limit || 10,
    offset: options?.offset || 0,
  };
  
  // 限定公開記事を除外
  let filters = 'limited[not_equals]true';
  
  if (options?.categoryId) {
    filters = `category[equals]${options.categoryId}[and]limited[not_equals]true`;
  }
  
  queries.filters = filters;
  
  return await client.get<{ contents: Article[]; totalCount: number }>({
    endpoint: 'articles',
    queries,
  });
}

export async function getArticle(id: string): Promise<Article> {
  return await client.get({
    endpoint: 'articles',
    contentId: id,
  });
}

// 全記事取得（限定公開含む、静的パス生成用）
export async function getAllArticles(): Promise<Article[]> {
  const result = await client.get<{ contents: Article[] }>({
    endpoint: 'articles',
    queries: { limit: 100 },
  });
  return result.contents;
}

export async function getLatestArticles(limit = 3): Promise<Article[]> {
  const result = await client.get<{ contents: Article[] }>({
    endpoint: 'articles',
    queries: { 
      limit,
      filters: 'limited[not_equals]true',
    },
  });
  return result.contents;
}

export async function getCategories(): Promise<Category[]> {
  const result = await client.get<{ contents: Category[] }>({
    endpoint: 'categories',
  });
  return result.contents;
}

// 日付フォーマット
export function formatDate(dateString: string, format: 'full' | 'short' = 'full'): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (format === 'short') {
    return `${month}.${day}`;
  }
  return `${year}.${month}.${day}`;
}

// 曜日取得
export function getDayOfWeek(dateString: string): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const date = new Date(dateString);
  return days[date.getDay()];
}
