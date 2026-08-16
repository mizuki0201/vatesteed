import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";
import { recoveryRate } from "../bets/index.ts";

/**
 * 成績と回収率。
 *
 * **回収率の計算は [lib/bets](../bets/) の `recoveryRate` を使う。** 画面で式を書き直すと、
 * 返還の扱いが2箇所に分かれる。
 *
 * AI と自分は別のテーブル（`ai_bets` / `my_bets`）で、**混ぜずに別々に測る**
 * （[docs/data-model.md](../../docs/data-model.md)）。
 */

export type ResultsOwner = "ai" | "mine";

export type ResultsTotal = {
  readonly betCount: number;
  readonly raceCount: number;
  /** 結果がまだ入っていない買い目の数。回収率の分母には入るが、払戻が未確定。 */
  readonly pendingCount: number;
  readonly totalAmount: number;
  readonly returnedAmount: number;
  /** 買い目が1つも無ければ `null`。0除算を画面に持ち込まない。 */
  readonly recoveryRate: number | null;
};

export type ResultsRace = {
  readonly raceId: string | null;
  readonly raceDate: string | null;
  readonly raceName: string | null;
  readonly betCount: number;
  readonly totalAmount: number;
  readonly returnedAmount: number;
  readonly recoveryRate: number | null;
  readonly settled: boolean;
};

function tableOf(owner: ResultsOwner): string {
  return owner === "ai" ? "ai_bets" : "my_bets";
}

async function guard(owner: ResultsOwner): Promise<void> {
  await assertCan(owner === "ai" ? "results.ai" : "results.mine");
}

/** 全体の合計。 */
export async function getResultsTotal(owner: ResultsOwner): Promise<ResultsTotal> {
  await guard(owner);

  const { rows } = await query(
    `SELECT count(*) AS bet_count,
            count(DISTINCT race_id) AS race_count,
            count(*) FILTER (WHERE payout IS NULL AND refund IS NULL) AS pending_count,
            coalesce(sum(total_amount), 0) AS total_amount,
            coalesce(sum(coalesce(payout, 0) + coalesce(refund, 0)), 0) AS returned_amount
       FROM ${tableOf(owner)}`,
  );

  const row = rows[0] ?? {};
  const totalAmount = Number(row.total_amount ?? 0);
  const returnedAmount = Number(row.returned_amount ?? 0);

  return {
    betCount: Number(row.bet_count ?? 0),
    raceCount: Number(row.race_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    totalAmount,
    returnedAmount,
    recoveryRate:
      totalAmount === 0
        ? null
        : recoveryRate({ payout: returnedAmount, refund: 0, totalAmount }),
  };
}

/** レースごとの内訳。新しい順。 */
export async function listResultsByRace(owner: ResultsOwner): Promise<readonly ResultsRace[]> {
  await guard(owner);

  const { rows } = await query(
    `SELECT b.race_id, r.race_date, r.race_name,
            count(*) AS bet_count,
            coalesce(sum(b.total_amount), 0) AS total_amount,
            coalesce(sum(coalesce(b.payout, 0) + coalesce(b.refund, 0)), 0) AS returned_amount,
            bool_and(b.payout IS NOT NULL OR b.refund IS NOT NULL) AS settled
       FROM ${tableOf(owner)} b
       LEFT JOIN races r ON r.id = b.race_id
      GROUP BY b.race_id, r.race_date, r.race_name
      ORDER BY r.race_date DESC NULLS LAST`,
  );

  return rows.map((row) => {
    const totalAmount = Number(row.total_amount);
    const returnedAmount = Number(row.returned_amount);

    return {
      raceId: row.race_id === null ? null : String(row.race_id),
      raceDate: row.race_date === null ? null : String(row.race_date),
      raceName: (row.race_name as string | null) ?? null,
      betCount: Number(row.bet_count),
      totalAmount,
      returnedAmount,
      recoveryRate:
        totalAmount === 0
          ? null
          : recoveryRate({ payout: returnedAmount, refund: 0, totalAmount }),
      settled: Boolean(row.settled),
    };
  });
}
