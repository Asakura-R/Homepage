import type { Article, BiographyItem, Category, CategoryColorKey, Event, Settings } from "./microcms";

/* --------------------------------------------------------------------------
   カテゴリ色
   色相環をおよそ等分し、暖色寄りに配分した7色。
   ティール（#04756B）は機能色なのでここには入れない。
   -------------------------------------------------------------------------- */

type Swatch = {
  /** 罫線・スウォッチ用 */
  base: string;
  /** 文字に使うとき。地に対して明るい2色だけ暗く落とす */
  text: string;
};

const PALETTE: Record<CategoryColorKey, Swatch> = {
  green:   { base: "#2C6A1E", text: "#2C6A1E" },
  olive:   { base: "#6E6008", text: "#5A4E06" },
  amber:   { base: "#96650A", text: "#7A5308" },
  orange:  { base: "#A34A0C", text: "#A34A0C" },
  red:     { base: "#A82420", text: "#A82420" },
  magenta: { base: "#912A62", text: "#912A62" },
  blue:    { base: "#2A4C96", text: "#2A4C96" },
};

const FALLBACK: Swatch = { base: "#85878A", text: "#55595F" };

export function swatchOf(category?: Category): Swatch {
  const key = category?.color?.[0];
  return (key && PALETTE[key]) || FALLBACK;
}

/**
 * CSS 変数として渡す。要素に付けるだけで
 * border-left やタグの色が切り替わる。
 */
export function categoryVars(category?: Category): React.CSSProperties {
  const s = swatchOf(category);
  return {
    ["--category" as string]: s.base,
    ["--category-text" as string]: s.text,
  };
}

/* --------------------------------------------------------------------------
   日付
   -------------------------------------------------------------------------- */

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function formatEventDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${p(d.getMonth() + 1)}.${p(d.getDate())}`,
    year: `${d.getFullYear()} ${WEEK[d.getDay()]}`,
    full: `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`,
  };
}

/** 会場・開場・開演を1行にまとめる。空の項目は自然に飛ばす */
export function eventDetailLine(event: Event) {
  const times = [
    event.openTime && `開場 ${event.openTime}`,
    event.startTime && `開演 ${event.startTime}`,
  ].filter(Boolean).join("　");

  return [event.venue, times].filter(Boolean).join("／");
}

/** 記事の日付。custom の publishedAt が空なら作成日で代用する */
export function articleDate(article: Pick<Article, "publishedAt" | "createdAt">) {
  return article.publishedAt || article.createdAt;
}

/* --------------------------------------------------------------------------
   本文HTMLの整形
   microCMS のリッチエディタ出力に、CSS だけでは当てられない構造を足す。
   -------------------------------------------------------------------------- */

export function enhanceBody(html?: string) {
  if (!html) return "";
  return (
    html
      // 表は横スクロールできるように包む
      .replace(/<table/g, '<div class="table-scroll"><table')
      .replace(/<\/table>/g, "</table></div>")
      // リンクだけで構成された段落は、まとまった一群として扱う
      .replace(/<p>((?:\s*<a\b[^>]*>.*?<\/a>\s*)+)<\/p>/g, '<p class="link-row">$1</p>')
      // 外部リンクは新しいタブで開く
      .replace(/<a href="(https?:\/\/)/g, '<a target="_blank" rel="noopener noreferrer" href="$1')
  );
}

/** HTML からタグを落として素のテキストにする */
function toPlainText(html?: string) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 一覧に出す抜粋。
 * microCMS で excerpt を書いていればそれを使い、
 * 空なら本文の冒頭から切り出す。
 */
export function excerptOf(article: Pick<Article, "excerpt" | "content">, length = 120) {
  const manual = article.excerpt?.trim();
  if (manual) return manual;

  const text = toPlainText(article.content);
  return text.length > length ? text.slice(0, length) + "…" : text;
}

/** OGP の description 用。改行を潰して短く */
export function descriptionOf(article: Pick<Article, "excerpt" | "content">, length = 100) {
  return excerptOf(article, length).replace(/\n/g, " ");
}

/* --------------------------------------------------------------------------
   サイト設定から取り出すヘルパー
   -------------------------------------------------------------------------- */

export function snsLinks(settings: Settings) {
  return [
    settings.twitterUrl && { label: "X", href: settings.twitterUrl },
    settings.instagramUrl && { label: "Instagram", href: settings.instagramUrl },
  ].filter(Boolean) as { label: string; href: string }[];
}

/* --------------------------------------------------------------------------
   経歴（biograpy の繰り返しフィールド）

   中のカスタムフィールドのIDが環境によって違うので、
   「年」らしきものと「内容」らしきものを名前で拾う。
   どちらも見つからなければ、最初に現れた文字列を順に使う。
   -------------------------------------------------------------------------- */

const YEAR_KEYS = ["year", "date", "period", "when"];
const BODY_KEYS = ["event", "title", "text", "content", "description", "detail", "body"];

function pick(item: BiographyItem, keys: string[]) {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** 想定外のフィールドIDだったとき用に、文字列の値を順に拾う */
function stringValues(item: BiographyItem) {
  return Object.entries(item)
    .filter(([k, v]) => k !== "fieldId" && typeof v === "string" && v.trim())
    .map(([, v]) => (v as string).trim());
}

export function normalizeBiography(items?: BiographyItem[]) {
  if (!items?.length) return [];

  return items.map((item) => {
    let year = pick(item, YEAR_KEYS);
    let body = pick(item, BODY_KEYS);

    if (!year && !body) {
      const [first, second] = stringValues(item);
      year = first ?? "";
      body = second ?? "";
    } else if (!body) {
      body = stringValues(item).find((v) => v !== year) ?? "";
    }

    // 日時型で入っている場合は年だけ取り出す
    if (/^\d{4}-\d{2}-\d{2}/.test(year)) year = year.slice(0, 4);

    return { year, body };
  }).filter((r) => r.year || r.body);
}
