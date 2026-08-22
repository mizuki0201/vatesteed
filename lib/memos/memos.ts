import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";
import { MEMO_STATUSES, type MemoStatus } from "../enums/index.ts";
import { normalizeMemoInput, type MemoInput } from "./input.ts";

/**
 * 外で見かけた話のメモ。
 *
 * **ここに入るのは評価ではなく、まだ確かめていない材料**（docs/data-model.md#memos）。
 * 読んで裏を取ったあとに宛先が決まるので、**このファイルから `*_notes` を書く関数は
 * 作らない**。画面から評価へ直接つながる経路を作らないため。
 */

/** 取り込みを待っているもの。画面の並びと、件数の数え方がこれで決まる。 */
export const PENDING_STATUSES: readonly MemoStatus[] = ["未処理", "保留"];

export type Memo = {
  readonly id: number;
  readonly body: string;
  readonly source: string | null;
  readonly status: MemoStatus;
  readonly verification: string | null;
  readonly outcome: string | null;
  /** `2026-08-22` の形。日本時間の日付。 */
  readonly createdAt: string;
};

/**
 * `created_at` は時間帯を持つ型なので DB から `Date` として返る。画面で見たいのは
 * 「いつ入れたか」なので、日本時間の日付だけにする（`lib/notes` と同じ扱い）。
 */
function toDateText(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

function toMemo(row: Record<string, unknown>): Memo {
  return {
    id: Number(row.id),
    body: String(row.body),
    source: (row.source as string | null) ?? null,
    status: row.status as MemoStatus,
    verification: (row.verification as string | null) ?? null,
    outcome: (row.outcome as string | null) ?? null,
    createdAt: toDateText(row.created_at),
  };
}

/**
 * メモを1つ入れる。**画面から DB を書き換える唯一の経路。**
 *
 * Server Function は画面を通らない POST からも呼べるので、**認証はこの中で確かめる**
 * （node_modules/next/dist/docs の Mutating Data / Data Security）。読む側と同じく、
 * 守りをデータの手前に置く。
 *
 * **分類も宛先も受け取らない。** 決めるのは取り込む側の仕事で、入稿する人に決めさせると
 * そこが手作業として固定される（docs/product.md#やらないこと）。
 */
export async function recordMemo(input: {
  readonly body: unknown;
  readonly source?: unknown;
}): Promise<MemoInput> {
  await assertCan("memos");

  const normalized = normalizeMemoInput(input.body, input.source);

  if (!normalized.ok) return normalized;

  await query(`INSERT INTO memos (body, source) VALUES ($1, $2)`, [
    normalized.body,
    normalized.source,
  ]);

  return normalized;
}

/**
 * メモを引く。
 *
 * **取り込みを待っているものは古い順**（先に入れたものから片付ける）、**片付いたものは
 * 新しい順**（直前に何をしたかを見るため）。
 */
export async function listMemos(
  options: { readonly statuses?: readonly MemoStatus[]; readonly limit?: number } = {},
): Promise<readonly Memo[]> {
  await assertCan("memos");

  const statuses = options.statuses ?? MEMO_STATUSES;
  const pendingOnly = statuses.every((status) => PENDING_STATUSES.includes(status));

  const { rows } = await query(
    `SELECT id, body, source, status, verification, outcome, created_at
       FROM memos
      WHERE status = ANY($1::text[])
      ORDER BY created_at ${pendingOnly ? "ASC" : "DESC"}
      LIMIT $2`,
    [[...statuses], options.limit ?? 100],
  );

  return rows.map(toMemo);
}

/** 取り込みを待っている件数。ダッシュボードに出して、溜まっていることが分かるようにする。 */
export async function countPendingMemos(): Promise<number> {
  await assertCan("memos");

  const { rows } = await query(`SELECT count(*) AS count FROM memos WHERE status = ANY($1::text[])`, [
    [...PENDING_STATUSES],
  ]);

  return Number(rows[0]?.count ?? 0);
}
