import { inlineToPlain, inlineVarNames, parseInline, safeImageSrc } from "./branchInline";
import {
  applyEffects,
  condNames,
  evalAll,
  takeLeadingCommands,
  takeTrailingCommands,
} from "./branchLogic";
import type { Cond, Effect, Vars } from "./branchLogic";

/* --------------------------------------------------------------------------
   分岐ストーリーの記法を読み取る

   microCMS のテキストエリアに、次のように書く。

     # はじまり
     [所持金 = 1000]
     鞄を受け取ったら、**妙に重い**。
     -> 中身を聞く : 聞く
     -> 黙って持ち上げる : 持つ [set 力持ち]

     # 聞く
     「力士です」と言われた。
     [if 力持ち] さっき持ち上げたのは何だったのか。
     -> 米かと聞き返す : 米
     -> 千円で売ってもらう : 米 [所持金 -1000] [lock 所持金 >= 1000 "お金が足りない"]

   ■ 分岐の仕組み
   - 「# 名前」（# は1つ）が場面の始まり。最初の場面から読み始める
   - 「-> 表示する文 : 行き先の場面名」が選択肢
   - 選択肢のない場面（または条件で選択肢がすべて隠れた場面）が結末

   ■ 場面の中で使える書き方（Markdown とほぼ同じ）
   - 空行で段落が分かれる。改行はそのまま改行として出る
   - > 文            引用
   - ## 見出し        見出し（# が2つ以上。# 1つは場面の名前なので注意）
   - ---             水平線
   - - 項目 / 1. 項目  箇条書き / 番号付き
   - ![説明](URL "キャプション")  画像（キャプションは省略できる）
   - **太字** *斜体* [文字](URL) {大:文字} {=フラグ} … 文中の記号は lib/branchInline.ts

   ■ フラグ（書き方の詳細は lib/branchLogic.ts）
   - 選択肢の行末に [set 鍵] [好感度 +1] などを書くと、選んだときにフラグが変わる
   - 選択肢の行末に [if 条件] を書くと、条件に合うときだけ出る（合わなければ隠れる）
   - 選択肢の行末に [lock 条件 "理由"] を書くと、条件に合わないときは押せない状態で見せる
   - 場面の中で [set 鍵] などだけの行を書くと、その場面に来たときにフラグが変わる
   - 場面の中の行頭に [if 条件] を書くと、その行は条件に合うときだけ出る
   - 場面の中は上から順に処理する（変更より下の行は、変更後の値で判定・表示される）

   全角の「＃」「→」「：」「＞」でも書けるようにしてある。
   -------------------------------------------------------------------------- */

export type BranchLine = { text: string; cond?: Cond[] };

export type BranchNode =
  | { kind: "text"; lines: BranchLine[] }
  | { kind: "quote"; lines: BranchLine[] }
  | { kind: "heading"; level: 2 | 3; text: string; cond?: Cond[] }
  | { kind: "hr"; cond?: Cond[] }
  | { kind: "list"; ordered: boolean; items: BranchLine[] }
  | { kind: "image"; src: string; alt: string; caption?: string; cond?: Cond[] }
  | { kind: "effects"; effects: Effect[]; cond?: Cond[] };

export type BranchLock = { cond: Cond; message?: string };

export type BranchChoice = {
  label: string;
  target: string;
  /** 選んだときのフラグの変更 */
  effects: Effect[];
  /** すべて満たしたときだけ表示（満たさなければ隠す） */
  showIf: Cond[];
  /** 満たさないものがあれば、押せない状態で表示 */
  locks: BranchLock[];
};

export type BranchScene = {
  id: string;
  nodes: BranchNode[];
  choices: BranchChoice[];
};

export type BranchStory = {
  start: string;
  scenes: Record<string, BranchScene>;
  /** 使われているフラグの名前（出てきた順）。下書きプレビューでフラグの状態を見せるのに使う */
  flags: string[];
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
  | { kind: "text" | "quote"; lines: BranchLine[] }
  | { kind: "list"; ordered: boolean; items: BranchLine[] };

export function parseBranch(source?: string): BranchStory {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenes: Record<string, BranchScene> = {};
  const order: string[] = [];

  /** フラグの書き間違いを見つけるため、変更している名前と参照している名前を集める */
  const assigned = new Set<string>();
  const seen = new Set<string>(); // 出てきた順に並べるため
  const referenced = new Map<string, number>(); // 名前 → 最初に出てきた行

  const empty = { start: "", scenes, flags: [], errors, warnings };
  if (!source?.trim()) {
    errors.push("分岐の本文が空です");
    return empty;
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

  const refer = (names: Iterable<string>, lineNo: number) => {
    for (const n of names) {
      seen.add(n);
      if (!referenced.has(n)) referenced.set(n, lineNo);
    }
  };
  const referConds = (conds: Cond[], lineNo: number) => {
    for (const c of conds) refer(condNames(c), lineNo);
  };

  /** 文中の記号を確かめ、問題があれば行番号付きで警告に回す */
  const check = (text: string, lineNo: number) => {
    const { nodes, issues } = parseInline(text);
    for (const issue of issues) warnings.push(`${lineNo}行目：${issue}`);
    refer(inlineVarNames(nodes), lineNo);
  };

  /** 「- [if 鍵] 項目」「> [if 鍵] 文」のように、記号のあとに書かれた条件を取り出す */
  const innerCond = (text: string, lineNo: number, outer: Cond[]) => {
    const inner = takeLeadingCommands(text);
    if (!inner.commands.length && !inner.errors.length) return { text, cond: outer };
    inner.errors.forEach((e) => errors.push(`${lineNo}行目：${e}`));
    const cond = [...outer];
    for (const cmd of inner.commands) {
      if (cmd.type === "if") cond.push(cmd.cond);
      else warnings.push(`${lineNo}行目：箇条書きや引用の中では [if …] だけが使えます（フラグを変えるときは、行頭に書いてください）`);
    }
    referConds(cond, lineNo);
    return { text: inner.rest, cond };
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

    /* ---------------- 選択肢 ---------------- */

    const choice = trimmed.match(CHOICE_LINE);
    if (choice) {
      flush();
      // 行末の [ … ] を先に取り出す（理由の文にコロンがあっても困らないように）
      const tail = takeTrailingCommands(choice[1]);
      tail.errors.forEach((e) => errors.push(`${lineNo}行目：${e}`));

      const body = tail.rest;
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

      const c: BranchChoice = { label, target, effects: [], showIf: [], locks: [] };
      for (const cmd of tail.commands) {
        if (cmd.type === "if") c.showIf.push(cmd.cond);
        else if (cmd.type === "lock") c.locks.push({ cond: cmd.cond, message: cmd.message });
        else c.effects.push(cmd.effect);
      }
      referConds(c.showIf, lineNo);
      referConds(c.locks.map((l) => l.cond), lineNo);
      c.effects.forEach((e) => (assigned.add(e.name), seen.add(e.name)));

      scene().choices.push(c);
      return;
    }

    // 選択肢のあとに本文が続いたら、書き間違いの可能性が高い
    if (scene().choices.length) {
      warnings.push(`${lineNo}行目：場面「${scene().id}」の選択肢より後ろに本文があります。選択肢の上に表示されます`);
    }

    /* ---------------- 行頭の [if …] と、フラグを変える行 ---------------- */

    const head = takeLeadingCommands(trimmed);
    head.errors.forEach((e) => errors.push(`${lineNo}行目：${e}`));

    const cond: Cond[] = [];
    const effects: Effect[] = [];
    for (const cmd of head.commands) {
      if (cmd.type === "if") cond.push(cmd.cond);
      else if (cmd.type === "effect") effects.push(cmd.effect);
      else warnings.push(`${lineNo}行目：[lock …] は選択肢の行でだけ使えます。場面の中では [if …] を使ってください`);
    }
    referConds(cond, lineNo);
    effects.forEach((e) => (assigned.add(e.name), seen.add(e.name)));

    const condOrUndef = cond.length ? cond : undefined;

    if (effects.length) {
      // フラグの変更は書いた位置で起きるので、段落をここで区切る
      flush();
      scene().nodes.push({ kind: "effects", effects, cond: condOrUndef });
    }

    const rest = head.rest;
    if (!rest) {
      if (cond.length && !effects.length) {
        warnings.push(`${lineNo}行目：[if …] のあとに何も書かれていません`);
      }
      return;
    }

    /* ---------------- 見出し・水平線・画像・箇条書き・文章 ---------------- */

    const heading = rest.match(HEADING_LINE);
    if (heading) {
      flush();
      const level = heading[1].length === 2 ? 2 : 3;
      check(heading[2], lineNo);
      scene().nodes.push({ kind: "heading", level, text: heading[2].trim(), cond: condOrUndef });
      return;
    }

    if (HR_LINE.test(rest)) {
      flush();
      scene().nodes.push({ kind: "hr", cond: condOrUndef });
      return;
    }

    const image = rest.match(IMAGE_LINE);
    if (image) {
      flush();
      const src = safeImageSrc(image[2]);
      if (!src) {
        warnings.push(`${lineNo}行目：画像のURL「${image[2]}」は使えません。https:// で始まるURLにしてください（画像は表示されません）`);
        return;
      }
      const caption = image[3]?.trim();
      if (caption) check(caption, lineNo);
      scene().nodes.push({
        kind: "image",
        src,
        alt: image[1].trim(),
        caption: caption || undefined,
        cond: condOrUndef,
      });
      return;
    }

    const bullet = rest.match(BULLET_LINE);
    const ordered = bullet ? null : rest.match(ORDERED_LINE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const { text: item, cond: itemCond } = innerCond((bullet ?? ordered)![1], lineNo, cond);
      const b = buffer as Buffer | null;
      if (!b || b.kind !== "list" || b.ordered !== isOrdered) {
        flush();
        buffer = { kind: "list", ordered: isOrdered, items: [] };
      }
      check(item, lineNo);
      (buffer as unknown as { items: BranchLine[] }).items.push({
        text: item,
        cond: itemCond.length ? itemCond : undefined,
      });
      return;
    }

    // 地の文と引用
    const quote = rest.match(QUOTE_LINE);
    const kind = quote ? "quote" : "text";
    const { text, cond: lineCond } = quote ? innerCond(quote[1], lineNo, cond) : { text: rest, cond };

    // 種類が変わったら段落を切る（地の文と引用が混ざらないように）
    const b = buffer as Buffer | null;
    if (b && b.kind !== kind) flush();
    if (!buffer) buffer = { kind, lines: [] };
    check(text, lineNo);
    (buffer as unknown as { lines: BranchLine[] }).lines.push({
      text,
      cond: lineCond.length ? lineCond : undefined,
    });
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

  // 最初の場面からたどり着けない場面（条件は考えずに、つながりだけを見る）
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
  const hasConditional = order.some((id) => scenes[id].choices.some((c) => c.showIf.length));
  if (start && !hasEnding && !hasConditional) {
    warnings.push("結末（選択肢のない場面）がありません。ずっと選び続ける構成になっています");
  }

  // どこでも変更していないのに参照しているフラグ → たぶん名前の書き間違い
  for (const [name, lineNo] of referenced) {
    if (!assigned.has(name)) {
      warnings.push(
        `${lineNo}行目：フラグ「${name}」はどこでも変更されていません。名前の書き間違いかもしれません（ずっと OFF / 0 として扱われます）`
      );
    }
  }

  return { start, scenes, flags: [...seen], errors, warnings };
}

/* --------------------------------------------------------------------------
   場面を進める

   場面に入るときのフラグ（before）を受け取り、上から順に処理して
   - 表示するもの（それぞれ、その時点のフラグの値つき）
   - 場面を出るときのフラグ（after）
   を返す。読者の操作のたびに、ここだけで状態を計算する。
   -------------------------------------------------------------------------- */

export type SceneViewItem = { node: Exclude<BranchNode, { kind: "effects" }>; vars: Vars };

export function runScene(scene: BranchScene, before: Vars) {
  let vars = before;
  const view: SceneViewItem[] = [];

  for (const node of scene.nodes) {
    if (node.kind === "effects") {
      if (evalAll(node.cond, vars)) vars = applyEffects(node.effects, vars);
      continue;
    }

    if (node.kind === "text" || node.kind === "quote") {
      const lines = node.lines.filter((l) => evalAll(l.cond, vars));
      if (lines.length) view.push({ node: { ...node, lines }, vars });
      continue;
    }

    if (node.kind === "list") {
      const items = node.items.filter((l) => evalAll(l.cond, vars));
      if (items.length) view.push({ node: { ...node, items }, vars });
      continue;
    }

    if (evalAll(node.cond, vars)) view.push({ node, vars });
  }

  return { view, after: vars };
}

export type ChoiceState =
  | { state: "open" }
  | { state: "locked"; message?: string }
  | { state: "hidden" };

export function choiceState(choice: BranchChoice, vars: Vars): ChoiceState {
  if (!evalAll(choice.showIf, vars)) return { state: "hidden" };
  const failed = choice.locks.find((l) => !evalAll([l.cond], vars));
  if (failed) return { state: "locked", message: failed.message };
  return { state: "open" };
}

/* --------------------------------------------------------------------------
   補助
   -------------------------------------------------------------------------- */

/** 記号を取り除いた素の文字列 */
export function plain(text: string) {
  return inlineToPlain(parseInline(text).nodes);
}

/** 一覧の抜粋用。最初の場面で、最初に読者に見える文章だけを素の文字列で返す */
export function branchLeadText(source?: string) {
  const story = parseBranch(source);
  const first = story.scenes[story.start];
  if (!first) return "";
  const parts: string[] = [];
  for (const { node } of runScene(first, {}).view) {
    if (node.kind === "text" || node.kind === "quote") parts.push(...node.lines.map((l) => plain(l.text)));
    else if (node.kind === "heading") parts.push(plain(node.text));
    else if (node.kind === "list") parts.push(...node.items.map((l) => plain(l.text)));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
