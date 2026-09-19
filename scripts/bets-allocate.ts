/**
 * 買い目の金額の割り方と、当たれば必ずプラスになるかの判定を出す入口。
 *
 *   pnpm bets:allocate -- --odds 12.3,18.4,25.0 [--budget 2000]
 *
 * オッズはレース当日の午前のもので、候補の組み合わせを優先する順に並べて渡す。ワイドと
 * 複勝のように幅で出るものは下限を渡す。先頭から1つずつ足していき、どれが当たっても払戻が
 * 予算を上回る範囲で何点まで買えるかと、そのときの金額を JSON で標準出力へ出す
 * （docs/agent-design.md の「5. 買い目を組む」）。
 *
 * 終了コードは、1点以上買えるときが 0、先頭の1点だけでも予算を上回らないときと引数の誤りが 1。
 *
 * **DB へは書かない。** 出た金額で `ai_bets` に入れるところまでは plan-bets の手順で行う。
 */

import { maxProfitableCount, parseAllocateArgs } from "../lib/bets/index.ts";

const USAGE = [
  "使い方:",
  "  pnpm bets:allocate -- --odds <オッズ,オッズ,...> [--budget <予算>]",
  "",
  "  --odds    候補の組み合わせごとのオッズ。優先する順にカンマで区切る",
  "  --budget  予算。省けば 2000",
].join("\n");

try {
  const args = parseAllocateArgs(process.argv.slice(2));
  const result = maxProfitableCount(args.odds, args.budget);

  if (result === null) {
    process.stderr.write(
      `先頭の1点だけでも、当たったときの払戻が予算 ${args.budget}円を上回らない。\n`,
    );
    process.exitCode = 1;
  } else {
    const combinations = result.allocation.amounts.map((amount, index) => ({
      order: index + 1,
      odds: args.odds[index],
      amount,
      payout: result.allocation.payouts[index],
    }));
    process.stdout.write(
      `${JSON.stringify(
        {
          budget: args.budget,
          candidates: args.odds.length,
          count: result.count,
          minPayout: result.allocation.minPayout,
          combinations,
        },
        null,
        2,
      )}\n`,
    );
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
  process.exitCode = 1;
}
