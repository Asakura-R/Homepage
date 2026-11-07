"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { BranchNode, BranchStory as Story } from "@/lib/branch";
import { parseInline } from "@/lib/branchInline";
import type { InlineNode } from "@/lib/branchInline";

/**
 * 読者の選択で展開が変わる文章。
 *
 * 選ぶたびに前の場面は消さず、選んだ選択肢を小さく残して下に続けていく。
 * 読み終えたあとに、自分がたどった道筋をそのまま読み返せるようにするため。
 */

/** 同じ場面を行き来する構成でも、際限なく伸びないようにする */
const MAX_STEPS = 60;

type Step = { scene: string; chosen?: string };

export function BranchStory({ story }: { story: Story }) {
  const [path, setPath] = useState<Step[]>([{ scene: story.start }]);
  const lastRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

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

  const choose = (label: string, target: string) => {
    setPath((prev) => {
      if (prev.length >= MAX_STEPS) return prev;
      const next = prev.slice(0, -1);
      next.push({ ...prev[prev.length - 1], chosen: label });
      next.push({ scene: target });
      return next;
    });
  };

  const back = () => {
    setPath((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      next[next.length - 1] = { scene: next[next.length - 1].scene };
      return next;
    });
  };

  const restart = () => setPath([{ scene: story.start }]);

  return (
    <section className="branch" aria-label="選んで読み進める文章">
      <p className="branch-label"></p>

      {path.map((step, i) => {
        const scene = story.scenes[step.scene];
        if (!scene) return null;

        const isLast = i === path.length - 1;
        // 行き先の壊れた選択肢は読者には出さない（下書きプレビューで警告する）
        const choices = scene.choices.filter((c) => story.scenes[c.target]);
        const isEnding = choices.length === 0 || path.length >= MAX_STEPS;

        return (
          <div
            key={i}
            className="branch-scene"
            ref={isLast ? lastRef : undefined}
            tabIndex={isLast ? -1 : undefined}
          >
            {scene.nodes.map((node, j) => (
              <SceneNode key={j} node={node} />
            ))}

            {/* 通り過ぎた場面には、選んだものだけを残す */}
            {!isLast && step.chosen && (
              <p className="branch-trail">
                <span className="sr-only">選んだもの：</span>
                <Inline text={step.chosen} links={false} />
              </p>
            )}

            {isLast && !isEnding && (
              <ul className="branch-choices" aria-label="選択肢">
                {choices.map((c) => (
                  <li key={c.label + c.target}>
                    <button type="button" onClick={() => choose(c.label, c.target)}>
                      {/* ボタンの中にリンクは置けないので、リンクは文字だけにする */}
                      <Inline text={c.label} links={false} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isLast && isEnding && (
              <div className="branch-end">
                <p className="branch-end-mark">おわり</p>
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

            {isLast && !isEnding && path.length > 1 && (
              <button type="button" className="branch-back" onClick={back}>
                ひとつ前に戻る
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* --------------------------------------------------------------------------
   場面の中身
   -------------------------------------------------------------------------- */

function SceneNode({ node }: { node: BranchNode }) {
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
              <Inline text={item} />
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
function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, k) => (
        <Fragment key={k}>
          {k > 0 && <br />}
          <Inline text={line} />
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
  return <>{renderInline(parseInline(text).nodes, links)}</>;
}

function renderInline(nodes: InlineNode[], links: boolean): ReactNode[] {
  return nodes.map((n, k) => {
    switch (n.t) {
      case "text":
        return <Fragment key={k}>{n.v}</Fragment>;
      case "strong":
        return <strong key={k}>{renderInline(n.c, links)}</strong>;
      case "em":
        return <em key={k}>{renderInline(n.c, links)}</em>;
      case "size":
        return (
          <span key={k} className={SIZE_CLASS[n.size]}>
            {renderInline(n.c, links)}
          </span>
        );
      case "link": {
        if (!links) return <Fragment key={k}>{renderInline(n.c, links)}</Fragment>;
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a
            key={k}
            href={n.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderInline(n.c, links)}
          </a>
        );
      }
    }
  });
}
