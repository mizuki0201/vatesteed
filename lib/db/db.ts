import { neon, types as pgTypes, type CustomTypesConfig } from "@neondatabase/serverless";

/**
 * Postgres の `date` 型の OID。
 *
 * 数値の正体は `pgTypes.builtins.DATE` と同じだが、実行時に引くと「なぜこの型だけ扱いを
 * 変えているか」が読めなくなるので、定数として名前を付けて置いている。
 */
const DATE_OID = 1082;

/**
 * `date` 列を、DB に入っている文字列のまま返す型パーサ。
 *
 * 既定のパーサは `date` を JS の `Date` に変換する。`Date` は時刻を持つのでローカルの
 * 午前0時として解釈され、JSON にすると UTC に直って**日付が1日戻る**。2026-08-16 の
 * `race_date` が `2026-08-15T15:00:00.000Z` として出てくるのがこれで、出力を読む人間と
 * エージェントの両方が、DB に入っているのと違う日付を読むことになる。
 *
 * `date` はそもそも時間帯を持たない型なので、`Date` に変換した時点で嘘が混ざる。文字列の
 * まま返すのが正しい。`timestamptz`（`created_at` など）は時間帯を持つ型なので既定のまま。
 */
const TYPE_PARSERS: CustomTypesConfig = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (oid === DATE_OID) return (value: string) => value;
    return pgTypes.getTypeParser(oid, format);
  },
};

/**
 * Neon への接続を返す。
 *
 * `DATABASE_URL` は PgBouncer 経由のプール接続。Vercel Functions のようにコネクションを
 * 保持できない環境で接続が枯渇しないよう、常にこちらを使う。直結が必要になった場合のみ
 * `DATABASE_URL_UNPOOLED` を検討する。
 *
 * ローカルでは `vercel env pull .env.local` で取得した値を使う。
 *
 * **SQL を投げるなら `query()` を使うこと。** この関数を直接使うと、下の型パーサが効かない
 * （Neon の HTTP 経路では型パーサをクエリ単位でしか渡せず、タグ付きテンプレートには
 * 乗らないため）。
 */
export function getSql() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。`pnpm vercel env pull .env.local` を実行してください。",
    );
  }

  return neon(url);
}

/** `query()` が返すもの。node-postgres の結果から、使う2つだけを取り出した形。 */
export type QueryResult = {
  readonly rowCount: number | null;
  readonly rows: readonly Record<string, unknown>[];
};

/**
 * SQL を1文投げる。**DB を読み書きする入口はここ1つにする。**
 *
 * 型パーサ（`TYPE_PARSERS`）は Neon の HTTP 経路ではクエリ単位でしか渡せない。呼び出し側に
 * 毎回付けさせると必ず付け忘れが出て、その経路だけ `date` が1日ずれる。**付け忘れうる形を
 * 残さないために、オプションを内側に閉じ込めたこの関数を通す。**
 *
 * 値は必ず `params` からプレースホルダ（`$1`, `$2`, ...）に入れること。SQL に文字列を直接
 * 埋め込まない。複数の文をまたぐトランザクションは張れないので、扱うのは1文だけ。
 */
export async function query(
  sqlText: string,
  params: readonly unknown[] = [],
): Promise<QueryResult> {
  const sql = getSql();

  const result = await sql.query<false, true>(sqlText, [...params], {
    fullResults: true,
    types: TYPE_PARSERS,
  });

  return { rowCount: result.rowCount, rows: result.rows };
}
