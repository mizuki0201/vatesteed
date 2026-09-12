/**
 * 分析する役と `verifier` の返答に、実行確認がそろっているかを見る入口。
 *
 *   pnpm analysis:confirm -- --kind horse --response <返答のファイル>
 *   pnpm analysis:confirm -- --kind horse --kind pedigree --kind entry --response <path>
 *
 * 一般ルールと参考例を読んだことは、返答の保存しない側へ決まった形で残す
 * （docs/analysis-quality.md の「実行時の確認」）。**そろっていない返答は保存しない。**
 * 血統分析では、保存部分に材料不足の報告や一般的な注意事項が入っていないことも見る。
 * 事実と読みのつながりや分析の深さは `verifier` が見る。
 */

import { readFile } from "node:fs/promises";
import {
  checkExecutionConfirmations,
  parseAnalysisConfirmationArgs,
} from "../lib/analysis-confirmation/index.ts";

const USAGE = [
  "使い方:",
  "  pnpm analysis:confirm -- --kind <horse|pedigree|entry> --response <path>",
  "",
  "  --kind      その返答で担当した分析の種類。verifier のように複数あるなら繰り返す",
  "  --response  返答を保存したファイル",
].join("\n");

try {
  const args = parseAnalysisConfirmationArgs(process.argv.slice(2));
  const result = checkExecutionConfirmations({
    kinds: args.kinds,
    response: await readFile(args.responsePath, "utf8"),
  });

  if (result.ok) {
    process.stdout.write("実行確認あり。保存してよい。\n");
  } else {
    process.stdout.write(
      `${["保存しない。理由:", ...result.problems.map((problem) => `- ${problem}`)].join("\n")}\n`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
  process.exitCode = 1;
}
