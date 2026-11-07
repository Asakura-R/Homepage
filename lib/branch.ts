import { inlineToPlain, parseInline, safeImageSrc } from "./branchInline";

/* --------------------------------------------------------------------------
   分岐ストーリーの記法を読み取る

   microCMS のテキストエリアに、次のように書く。

     # はじまり
     鞄を受け取ったら、**妙に重い**。
     -> 中身を聞く : 聞く
     -> 黙って持ち上げる : 持つ

     # 聞く
     「力士です」と言われた。
     -> 米かと聞き返す : 米

     # 米
     米だった。{小:今は高いので、怒るに怒れない。}

   ■ 分岐の仕組み
   - 「# 名前」（# は1つ）が場面の始まり。最初の場面から読み始める
   - 「-> 表示する文 : 行き先の場面名」が選択肢
   - 選択肢のない場面が結末

   ■ 場面の中で使える書き方（Markdown とほぼ同じ）
   - 空行で段落が分かれる。改行はそのまま改行として出る
   - > 文            引用
   - ## 見出し        見出し（# が2つ以上。# 1つは場面の名前なので注意）
   - ---             水平線
   - - 項目 / 1. 項目  箇条書き / 番号付き
   - ![説明](URL "キャプション")  画像（キャプションは省略できる）
   - **太字** *斜体* [文字](URL) {大:文字} … 文中の記号は lib/branchInline.ts

   全角の「＃」「→」「：」「＞」でも書けるようにしてある。
   -------------------------------------------------------------------------- */

export type BranchNode =
  | { kind: "text"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "hr" }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "image"; src: string; alt: string; caption?: string };

export type BranchChoice = { label: string; target: string };

export type BranchScene = {
  id: string;
  nodes: BranchNode[];
  choices: BranchChoice[];
};

export type BranchStory = {
  start: string;
  scenes: Record<string, BranchScene>;
  /** 読者に見せると壊れる問題。下書きプレビューでだけ表示する */
  errors: string[];
  /** 動きはするが、たぶん意図と違うもの */
  warnings: string[];
};

/** # は1つだけ（## 以上は見出し） */
const SCENE_LINE = /^[#＃](?![#＃])\s*(.+)$/;
const HEADING_LINE = /^([#＃]{2,6})\s*(.+)$/;
const CHOICE_LINE = /^(?:->|→|－＞)\s*(.+)$/;
const QUOTE_LINE = /^[>＞]\s?(.*)$/;
const HR_LINE = /^(?:-{3,}|\*{3,}|_{3,}|ー{3,}|―{2,})$/;
const BULLET_LINE = /^[-*]\s+(.+)$/;
const ORDERED_LINE = /^\d+[.．]\s+(.+)$/;
const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+["“”]([^"“”]*)["“”])?\s*\)$/;

/** 本文より前に書かれた文章を受ける、名前のない最初の場面 */
const IMPLICIT_START = "はじまり";

type Buffer =
  | { kind: "text" | "quote"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

export function parseBranch(source?: string): BranchStory {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenes: Record<string, BranchScene> = {};
  const order: string[] = [];

  if (!source?.trim()) {
    return { start: "", scenes, errors: ["分岐の本文が空です"], warnings };
  }

  let current: BranchScene | null = null;
  let buffer: Buffer | null = null;

  const scene = () => current as unknown as BranchScene;

  const flush = () => {
    const b = buffer as Buffer | null;
    if (current && b) {
      if (b.kind === "list") {
        if (b.items.length) scene().nodes.push({ kind: "list", ordered: b.ordered, items: b.items });
      } else if (b.lines.length) {
        scene().nodes.push({ kind: b.kind, lines: b.lines });
      }
    }
    buffer = null;
  };

  /** 文中の記号を確かめ、問題があれば行番号付きで警告に回す */
  const check = (text: string, lineNo: number) => {
    for (const issue of parseInline(text).issues) warnings.push(`${lineNo}行目：${issue}`);
  };

  const openScene = (id: string, lineNo: number) => {
    flush();
    if (scenes[id]) {
      errors.push(`${lineNo}行目：場面「${id}」が2回定義されています。名前を変えてください`);
      // 後から書いたほうで上書きせず、別の場面として読み捨てる
      current = { id, nodes: [], choices: [] };
      return;
    }
    current = { id, nodes: [], choices: [] };
    scenes[id] = current;
    order.push(id);
  };

  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const trimmed = raw.trim();

    // 空行は段落の区切り
    if (!trimmed) {
      flush();
      return;
    }

    const sceneLine = trimmed.match(SCENE_LINE);
    if (sceneLine) {
      openScene(sceneLine[1].trim(), lineNo);
      return;
    }

    // 場面の名前より前に本文が書かれていたら、名前のない最初の場面として扱う
    if (!current) openScene(IMPLICIT_START, lineNo);

    const choice = trimmed.match(CHOICE_LINE);
    if (choice) {
      flush();
      const body = choice[1];
      // 表示文にコロンが含まれていてもいいように、最後の区切りで分ける
      const sep = Math.max(body.lastIndexOf(":"), body.lastIndexOf("："));
      if (sep < 0) {
        errors.push(`${lineNo}行目：選択肢に行き先がありません（「表示する文 : 場面名」の形で書きます）`);
        return;
      }
      const label = body.slice(0, sep).trim();
      const target = body.slice(sep + 1).trim();
      if (!label || !target) {
        errors.push(`${lineNo}行目：選択肢の表示文か行き先が空です`);
        return;
      }
      check(label, lineNo);
      scene().choices.push({ label, target });
      return;
    }

    // 選択肢のあとに本文が続いたら、書き間違いの可能性が高い
    if (scene().choices.length) {
      warnings.push(`${lineNo}行目：場面「${scene().id}」の選択肢より後ろに本文があります。選択肢の上に表示されます`);
    }

    // 見出し
    const heading = trimmed.match(HEADING_LINE);
    if (heading) {
      flush();
      const level = heading[1].length === 2 ? 2 : 3;
      check(heading[2], lineNo);
      scene().nodes.push({ kind: "heading", level, text: heading[2].trim() });
      return;
    }

    // 水平線
    if (HR_LINE.test(trimmed)) {
      flush();
      scene().nodes.push({ kind: "hr" });
      return;
    }

    // 画像（1行まるごと）
    const image = trimmed.match(IMAGE_LINE);
    if (image) {
      flush();
      const src = safeImageSrc(image[2]);
      if (!src) {
        warnings.push(`${lineNo}行目：画像のURL「${image[2]}」は使えません。https:// で始まるURLにしてください（画像は表示されません）`);
        return;
      }
      const caption = image[3]?.trim();
      if (caption) check(caption, lineNo);
      scene().nodes.push({ kind: "image", src, alt: image[1].trim(), caption: caption || undefined });
      return;
    }

    // 箇条書き
    const bullet = trimmed.match(BULLET_LINE);
    const ordered = bullet ? null : trimmed.match(ORDERED_LINE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const item = (bullet ?? ordered)![1];
      const b = buffer as Buffer | null;
      if (!b || b.kind !== "list" || b.ordered !== isOrdered) {
        flush();
        buffer = { kind: "list", ordered: isOrdered, items: [] };
      }
      check(item, lineNo);
      (buffer as unknown as { items: string[] }).items.push(item);
      return;
    }

    // 地の文と引用
    const quote = trimmed.match(QUOTE_LINE);
    const kind = quote ? "quote" : "text";
    const text = quote ? quote[1] : trimmed;

    // 種類が変わったら段落を切る（地の文と引用が混ざらないように）
    const b = buffer as Buffer | null;
    if (b && b.kind !== kind) flush();
    if (!buffer) buffer = { kind, lines: [] };
    check(text, lineNo);
    (buffer as unknown as { lines: string[] }).lines.push(text);
  });

  flush();

  const start = order[0] ?? "";

  // 行き先の確認
  for (const id of order) {
    const s = scenes[id];
    if (!s.nodes.length && !s.choices.length) {
      warnings.push(`場面「${id}」に本文も選択肢もありません`);
    }
    for (const c of s.choices) {
      if (!scenes[c.target]) {
        errors.push(`場面「${id}」の選択肢「${plain(c.label)}」の行き先「${c.target}」が見つかりません`);
      }
    }
  }

  // 最初の場面からたどり着けない場面
  const reached = new Set<string>();
  const queue = start ? [start] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id) || !scenes[id]) continue;
    reached.add(id);
    scenes[id].choices.forEach((c) => queue.push(c.target));
  }
  for (const id of order) {
    if (!reached.has(id)) {
      warnings.push(`場面「${id}」には、どの選択肢からもたどり着けません`);
    }
  }

  // 結末が1つもないと、読者が永遠に終われない
  const hasEnding = order.some((id) => reached.has(id) && scenes[id].choices.length === 0);
  if (start && !hasEnding) {
    warnings.push("結末（選択肢のない場面）がありません。ずっと選び続ける構成になっています");
  }

  return { start, scenes, errors, warnings };
}

/** 記号を取り除いた素の文字列 */
export function plain(text: string) {
  return inlineToPlain(parseInline(text).nodes);
}

/** 一覧の抜粋用。最初の場面の文章だけを素の文字列で返す */
export function branchLeadText(source?: string) {
  const story = parseBranch(source);
  const first = story.scenes[story.start];
  if (!first) return "";
  const parts: string[] = [];
  for (const n of first.nodes) {
    if (n.kind === "text" || n.kind === "quote") parts.push(...n.lines.map(plain));
    else if (n.kind === "heading") parts.push(plain(n.text));
    else if (n.kind === "list") parts.push(...n.items.map(plain));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
