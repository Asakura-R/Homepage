"use client";

import { useEffect, useRef, useState } from "react";
import type { BranchStory as Story } from "@/lib/branch";

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
            {scene.paragraphs.map((p, j) =>
              p.kind === "quote" ? (
                <blockquote key={j}>
                  <p>{p.text}</p>
                </blockquote>
              ) : (
                <p key={j} className="branch-text">
                  {p.text}
                </p>
              )
            )}

            {/* 通り過ぎた場面には、選んだものだけを残す */}
            {!isLast && step.chosen && (
              <p className="branch-trail">
                <span className="sr-only">選んだもの：</span>
                {step.chosen}
              </p>
            )}

            {isLast && !isEnding && (
              <ul className="branch-choices" aria-label="選択肢">
                {choices.map((c) => (
                  <li key={c.label + c.target}>
                    <button type="button" onClick={() => choose(c.label, c.target)}>
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isLast && isEnding && (
              <div className="branch-end">
                <p className="branch-end-mark"></p>
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
