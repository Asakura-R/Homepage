"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { advance, choiceState, firstPath, MAX_STEPS, picksOf, replay, retreat, runScene } from "@/lib/branch";
import type { BranchChoice, BranchLine, BranchStep, BranchStory as Story, SceneViewItem } from "@/lib/branch";
import { valueOf } from "@/lib/branchLogic";
import type { Vars } from "@/lib/branchLogic";
import { parseInline } from "@/lib/branchInline";
import type { InlineNode } from "@/lib/branchInline";
import { clearPicks, loadPicks, savePicks, SAVE_DAYS, sweepExpired } from "@/lib/branchSave";

/**
 * 読者の選択で展開が変わる文章。
 *
 * 選ぶたびに前の場面は消さず、選んだ選択肢を小さく残して下に続けていく。
 * 読み終えたあとに、自分がたどった道筋をそのまま読み返せるようにするため。
 *
 * フラグは「場面に入ったときの値」を1歩ごとに覚えておく。
 * 戻るときはその歩を捨てるだけで、フラグも選ぶ前の状態に戻る。
 *
 * saveKey があるとき（[save] を書いた分岐を公開ページで開いたとき）は、
 * 選ぶたびに読者のブラウザへ記録し、次に開いたときは黙って続きを表示する。
 */

/** {=名前} を表示するときに使う、その時点のフラグ */
const VarsContext = createContext<Vars>({});

export function BranchStory({
  story,
  debug = false,
  saveKey,
}: {
  story: Story;
  debug?: boolean;
  /** 途中保存の記録名。なければ保存しない */
  saveKey?: string;
}) {
  const [path, setPath] = useState<BranchStep[]>(() => firstPath(story));
  const lastRef = useRef<HTMLDivElement>(null);
  /** 読者が選んだ・戻ったときだけ、新しい場面へ視線を移す（続きを復元したときは動かさない） */
  const moved = useRef(false);

  // 歩ごとに「表示するもの」と「場面を出るときのフラグ」を計算する
  const runs = useMemo(
    () =>
      path.map((step) => {
        const scene = story.scenes[step.scene];
        return scene ? { scene, ...runScene(scene, step.enter) } : null;
      }),
    [path, story]
  );

  // 保存しておいた続きを復元する。
  // サーバーで作るページは最初の場面の状態なので、表示されたあとにブラウザ側で差し替える
  useEffect(() => {
    if (!saveKey) return;
    sweepExpired();
    const picks = loadPicks(saveKey, story.start);
    if (!picks?.length) return;
    const restored = replay(story, picks);
    // 台本が直されて途中までしか選び直せなかったら、記録もそこまでに縮める
    if (restored.length - 1 !== picks.length) savePicks(saveKey, story.start, picksOf(restored));
    if (restored.length > 1) setPath(restored);
  }, [saveKey, story]);

  // 新しい場面が出たら、そこへ視線と読み上げの位置を移す
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const el = lastRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    el.focus({ preventScroll: true });
  }, [path]);

  const go = (next: BranchStep[]) => {
    if (next === path) return;
    moved.current = true;
    setPath(next);
    if (saveKey) savePicks(saveKey, story.start, picksOf(next));
  };

  const choose = (choice: BranchChoice, leaving: Vars) => go(advance(path, choice, leaving));
  const back = () => go(retreat(path));
  const restart = () => {
    if (saveKey) clearPicks(saveKey);
    go(firstPath(story));
  };

  return (
    <section className="branch" aria-label="選んで読み進める文章">
      {path.map((step, i) => {
        const run = runs[i];
        if (!run) return null;

        const isLast = i === path.length - 1;

        // 行き先の壊れた選択肢は読者には出さない（下書きプレビューで警告する）
        const choices = run.scene.choices
          .filter((c) => story.scenes[c.target])
          .map((c) => ({ choice: c, ...choiceState(c, run.after) }))
          .filter((c) => c.state !== "hidden");

        const isEnding = choices.length === 0 || path.length >= MAX_STEPS;
        // 選択肢はあるのに、すべて押せない（書き手の想定外で行き詰まった）
        const isStuck = !isEnding && choices.every((c) => c.state === "locked");

        return (
          <div
            key={i}
            className="branch-scene"
            ref={isLast ? lastRef : undefined}
            tabIndex={isLast ? -1 : undefined}
          >
            {run.view.map((item, j) => (
              <SceneItem key={j} item={item} />
            ))}

            {/* 通り過ぎた場面には、選んだものだけを残す */}
            {!isLast && step.chosen && (
              <p className="branch-trail">
                <span className="sr-only">選んだもの：</span>
                <VarsContext.Provider value={run.after}>
                  <Inline text={step.chosen} links={false} />
                </VarsContext.Provider>
              </p>
            )}

            {isLast && !isEnding && (
              <VarsContext.Provider value={run.after}>
                <ul className="branch-choices" aria-label="選択肢">
                  {choices.map(({ choice, ...state }, k) => (
                    <li key={k}>
                      {state.state === "open" ? (
                        <button type="button" onClick={() => choose(choice, run.after)}>
                          {/* ボタンの中にリンクは置けないので、リンクは文字だけにする */}
                          <Inline text={choice.label} links={false} />
                        </button>
                      ) : (
                        <button type="button" className="is-locked" disabled>
                          <Inline text={choice.label} links={false} />
                          {state.state === "locked" && state.message && (
                            <span className="branch-lock-reason">
                              <Inline text={state.message} links={false} />
                            </span>
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </VarsContext.Provider>
            )}

            {isLast && (isEnding || isStuck) && (
              <div className="branch-end">
                {/* 画面には出さず、読み上げのときだけ結末だと伝える */}
                {isEnding && <p className="sr-only">おわり</p>}
                <div className="branch-end-actions">
                  <button type="button" onClick={restart}>
                    最初から読む
                  </button>
                  {path.length > 1 && (
                    <button type="button" onClick={back}>
                      ひとつ前に戻る
                    </button>
                  )}
                </div>
              </div>
            )}

            {isLast && !isEnding && !isStuck && path.length > 1 && (
              <button type="button" className="branch-back" onClick={back}>
                ひとつ前に戻る
              </button>
            )}

            {isLast && debug && (story.flags.length > 0 || story.save) && (
              <FlagPanel
                scene={run.scene.id}
                flags={story.flags}
                vars={run.after}
                save={story.save}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}

/* --------------------------------------------------------------------------
   下書きプレビューでだけ出す、フラグの状態
   -------------------------------------------------------------------------- */

function FlagPanel({
  scene,
  flags,
  vars,
  save,
}: {
  scene: string;
  flags: string[];
  vars: Vars;
  save: boolean;
}) {
  return (
    <details className="branch-debug" open>
      <summary>分岐の状態（プレビューでだけ表示されます）</summary>
      <p className="branch-debug-scene">いまの場面：{scene}</p>
      {save && (
        <p className="branch-debug-scene">
          途中保存：あり（公開ページで、最後に選んでから{SAVE_DAYS}日間。プレビューでは保存しません）
        </p>
      )}
      {flags.length > 0 && (
        <dl>
          {flags.map((name) => {
            const v = valueOf(vars, name);
            return (
              <div key={name} className={v !== 0 ? "is-on" : undefined}>
                <dt>{name}</dt>
                <dd>{v}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </details>
  );
}

/* --------------------------------------------------------------------------
   場面の中身
   -------------------------------------------------------------------------- */

function SceneItem({ item }: { item: SceneViewItem }) {
  return (
    <VarsContext.Provider value={item.vars}>
      <SceneNode node={item.node} />
    </VarsContext.Provider>
  );
}

function SceneNode({ node }: { node: SceneViewItem["node"] }) {
  switch (node.kind) {
    case "text":
      return (
        <p className="branch-text">
          <Lines lines={node.lines} />
        </p>
      );

    case "quote":
      return (
        <blockquote>
          <p>
            <Lines lines={node.lines} />
          </p>
        </blockquote>
      );

    case "heading": {
      const Tag = node.level === 2 ? "h2" : "h3";
      return (
        <Tag>
          <Inline text={node.text} />
        </Tag>
      );
    }

    case "hr":
      return <hr />;

    case "list": {
      const Tag = node.ordered ? "ol" : "ul";
      return (
        <Tag>
          {node.items.map((item, k) => (
            <li key={k}>
              <Inline text={item.text} />
            </li>
          ))}
        </Tag>
      );
    }

    case "image":
      return (
        <figure>
          {/* microCMS 以外の画像も貼れるよう、Next.js の Image ではなく img を使う */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={node.src} alt={node.alt} loading="lazy" decoding="async" />
          {node.caption && (
            <figcaption>
              <Inline text={node.caption} />
            </figcaption>
          )}
        </figure>
      );
  }
}

/** 改行をそのまま改行として出す */
function Lines({ lines }: { lines: BranchLine[] }) {
  return (
    <>
      {lines.map((line, k) => (
        <Fragment key={k}>
          {k > 0 && <br />}
          <Inline text={line.text} />
        </Fragment>
      ))}
    </>
  );
}

/* --------------------------------------------------------------------------
   文中の記号
   -------------------------------------------------------------------------- */

const SIZE_CLASS = {
  xs: "text-xs",
  s: "text-s",
  l: "text-l",
  xl: "text-xl",
  xxl: "text-xxl",
} as const;

function Inline({ text, links = true }: { text: string; links?: boolean }) {
  const vars = useContext(VarsContext);
  return <>{renderInline(parseInline(text).nodes, links, vars)}</>;
}

function renderInline(nodes: InlineNode[], links: boolean, vars: Vars): ReactNode[] {
  return nodes.map((n, k) => {
    switch (n.t) {
      case "text":
        return <Fragment key={k}>{n.v}</Fragment>;
      case "var":
        // 1000 → 1,000 のように桁を区切る
        return <Fragment key={k}>{valueOf(vars, n.name).toLocaleString("ja-JP")}</Fragment>;
      case "strong":
        return <strong key={k}>{renderInline(n.c, links, vars)}</strong>;
      case "em":
        return <em key={k}>{renderInline(n.c, links, vars)}</em>;
      case "size":
        return (
          <span key={k} className={SIZE_CLASS[n.size]}>
            {renderInline(n.c, links, vars)}
          </span>
        );
      case "link": {
        if (!links) return <Fragment key={k}>{renderInline(n.c, links, vars)}</Fragment>;
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a
            key={k}
            href={n.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderInline(n.c, links, vars)}
          </a>
        );
      }
    }
  });
}
