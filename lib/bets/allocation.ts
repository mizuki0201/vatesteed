/**
 * 予算を組み合わせへ割る計算と、当たれば必ずプラスになるかの判定。
 *
 * 買い目はレース当日の午前のオッズを見て組み、どれが当たっても払戻がほぼ同じになるように
 * 金額を割る。当たっても予算を上回らない組み合わせの集まりは買わない（docs/agent-design.md の
 * 「5. 買い目を組む」、docs/data-model.md の「金額の割り方」）。
 *
 * ここはオッズを受け取って数字を返すだけで、どの組み合わせを候補にするか、どの順に並べるかは
 * 決めない。それは予想の中身から決める判断で、呼ぶ側（plan-bets）の仕事。
 *
 * オッズは倍率で渡す（7.1倍なら 7.1）。JRA のオッズは0.1倍刻みなので、それ以外は受け付けない。
 * ワイドと複勝のように幅で出るものは、幅の下限を渡す。
 */

/** 馬券の最小単位。金額はこの倍数で置く。 */
const UNIT = 100;

export type EvenPayoutAllocation = {
  /** 組み合わせごとに置く金額。渡したオッズと同じ順。100円単位 */
  amounts: number[];
  /** それぞれが当たったときの払戻 */
  payouts: number[];
  /** 払戻のうち最も小さいもの */
  minPayout: number;
  /** 金額の合計。予算と同じ */
  totalAmount: number;
};

/**
 * 100円あたりの払戻。オッズ×100円。
 *
 * オッズに浮動小数点の誤差があっても、0.1倍刻みに丸めてから掛ける。
 */
export function payoutPerUnit(odds: number): number {
  if (!Number.isFinite(odds) || odds < 1) {
    throw new Error(`オッズは1.0倍以上で指定してください（${odds}）。`);
  }
  const tenths = Math.round(odds * 10);
  if (Math.abs(odds * 10 - tenths) > 1e-6) {
    throw new Error(`オッズは0.1倍刻みで指定してください（${odds}）。`);
  }
  return tenths * 10;
}

/**
 * 予算を、どれが当たっても払戻がほぼ同じになるように割る。
 *
 * 1. すべての組み合わせに100円ずつ置く
 * 2. 残りの予算を100円ずつ、いま最も払戻が小さい組み合わせへ足していく。並んだら先に渡された方へ
 *
 * これで最も小さい払戻が最大になる。配当の低い組み合わせほど厚く、高い組み合わせほど薄くなる。
 * **予算は余らせない。** 合計は必ず予算と同じになる。
 *
 * 払戻が予算を上回るかどうかはここでは見ない。見るのは {@link maxProfitableCount}。
 *
 * @param odds 組み合わせごとのオッズ。優先する順に並べておく
 * @param budget 予算。100円単位
 */
export function allocateEvenPayout(odds: readonly number[], budget: number): EvenPayoutAllocation {
  if (odds.length === 0) {
    throw new Error("組み合わせが1つもありません。");
  }
  assertBudget(budget);
  if (odds.length * UNIT > budget) {
    throw new Error(
      `予算 ${budget}円では ${odds.length}点に100円ずつも置けません。`,
    );
  }

  const perUnit = odds.map(payoutPerUnit);
  const units = odds.map(() => 1);
  let remaining = budget / UNIT - odds.length;

  while (remaining > 0) {
    let lowest = 0;
    for (let i = 1; i < units.length; i++) {
      if (units[i] * perUnit[i] < units[lowest] * perUnit[lowest]) lowest = i;
    }
    units[lowest] += 1;
    remaining -= 1;
  }

  const amounts = units.map((count) => count * UNIT);
  const payouts = units.map((count, i) => count * perUnit[i]);

  return {
    amounts,
    payouts,
    minPayout: Math.min(...payouts),
    totalAmount: budget,
  };
}

/**
 * 候補を先頭から1つずつ足していき、どれが当たっても払戻が予算を上回る範囲で何点まで買えるか。
 *
 * 足すたびに {@link allocateEvenPayout} で割り直し、最も小さい払戻が予算を上回るかを確かめる。
 * **上回らなくなったら、そこで足すのをやめる。** 後ろの候補を飛ばして先を試すことはしない。
 * 候補は優先する順に並んでいるので、後ろの候補のために前の候補を外さない。
 *
 * 先頭の1点だけでも予算を上回らなければ null。
 *
 * @param odds 候補の組み合わせごとのオッズ。優先する順
 * @param budget 予算。100円単位
 * @returns 買える点数（先頭から何点か）と、そのときの配分
 */
export function maxProfitableCount(
  odds: readonly number[],
  budget: number,
): { count: number; allocation: EvenPayoutAllocation } | null {
  // 候補が無くても予算の誤りは先に知らせる。後ろの点数の上限が0になり、検査まで届かなくなるため
  assertBudget(budget);
  let best: { count: number; allocation: EvenPayoutAllocation } | null = null;
  const limit = Math.min(odds.length, Math.floor(budget / UNIT));

  for (let count = 1; count <= limit; count++) {
    const allocation = allocateEvenPayout(odds.slice(0, count), budget);
    if (allocation.minPayout <= budget) break;
    best = { count, allocation };
  }

  return best;
}

/** 予算が100円単位の正の整数でなければ止める。 */
function assertBudget(budget: number): void {
  if (!Number.isInteger(budget) || budget <= 0 || budget % UNIT !== 0) {
    throw new Error("予算は100円単位で指定してください。");
  }
}

/** `pnpm bets:allocate` の引数。 */
export type AllocateArgs = {
  /** 候補の組み合わせごとのオッズ。優先する順 */
  odds: number[];
  /** 予算。省けば 2,000円（docs/agent-design.md の「5. 買い目を組む」） */
  budget: number;
};

/** AI の買い目の予算。恒久の設定で、レースの格や自信度で変えない。 */
export const DEFAULT_BUDGET = 2000;

/**
 * `pnpm bets:allocate -- --odds 12.3,18.4,25.0 [--budget 2000]` の引数を読む。
 *
 * オッズはカンマ区切りで、優先する順に並べる。
 */
export function parseAllocateArgs(rawArgv: readonly string[]): AllocateArgs {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  let odds: number[] | undefined;
  let budget = DEFAULT_BUDGET;

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
      case "--odds":
        odds = take("--odds")
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "")
          .map((part) => {
            const value = Number(part);
            if (!Number.isFinite(value)) throw new Error(`オッズが数字ではありません: ${part}`);
            return value;
          });
        break;
      case "--budget": {
        const raw = take("--budget");
        budget = Number(raw);
        if (!Number.isInteger(budget)) throw new Error(`予算が整数ではありません: ${raw}`);
        break;
      }
      default:
        throw new Error(`知らない引数です: ${arg}`);
    }
  }

  if (odds === undefined || odds.length === 0) throw new Error("--odds がありません。");

  return { odds, budget };
}
