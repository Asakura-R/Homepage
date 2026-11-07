/* --------------------------------------------------------------------------
   分岐の中の「文中の記号」を読み取る

     **太字**            → 太字
     *斜体*              → 斜体
     [文字](URL)         → リンク（https:// か / で始まるURLだけ）
     {大:文字}           → 文字サイズ。極小・小・大・特大・超特大
     \*                  → 記号をそのまま出したいときは \ を前に付ける

   組み合わせもできる（**{大:強調して大きく}** など）。
   閉じ忘れた記号は、記号のまま表示する（読者の画面が壊れないように）。

   HTML の文字列は作らず、構造だけを返す。画面に出すのは
   components/BranchStory.tsx で、React が文字を必ずエスケープするので
   本文に < や > が書かれていても安全。
   -------------------------------------------------------------------------- */

export type InlineSize = "xs" | "s" | "l" | "xl" | "xxl";

export type InlineNode =
  | { t: "text"; v: string }
  | { t: "strong"; c: InlineNode[] }
  | { t: "em"; c: InlineNode[] }
  | { t: "link"; href: string; c: InlineNode[] }
  | { t: "size"; size: InlineSize; c: InlineNode[] };

/** {大:…} の「大」の部分。日本語でも英字でも書ける */
const SIZE_WORDS: Record<string, InlineSize> = {
  極小: "xs", xs: "xs",
  小: "s", s: "s",
  大: "l", l: "l",
  特大: "xl", xl: "xl",
  超特大: "xxl", xxl: "xxl",
};

export const SIZE_LABELS = "極小・小・大・特大・超特大";

const ALNUM = /^[A-Za-z0-9]$/;

const ESCAPABLE = new Set(["*", "[", "]", "{", "}", "(", ")", "!", "\\", "#", ">", "-", "_", "`", ":"]);

/** 使ってよいリンク先。javascript: などは弾く */
export function safeHref(raw: string) {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:/i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

/** 使ってよい画像のURL */
export function safeImageSrc(raw: string) {
  const url = raw.trim();
  if (/^https:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

type Result = { nodes: InlineNode[]; issues: string[] };

export function parseInline(src: string): Result {
  const issues: string[] = [];
  const nodes = parseRange(src, issues);
  return { nodes: mergeText(nodes), issues };
}

function parseRange(src: string, issues: string[]): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  let i = 0;

  const pushText = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };

  while (i < src.length) {
    const ch = src[i];

    // \ のあとの記号は、記号として扱わない
    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // **太字**
    if (src.startsWith("**", i)) {
      const end = findClose(src, i + 2, "**");
      if (end > i + 2) {
        pushText();
        out.push({ t: "strong", c: parseRange(src.slice(i + 2, end), issues) });
        i = end + 2;
        continue;
      }
    }

    // *斜体*
    // 「* 」のように後ろが空白のときと、a*b のように英数字に挟まれたときは記号として扱わない
    if (
      ch === "*" &&
      src[i + 1] !== "*" &&
      src[i + 1] !== " " &&
      src[i + 1] !== undefined &&
      !ALNUM.test(src[i - 1] ?? "")
    ) {
      const end = findClose(src, i + 1, "*");
      if (end > i + 1 && src[end - 1] !== " " && !ALNUM.test(src[end + 1] ?? "")) {
        pushText();
        out.push({ t: "em", c: parseRange(src.slice(i + 1, end), issues) });
        i = end + 1;
        continue;
      }
    }

    // [文字](URL)
    if (ch === "[") {
      const closeBracket = findClose(src, i + 1, "]");
      if (closeBracket > i && src[closeBracket + 1] === "(") {
        const closeParen = findParen(src, closeBracket + 2);
        if (closeParen > closeBracket) {
          const label = src.slice(i + 1, closeBracket);
          const rawUrl = src.slice(closeBracket + 2, closeParen);
          const href = safeHref(rawUrl);
          pushText();
          if (href) {
            out.push({ t: "link", href, c: parseRange(label, issues) });
          } else {
            issues.push(`リンク先「${rawUrl}」は使えません。https:// か / で始まるURLにしてください（文字だけ表示します）`);
            out.push(...parseRange(label, issues));
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    // {大:文字}
    if (ch === "{") {
      const m = src.slice(i).match(/^\{([^:：{}]{1,4})[:：]/);
      if (m) {
        const end = findClose(src, i + m[0].length, "}");
        if (end > i) {
          const size = SIZE_WORDS[m[1].trim()];
          if (size) {
            pushText();
            out.push({ t: "size", size, c: parseRange(src.slice(i + m[0].length, end), issues) });
            i = end + 1;
            continue;
          }
          issues.push(`「{${m[1]}:…}」は文字サイズとして認識できません。使えるのは ${SIZE_LABELS} です`);
        }
      }
    }

    buf += ch;
    i++;
  }

  pushText();
  return out;
}

/**
 * 閉じ記号の位置を探す。途中の \ でエスケープされたものと、
 * 入れ子になった { } [ ] は飛ばす。
 */
function findClose(src: string, from: number, close: string) {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === "\\" && j + 1 < src.length && ESCAPABLE.has(src[j + 1])) {
      j++;
      continue;
    }
    if (close === "}" || close === "]") {
      const open = close === "}" ? "{" : "[";
      if (c === open) {
        depth++;
        continue;
      }
      if (c === close) {
        if (depth === 0) return j;
        depth--;
        continue;
      }
    } else if (src.startsWith(close, j)) {
      // ** の中の * を閉じと間違えないように
      if (close === "*" && src[j + 1] === "*") {
        const inner = findClose(src, j + 2, "**");
        if (inner > 0) {
          j = inner + 1;
          continue;
        }
      }
      return j;
    }
  }
  return -1;
}

/** URLの中の ( ) を数えて、対応する ) の位置を返す（…/パプリカ_(映画) のようなURLのため） */
function findParen(src: string, from: number) {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === "(") depth++;
    else if (c === ")") {
      if (depth === 0) return j;
      depth--;
    } else if (c === " " && depth === 0) {
      // 空白が来たらURLではない
      return -1;
    }
  }
  return -1;
}

function mergeText(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.t === "text" && last?.t === "text") last.v += n.v;
    else if (n.t === "text") out.push({ ...n });
    else out.push({ ...n, c: mergeText(n.c) } as InlineNode);
  }
  return out;
}

/** 記号を取り除いた素の文字列（一覧の抜粋や、場面の記録に使う） */
export function inlineToPlain(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.t === "text" ? n.v : inlineToPlain(n.c))).join("");
}
