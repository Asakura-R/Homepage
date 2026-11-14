import type { BranchPick } from "./branch";

/* --------------------------------------------------------------------------
   分岐の途中保存

   読者のブラウザ（localStorage）に、選んできた選択肢の目印だけを記録する。
   サーバーには何も送らない。

   - [save] を書いた分岐だけが対象（lib/branch.ts）
   - 最後に選んでから SAVE_DAYS 日たった記録は捨てる
   - シークレットモードなどで保存できないブラウザでは、何もしない（エラーにしない）
   -------------------------------------------------------------------------- */

/** 記録を残しておく日数 */
export const SAVE_DAYS = 14;

const PREFIX = "nomimonodo:branch:";
const VERSION = 1;
const MAX_AGE = SAVE_DAYS * 24 * 60 * 60 * 1000;

type SaveRecord = {
  v: typeof VERSION;
  /** 保存したときの最初の場面。記事の中で分岐の順番を入れ替えたときに、別の分岐の記録を読まないように */
  start: string;
  savedAt: number;
  picks: BranchPick[];
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // 保存を禁止している設定だと、触っただけで例外になるブラウザがある
    return null;
  }
}

function isRecord(x: unknown): x is SaveRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.v === VERSION &&
    typeof r.start === "string" &&
    typeof r.savedAt === "number" &&
    Array.isArray(r.picks) &&
    r.picks.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as BranchPick).label === "string" &&
        typeof (p as BranchPick).target === "string"
    )
  );
}

function expired(record: SaveRecord, now: number) {
  // 未来の日時（端末の時計がずれていた）も、念のため期限切れとして扱う
  return now - record.savedAt > MAX_AGE || record.savedAt > now + MAX_AGE;
}

/** 記録を読む。なければ（期限切れ・壊れている・別の分岐のもの）null */
export function loadPicks(key: string, start: string): BranchPick[] | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + key);
    if (!raw) return null;
    const record: unknown = JSON.parse(raw);
    if (!isRecord(record) || record.start !== start || expired(record, Date.now())) {
      s.removeItem(PREFIX + key);
      return null;
    }
    return record.picks;
  } catch {
    return null;
  }
}

/** 記録する。選んだものがなければ（最初の場面にいる）記録を消す */
export function savePicks(key: string, start: string, picks: BranchPick[]) {
  if (!picks.length) return clearPicks(key);
  const s = storage();
  if (!s) return;
  const record: SaveRecord = { v: VERSION, start, savedAt: Date.now(), picks };
  try {
    s.setItem(PREFIX + key, JSON.stringify(record));
  } catch {
    // 容量いっぱいなど。保存できなくても読むのには困らないので、黙って諦める
  }
}

export function clearPicks(key: string) {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    /* 何もしない */
  }
}

/** ほかの記事の、期限切れの記録を掃除する（読者のブラウザに古い記録をためこまないように） */
export function sweepExpired() {
  const s = storage();
  if (!s) return;
  try {
    const now = Date.now();
    const stale: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const record: unknown = JSON.parse(s.getItem(k) ?? "");
        if (!isRecord(record) || expired(record, now)) stale.push(k);
      } catch {
        stale.push(k);
      }
    }
    stale.forEach((k) => s.removeItem(k));
  } catch {
    /* 何もしない */
  }
}
