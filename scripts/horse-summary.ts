/**
 * 馬のまとめを項目単位で差し替える入口。
 *
 *   pnpm horse:summary -- --response <返答のファイル> --author <author> [--current <既存本文のファイル>]
 *
 * `horse-analyst` の返答をそのまま渡すと、変更対象外の項目を保ったままの本文を標準出力へ出す。
 * `--current` を省くと、`horse_notes` がまだ無い馬の初回のまとめとして組む。
 *
 * **返答に馬の総合分析の実行確認が無ければ本文を作らない。** `pnpm analysis:confirm` を飛ばして
 * まとめを書き換えられる経路を残さないため（docs/analysis-quality.md の「実行時の確認」）。
 *
 * 終了コードは、本文を出したときと変わる項目が無かったときが 0、書き換えないときが 1。
 * **変わる項目が無いのは正しい結果**なので、書き換えられない場合と分ける。
 *
 * **DB へは書かない。** 出てきた本文を `pnpm db:query --file` で書き込むところまでは、
 * 振り返りの手順（docs/agent-design.md の「検証して馬の差分を反映する」）に従って進行役が行う。
 * 反映してよいかを決めるのは検証のあとなので、ここでまとめて書き込む形にしない。
 */

import { readFile } from "node:fs/promises";
import {
  applyHorseSummaryResponse,
  parseHorseSummaryArgs,
} from "../lib/horse-summary/index.ts";

const USAGE = [
  "使い方:",
  "  pnpm horse:summary -- --response <path> --author <author> [--current <path>]",
  "",
  "  --response  horse-analyst の返答を保存したファイル",
  "  --author    既にある horse_notes の author。まだ無い馬は AI",
  "  --current   既にある horse_notes の body を保存したファイル。省くと初回のまとめを組む",
].join("\n");

try {
  const args = parseHorseSummaryArgs(process.argv.slice(2));
  const result = applyHorseSummaryResponse({
    response: await readFile(args.responsePath, "utf8"),
    currentBody:
      args.currentPath === undefined ? undefined : await readFile(args.currentPath, "utf8"),
    author: args.author,
  });

  if (result.state === "blocked") {
    process.stderr.write(
      `${["書き換えない。理由:", ...result.reasons.map((reason) => `- ${reason}`)].join("\n")}\n`,
    );
    process.exitCode = 1;
  } else if (result.state === "unchanged") {
    process.stderr.write("変わる項目が無い。このまま書き込まずに進んでよい。\n");
  } else {
    process.stderr.write(
      `入れ替えた項目: ${result.replaced.join("、") || "なし"} / ` +
        `足した項目: ${result.added.join("、") || "なし"}\n`,
    );
    process.stdout.write(result.body);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
  process.exitCode = 1;
}
