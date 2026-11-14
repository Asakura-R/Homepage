"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { choiceState, runScene } from "@/lib/branch";
import type { BranchChoice, BranchLine, BranchStory as Story, SceneViewItem } from "@/lib/branch";
import { applyEffects, valueOf } from "@/lib/branchLogic";
import type { Vars } from "@/lib/branchLogic";
import { parseInline } from "@/lib/branchInline";
import type { InlineNode } from "@/lib/branchInline";

/**
 * 読者の選択で展開が変わる文章。
 *
 * 選ぶたびに前の場面は消さず、選んだ選択肢を小さく残して下に続けていく。
 * 読み終えたあとに、自分がたどった道筋をそのまま読み返せるようにするため。
 *
 * フラグは「場面に入ったときの値」を1歩ごとに覚えておく。
 * 戻るときはその歩を捨てるだけで、フラグも選ぶ前の状態に戻る。
 */

/** 同じ場面を行き来する構成でも、際限なく伸びないようにする */
const MAX_STEPS = 60;

type Step = {
  scene: string;
  /** この場面に入ったときのフラグ */
  enter: Vars;
  /** この場面で選んだ選択肢の表示文（通り過ぎた場面にだけある） */
  chosen?: string;
};

/** {=名前} を表示するときに使う、その時点のフラグ */
const VarsContext = createContext<Vars>({});

export function BranchStory({ story, debug = false }: { story: Story; debug?: boolean }) {
  const first = (): Step[] => [{ scene: story.start, enter: {} }];
  const [path, setPath] = useState<Step[]>(first);
  const lastRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // 歩ごとに「表示するもの」と「場面を出るときのフラグ」を計算する
  const runs = useMemo(
    () =>
      path.map((step) => {
        const scene = story.scenes[step.scene];
        return scene ? { scene, ...runScene(scene, step.enter) } : null;
      }),
    [path, story]
  );

  // 新しい場面が出たら、そこへ視線と読み上げの位置を移す
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = lastRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    el.focus({ preventScroll: true });
  }, [path.length]);

  const choose = (choice: BranchChoice, leaving: Vars) => {
    setPath((prev) => {
      if (prev.length >= MAX_STEPS) return prev;
      const next = prev.slice(0, -1);
      next.push({ ...prev[prev.length - 1], chosen: choice.label });
      next.push({ scene: choice.target, enter: applyEffects(choice.effects, leaving) });
      return next;
    });
  };

  const back = () => {
    setPath((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      const last = next[next.length - 1];
      next[next.length - 1] = { scene: last.scene, enter: last.enter };
      return next;
    });
  };

  const restart = () => setPath(first());

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
                {isEnding && <p className="branch-end-mark">おわり</p>}
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

            {isLast && debug && story.flags.length > 0 && (
              <FlagPanel scene={run.scene.id} flags={story.flags} vars={run.after} />
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

function FlagPanel({ scene, flags, vars }: { scene: string; flags: string[]; vars: Vars }) {
  return (
    <details className="branch-debug" open>
      <summary>フラグの状態（プレビューでだけ表示されます）</summary>
      <p className="branch-debug-scene">いまの場面：{scene}</p>
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
