/**
 * `horse-analyst` の返答から、馬のまとめへ反映する項目を取り出す。
 *
 * 役は返答を「保存する本文」と「保存しないメモ」に分けて返す
 * （`docs/agent-design.md` の「返し方の形」）。振り返りのあとは、保存する本文へ結論が変わった
 * 項目だけを `##` の見出しで並べる。ここではその見出しと中身を読み取るだけで、
 * どれを反映するかは決めない。
 */

import {
  checkExecutionConfirmations,
  splitAnalysisResponse,
} from "../analysis-confirmation/index.ts";
import {
  buildHorseSummary,
  mergeHorseSummary,
  needsAgreementBeforeUpdate,
  type HorseSummaryMerge,
  type HorseSummaryUpdate,
} from "./horse-summary.ts";

/**
 * 変わる項目が無いときに、役が「保存する本文」へ書く言葉。
 *
 * **見出しが1つも無いことと、変わる項目が無いことは別。** 前者は返答の形が崩れているので
 * 書き込まないが、後者は正しい結果で、書き込まないまま次へ進んでよい。
 */
export const NO_CHANGE_TEXT = "変更なし";

export type HorseSummaryUpdatesParse =
  | { readonly state: "updated"; readonly updates: readonly HorseSummaryUpdate[] }
  | { readonly state: "unchanged" }
  | { readonly state: "blocked"; readonly reasons: readonly string[] };

const SECTION_HEADING = /^##\s+(.+?)\s*$/;

/** 返答の「保存する本文」から、`##` の見出しごとの中身を読む。 */
export function parseHorseSummaryUpdates(response: string): HorseSummaryUpdatesParse {
  const parts = splitAnalysisResponse(response);

  if (!parts.hasSaved) {
    return { state: "blocked", reasons: ["返答に「保存する本文」の見出しが無い"] };
  }

  if (parts.saved.trim().replace(/^[-*]\s+/, "").replace(/。$/, "") === NO_CHANGE_TEXT) {
    return { state: "unchanged" };
  }

  const updates: { heading: string; lines: string[] }[] = [];

  for (const line of parts.saved.split("\n")) {
    const matched = SECTION_HEADING.exec(line);

    if (matched === null) {
      if (updates.length > 0) updates[updates.length - 1].lines.push(line);
      continue;
    }

    updates.push({ heading: matched[1], lines: [] });
  }

  if (updates.length === 0) {
    return {
      state: "blocked",
      reasons: [
        `保存する本文に \`##\` の項目が無い（変わる項目が無いなら「${NO_CHANGE_TEXT}」とだけ書く）`,
      ],
    };
  }

  return {
    state: "updated",
    updates: updates.map((update) => ({
      heading: update.heading,
      body: update.lines.join("\n").trim(),
    })),
  };
}

export type ApplyHorseSummaryInput = {
  /** 既にある `horse_notes.body`。まだ無い馬では省く。 */
  readonly currentBody?: string;
  /** 既にある `horse_notes.author`。まだ無い馬では省く。 */
  readonly author?: string;
  readonly response: string;
};

/** まとめを作った結果。変わる項目が無かった場合を、書き換えないことと分けて返す。 */
export type HorseSummaryOutcome = HorseSummaryMerge | { readonly state: "unchanged" };

/**
 * 返答を既存のまとめへ反映した本文を作る。
 *
 * - **実行確認が無い返答は使わない。** 一般ルールと参考例を読んだことが確かめられないまま
 *   まとめを書き換えられる経路を残さないため（`docs/analysis-quality.md` の「実行時の確認」）
 * - `author` が「人間」「対話」なら、合意を取る前に書き換えないので、ここで止める
 * - 既にある馬は、返された項目だけを差し替える
 * - まだ無い馬は、返された項目を初回のまとめとして組む
 * - 変わる項目が無ければ `unchanged` を返す。**書き込まないことが正しい結果**なので、
 *   書き換えられない場合と混ぜない
 */
export function applyHorseSummaryResponse(
  input: ApplyHorseSummaryInput,
): HorseSummaryOutcome {
  const confirmation = checkExecutionConfirmations({
    kinds: ["horse"],
    response: input.response,
  });

  if (!confirmation.ok) {
    return { state: "blocked", reasons: confirmation.problems };
  }

  const author = input.author?.trim() ?? "";

  if (author !== "" && needsAgreementBeforeUpdate(author)) {
    return {
      state: "blocked",
      reasons: [
        `author が「${author}」の horse_notes は自動更新しない。` +
          "変更前・変更後・変わる理由を並べて対話へ返す",
      ],
    };
  }

  const parsed = parseHorseSummaryUpdates(input.response);
  if (parsed.state === "blocked") return parsed;

  const currentBody = input.currentBody?.trim() ?? "";

  if (parsed.state === "unchanged") {
    return currentBody === ""
      ? {
          state: "blocked",
          reasons: [
            `まだまとめが無い馬に「${NO_CHANGE_TEXT}」は返せない。` +
              "現在までの全材料から初回のまとめを作る",
          ],
        }
      : { state: "unchanged" };
  }

  return currentBody === ""
    ? buildHorseSummary(parsed.updates)
    : mergeHorseSummary(input.currentBody ?? "", parsed.updates);
}

export type HorseSummaryArgs = {
  /** 既にある本文のファイル。無ければ初回のまとめとして組む。 */
  readonly currentPath?: string;
  /** `horse-analyst` の返答を保存したファイル。 */
  readonly responsePath: string;
  /** 既にある `horse_notes.author`。まだ無い馬では `AI`。 */
  readonly author: string;
};

/**
 * `pnpm horse:summary` の引数を読む。おかしな引数はすべて例外にする。
 *
 * 先頭の `--` は落とす。`pnpm <script> -- --response ...` の区切りがそのまま渡ってくるため。
 */
export function parseHorseSummaryArgs(rawArgv: readonly string[]): HorseSummaryArgs {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  let currentPath: string | undefined;
  let responsePath: string | undefined;
  let author: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    const take = (name: string): string => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${name} の値がありません。`);
      }
      index++;
      return value;
    };

    switch (arg) {
      case "--current":
        currentPath = take("--current");
        break;
      case "--response":
        responsePath = take("--response");
        break;
      case "--author":
        author = take("--author");
        break;
      default:
        throw new Error(`知らない引数です: ${arg}`);
    }
  }

  if (responsePath === undefined) throw new Error("--response がありません。");
  if (author === undefined) throw new Error("--author がありません。");

  return { currentPath, responsePath, author };
}
