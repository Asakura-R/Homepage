import type { Article } from "@/lib/microcms";
import { parseBranch } from "@/lib/branch";
import { enhanceBody } from "@/lib/format";
import { BranchStory } from "./BranchStory";

/**
 * 記事本文。
 *
 * 1. 従来の本文（content）を表示
 * 2. 続けて、ブロック（blocks）を上から順に表示
 *
 * 過去の記事は content だけなので、これまで通りに表示される。
 * 分岐を使う記事は blocks に「本文」と「分岐」を交互に積んでいく。
 *
 * showIssues が true のとき（/preview で開いたとき）だけ、分岐の書き間違いと
 * フラグの状態を表示する。
 */
export function ArticleBody({
  article,
  showIssues = false,
}: {
  article: Article;
  showIssues?: boolean;
}) {
  return (
    <div className="prose">
      {article.content && (
        <div dangerouslySetInnerHTML={{ __html: enhanceBody(article.content) }} />
      )}

      {article.blocks?.map((block, i) => {
        if (block.fieldId === "textBlock") {
          if (!block.body) return null;
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: enhanceBody(block.body) }} />
          );
        }

        if (block.fieldId === "branchBlock") {
          const story = parseBranch(block.script);
          const issues = [...story.errors, ...story.warnings];

          return (
            <div key={i}>
              {showIssues && issues.length > 0 && (
                <div className="branch-issues" role="note">
                  <p>分岐の確認事項（プレビューでだけ表示されます）</p>
                  <ul>
                    {story.errors.map((e) => (
                      <li key={e} className="is-error">{e}</li>
                    ))}
                    {story.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {story.start && <BranchStory story={story} debug={showIssues} />}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
