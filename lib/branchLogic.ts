/* --------------------------------------------------------------------------
   フラグ（インタラクティブフィクション用）

   フラグはすべて「数」として持つ。ON は 1、OFF は 0。
   一度も設定していないフラグは 0（OFF）として扱う。

   ■ フラグを変える（選択肢の行末、または場面の中の行に書く）
     [set 鍵]          鍵 を ON にする
     [unset 鍵]        鍵 を OFF にする
     [好感度 +1]       好感度 を 1 増やす
     [所持金 -500]     所持金 を 500 減らす
     [所持金 = 1000]   所持金 を 1000 にする

   ■ 条件（選択肢の行末、または場面の中の行頭に書く）
     [if 鍵]                 鍵 が ON のとき
     [if !鍵]                鍵 が OFF のとき
     [if 好感度 >= 3]        比較は >= <= > < == != が使える
     [if 鍵 and 好感度 >= 3] and（かつ）/ or（または）でつなげる
     [lock 鍵 "鍵が必要"]    選択肢用。条件に合わないときは隠さず、押せない状態で見せる
                             "" の中は押せない理由として添える（省略できる）

   全角の ＋ － ＝ ＞ ＜ ！ や全角数字でも書ける。
   -------------------------------------------------------------------------- */

export type Vars = Record<string, number>;

export type Comparator = ">=" | "<=" | ">" | "<" | "==" | "!=";

export type Cond =
  | { op: "or"; items: Cond[] }
  | { op: "and"; items: Cond[] }
  | { op: "not"; item: Cond }
  | { op: "truthy"; name: string }
  | { op: "cmp"; name: string; cmp: Comparator; value: number };

export type Effect =
  | { kind: "assign"; name: string; value: number }
  | { kind: "add"; name: string; value: number };

export type Command =
  | { type: "if"; cond: Cond }
  | { type: "lock"; cond: Cond; message?: string }
  | { type: "effect"; effect: Effect };

/** 全角の記号と数字を半角にそろえる */
export function normalize(s: string) {
  return s
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/＋/g, "+")
    .replace(/[－−](?=\s*\d)/g, "-")
    .replace(/＝/g, "=")
    .replace(/＞/g, ">")
    .replace(/＜/g, "<")
    .replace(/！/g, "!")
    .replace(/[“”＂]/g, '"')
    .replace(/　/g, " ")
    .trim();
}

/** フラグの名前に使えない文字（空白・括弧・演算子） */
const NAME = "[^\\s\\[\\]!<>=+\\-\"]+";
const NAME_ONLY = new RegExp(`^${NAME}$`);

/* --------------------------------------------------------------------------
   条件の読み取り
   -------------------------------------------------------------------------- */

export function parseCondition(raw: string): Cond | { error: string } {
  const src = normalize(raw);
  if (!src) return { error: "条件が空です" };

  const orParts = splitBy(src, /\s+(?:or|または)\s+|\s*\|\|\s*/i);
  const ors: Cond[] = [];
  for (const orPart of orParts) {
    const andParts = splitBy(orPart, /\s+(?:and|かつ)\s+|\s*&&\s*/i);
    const ands: Cond[] = [];
    for (const part of andParts) {
      const c = parseAtom(part.trim());
      if ("error" in c) return c;
      ands.push(c);
    }
    ors.push(ands.length === 1 ? ands[0] : { op: "and", items: ands });
  }
  return ors.length === 1 ? ors[0] : { op: "or", items: ors };
}

function splitBy(s: string, re: RegExp) {
  return s.split(re).filter((p) => p.trim() !== "");
}

function parseAtom(s: string): Cond | { error: string } {
  if (!s) return { error: "条件が空です" };

  if (s.startsWith("!")) {
    const inner = parseAtom(s.slice(1).trim());
    return "error" in inner ? inner : { op: "not", item: inner };
  }

  const cmp = s.match(new RegExp(`^(${NAME})\\s*(>=|<=|==|!=|=|>|<)\\s*(-?\\d+)$`));
  if (cmp) {
    const op = (cmp[2] === "=" ? "==" : cmp[2]) as Comparator;
    return { op: "cmp", name: cmp[1], cmp: op, value: Number(cmp[3]) };
  }

  if (NAME_ONLY.test(s)) return { op: "truthy", name: s };

  return { error: `条件「${s}」を読み取れません` };
}

/* --------------------------------------------------------------------------
   [ ] の中身の読み取り
   null は「命令ではない」（ふつうの文字として扱う）
   -------------------------------------------------------------------------- */

const KEYWORD = /^(?:if|lock|set|unset)(?:\s|$)/i;

export function parseCommand(rawInside: string): Command | { error: string } | null {
  const s = normalize(rawInside);

  const ifm = s.match(/^if\s+(.+)$/i);
  if (ifm) {
    const cond = parseCondition(ifm[1]);
    return "error" in cond ? cond : { type: "if", cond };
  }

  const lock = s.match(/^lock\s+(.+?)(?:\s+"([^"]*)")?$/i);
  if (lock) {
    const cond = parseCondition(lock[1]);
    if ("error" in cond) return cond;
    const message = lock[2]?.trim();
    return { type: "lock", cond, message: message || undefined };
  }

  const set = s.match(new RegExp(`^set\\s+(${NAME})$`, "i"));
  if (set) return { type: "effect", effect: { kind: "assign", name: set[1], value: 1 } };

  const unset = s.match(new RegExp(`^unset\\s+(${NAME})$`, "i"));
  if (unset) return { type: "effect", effect: { kind: "assign", name: unset[1], value: 0 } };

  const add = s.match(new RegExp(`^(${NAME})\\s*([+-])\\s*(\\d+)$`));
  if (add) {
    const n = Number(add[3]);
    return { type: "effect", effect: { kind: "add", name: add[1], value: add[2] === "-" ? -n : n } };
  }

  const assign = s.match(new RegExp(`^(${NAME})\\s*=\\s*(-?\\d+)$`));
  if (assign) return { type: "effect", effect: { kind: "assign", name: assign[1], value: Number(assign[2]) } };

  // if / lock / set / unset で始まるのに読めないものは、書き間違いとして知らせる
  if (KEYWORD.test(s)) return { error: `「[${rawInside.trim()}]」を読み取れません` };

  return null;
}

/**
 * 行の先頭か末尾に並んだ [ … ] を取り出す。
 * [文字](URL) のリンクや、命令として読めない [注] などは取り出さない。
 */
export function takeLeadingCommands(line: string) {
  return takeCommands(line, "lead");
}

export function takeTrailingCommands(line: string) {
  return takeCommands(line, "trail");
}

function takeCommands(line: string, side: "lead" | "trail") {
  const commands: Command[] = [];
  const errors: string[] = [];
  let rest = line;

  for (;;) {
    const m =
      side === "lead"
        ? rest.match(/^\s*\[([^\[\]]+)\](?!\()/)
        : rest.match(/\[([^\[\]]+)\]\s*$/);
    if (!m) break;

    const parsed = parseCommand(m[1]);
    if (parsed === null) break; // 命令ではない括弧はそのまま文章として残す
    if ("error" in parsed) errors.push(parsed.error);
    else commands.push(parsed);

    rest = side === "lead" ? rest.slice(m[0].length) : rest.slice(0, rest.length - m[0].length);
  }

  if (side === "trail") commands.reverse();
  return { commands, errors, rest: rest.trim() };
}

/* --------------------------------------------------------------------------
   計算
   -------------------------------------------------------------------------- */

export function valueOf(vars: Vars, name: string) {
  return vars[name] ?? 0;
}

export function evalCond(cond: Cond, vars: Vars): boolean {
  switch (cond.op) {
    case "or":
      return cond.items.some((c) => evalCond(c, vars));
    case "and":
      return cond.items.every((c) => evalCond(c, vars));
    case "not":
      return !evalCond(cond.item, vars);
    case "truthy":
      return valueOf(vars, cond.name) !== 0;
    case "cmp": {
      const v = valueOf(vars, cond.name);
      switch (cond.cmp) {
        case ">=": return v >= cond.value;
        case "<=": return v <= cond.value;
        case ">":  return v > cond.value;
        case "<":  return v < cond.value;
        case "==": return v === cond.value;
        case "!=": return v !== cond.value;
      }
    }
  }
}

/** 条件が複数あるときはすべて満たしたとき（and） */
export function evalAll(conds: Cond[] | undefined, vars: Vars) {
  return !conds?.length || conds.every((c) => evalCond(c, vars));
}

export function applyEffects(effects: Effect[], vars: Vars): Vars {
  if (!effects.length) return vars;
  const next = { ...vars };
  for (const e of effects) {
    next[e.name] = e.kind === "assign" ? e.value : valueOf(next, e.name) + e.value;
  }
  return next;
}

/* --------------------------------------------------------------------------
   書き間違いの確認用：使われているフラグの名前を集める
   -------------------------------------------------------------------------- */

export function condNames(cond: Cond, out = new Set<string>()) {
  switch (cond.op) {
    case "or":
    case "and":
      cond.items.forEach((c) => condNames(c, out));
      break;
    case "not":
      condNames(cond.item, out);
      break;
    default:
      out.add(cond.name);
  }
  return out;
}

/** 条件を人が読める形に戻す（押せない選択肢の理由の既定値などに使う） */
export function describeCond(cond: Cond): string {
  switch (cond.op) {
    case "or":
      return cond.items.map(describeCond).join(" または ");
    case "and":
      return cond.items.map(describeCond).join(" かつ ");
    case "not":
      return `${describeCond(cond.item)} ではない`;
    case "truthy":
      return cond.name;
    case "cmp":
      return `${cond.name} ${cond.cmp} ${cond.value}`;
  }
}
