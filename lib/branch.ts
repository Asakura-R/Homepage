/* --------------------------------------------------------------------------
   分岐ストーリーの記法を読み取る

   microCMS のテキストエリアに、次のように書く。

     # はじまり
     鞄を受け取ったら、妙に重い。
     -> 中身を聞く : 聞く
     -> 黙って持ち上げる : 持つ

     # 聞く
     「力士です」と言われた。
     -> 米かと聞き返す : 米

     # 米
     米だった。今は高いので、怒るに怒れない。

   - 「#」で始まる行が場面の名前。最初の場面から読み始める
   - 「->」で始まる行が選択肢。「表示する文 : 行き先の場面名」
   - 選択肢のない場面が結末
   - 空行で段落が分かれる。改行はそのまま改行として出る
   - 「>」で始まる行は引用（地の文から離れた声）として出る

   全角の「＃」「→」「：」「＞」でも書けるようにしてある。
   -------------------------------------------------------------------------- */

export type BranchParagraph = { kind: "text" | "quote"; text: string };

export type BranchChoice = { label: string; target: string };

export type BranchScene = {
  id: string;
  paragraphs: BranchParagraph[];
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

const SCENE_LINE = /^[#＃]\s*(.+)$/;
const CHOICE_LINE = /^(?:->|→|－＞)\s*(.+)$/;
const QUOTE_LINE = /^[>＞]\s?(.*)$/;

/** 本文より前に書かれた文章を受ける、名前のない最初の場面 */
const IMPLICIT_START = "はじまり";

export function parseBranch(source?: string): BranchStory {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenes: Record<string, BranchScene> = {};
  const order: string[] = [];

  if (!source?.trim()) {
    return { start: "", scenes, errors: ["分岐の本文が空です"], warnings };
  }

  let current: BranchScene | null = null;
  let buffer: { kind: BranchParagraph["kind"]; lines: string[] } | null = null;

  const flush = () => {
    if (current && buffer && buffer.lines.length) {
      current.paragraphs.push({ kind: buffer.kind, text: buffer.lines.join("\n") });
    }
    buffer = null;
  };

  const openScene = (id: string, lineNo: number) => {
    flush();
    if (scenes[id]) {
      errors.push(`${lineNo}行目：場面「${id}」が2回定義されています。名前を変えてください`);
      // 後から書いたほうで上書きせず、別の場面として読み捨てる
      current = { id, paragraphs: [], choices: [] };
      return;
    }
    current = { id, paragraphs: [], choices: [] };
    scenes[id] = current;
    order.push(id);
  };

  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // 空行は段落の区切り
    if (!trimmed) {
      flush();
      return;
    }

    const scene = trimmed.match(SCENE_LINE);
    if (scene) {
      openScene(scene[1].trim(), lineNo);
      return;
    }

    // 見出しより前に本文が書かれていたら、名前のない最初の場面として扱う
    if (!current) openScene(IMPLICIT_START, lineNo);
    const sceneNow = current as unknown as BranchScene;

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
      sceneNow.choices.push({ label, target });
      return;
    }

    // 選択肢のあとに本文が続いたら、書き間違いの可能性が高い
    if (sceneNow.choices.length) {
      warnings.push(`${lineNo}行目：場面「${sceneNow.id}」の選択肢より後ろに本文があります。選択肢の上に表示されます`);
    }

    const quote = trimmed.match(QUOTE_LINE);
    const kind: BranchParagraph["kind"] = quote ? "quote" : "text";
    const text = quote ? quote[1] : trimmed;

    // 種類が変わったら段落を切る（地の文と引用が混ざらないように）
    if (buffer && (buffer as { kind: string }).kind !== kind) flush();
    if (!buffer) buffer = { kind, lines: [] };
    (buffer as { lines: string[] }).lines.push(text);
  });

  flush();

  const start = order[0] ?? "";

  // 行き先の確認
  for (const id of order) {
    const s = scenes[id];
    if (!s.paragraphs.length && !s.choices.length) {
      warnings.push(`場面「${id}」に本文も選択肢もありません`);
    }
    for (const c of s.choices) {
      if (!scenes[c.target]) {
        errors.push(`場面「${id}」の選択肢「${c.label}」の行き先「${c.target}」が見つかりません`);
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

/** 一覧の抜粋用。最初の場面の本文だけを素の文字列で返す */
export function branchLeadText(source?: string) {
  const story = parseBranch(source);
  const first = story.scenes[story.start];
  if (!first) return "";
  return first.paragraphs.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
}
