import type { Category, CategoryColorKey } from "./microcms";

/* --------------------------------------------------------------------------
   カテゴリ色
   色相環をおよそ等分し、暖色寄りに配分した7色。
   ティール（#04756B）は機能色なのでここには入れない。
   -------------------------------------------------------------------------- */

type Swatch = {
  /** 罫線・スウォッチ用 */
  base: string;
  /** 文字に使うとき。地に対して薄い2色だけ暗く落とす */
  text: string;
  label: string;
};

const PALETTE: Record<CategoryColorKey, Swatch> = {
  green:   { base: "#2C6A1E", text: "#2C6A1E", label: "緑" },
  olive:   { base: "#6E6008", text: "#5A4E06", label: "黄土" },
  amber:   { base: "#96650A", text: "#7A5308", label: "山吹" },
  orange:  { base: "#A34A0C", text: "#A34A0C", label: "橙" },
  red:     { base: "#A82420", text: "#A82420", label: "赤" },
  magenta: { base: "#912A62", text: "#912A62", label: "臙脂" },
  blue:    { base: "#2A4C96", text: "#2A4C96", label: "青" },
};

const FALLBACK: Swatch = { base: "#85878A", text: "#55595F", label: "未設定" };

export function swatchOf(category?: Category): Swatch {
  const key = category?.color?.[0];
  return (key && PALETTE[key]) || FALLBACK;
}

/**
 * CSS 変数として渡す。要素に spread するだけで
 * border-left / タグの色が切り替わる。
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

/* --------------------------------------------------------------------------
   本文HTMLの整形
   microCMS のリッチエディタ出力に、CSS だけでは当てられない構造を足す。
   -------------------------------------------------------------------------- */

export function enhanceBody(html: string) {
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

/** 一覧の抜粋。本文からタグを落として先頭を切り出す */
export function excerptOf(html: string, length = 120) {
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? text.slice(0, length) + "…" : text;
}
