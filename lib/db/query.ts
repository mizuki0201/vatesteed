import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { query } from "./index.ts";

/**
 * 任意の SQL を1文投げて、結果を JSON で返す入口。
 *
 * - Phase 1 では役（サブエージェント）が DB を読み書きする唯一の手段。最初の1レースを
 *   手で登録するときにも同じものを使う
 * - **目的別の関数は作らない。** 何が要るかは1レース登録してみないと分からないため、
 *   汎用の入口を1本だけ置いて `lib/` の切り方を先に決めてしまわないようにしている
 * - 値は必ず `--params` からプレースホルダ（`$1`, `$2`, ...）に入れる。SQL に直接
 *   埋め込ませない
 * - 長い日本語の本文や引用符はシェルで壊れるので、その場合は `--file` で渡す
 * - **テーブルの形や権限を変える文は弾く。** スキーマの変更経路は `db/migrations/` と
 *   `pnpm db:migrate` に決めてあり、そこを迂回されると検証ブランチを通す手順ごと無くなる
 *
 * 接続は `query()`（HTTP 経由のプール接続）。複数の文をまたぐトランザクションは張れない
 * ため、ここで扱うのは1文だけ。まとめて流すものは `db/migrations/` と `pnpm db:migrate`。
 *
 * 実行は `pnpm db:query`。
 */

/** 引数を間違えたときに出す説明。標準エラーへ出す。 */
const USAGE = [
  "使い方:",
  "  pnpm db:query \"<SQL>\" [--params '<JSON配列>']",
  "  pnpm db:query --file <path> [--params '<JSON配列>']",
  "",
  "  --params の JSON 配列が SQL の $1, $2 ... に順に入る。省略すると空配列。",
  "  長い日本語の本文や引用符はシェルで壊れるので、そのときは --file を使う。",
].join("\n");

/** SQL をどこから取るかと、プレースホルダに入れる値。 */
export type ParsedQueryArgs = {
  readonly source:
    | { readonly kind: "inline"; readonly sql: string }
    | { readonly kind: "file"; readonly path: string };
  readonly params: readonly unknown[];
};

/**
 * コマンドラインの引数を解釈する。
 *
 * 解釈だけを純粋な関数に切り出してある。DB に触る部分は単体テストの対象外なので、
 * ここだけをテストできるようにするため。おかしな引数はすべて例外にして、呼び出し側が
 * 説明を添えて終了コード1で落とす。
 */
export function parseQueryArgs(argv: readonly string[]): ParsedQueryArgs {
  let inlineSql: string | undefined;
  let filePath: string | undefined;
  let paramsJson: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--file" || arg === "--params") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} に値がありません。`);

      if (arg === "--file") {
        if (filePath !== undefined) throw new Error("--file は1つだけ指定してください。");
        filePath = value;
      } else {
        if (paramsJson !== undefined) throw new Error("--params は1つだけ指定してください。");
        paramsJson = value;
      }

      index++;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(
        `知らないオプションです: ${arg}（SQL 自体が -- で始まるなら --file で渡してください）`,
      );
    }

    if (inlineSql !== undefined) throw new Error("SQL は1つだけ渡してください。");
    inlineSql = arg;
  }

  if (inlineSql !== undefined && filePath !== undefined) {
    throw new Error("SQL と --file は同時に指定できません。どちらか一方にしてください。");
  }

  const params = parseParams(paramsJson);

  if (filePath !== undefined) {
    return { source: { kind: "file", path: filePath }, params };
  }

  if (inlineSql === undefined) {
    throw new Error("SQL が渡されていません。");
  }

  return { source: { kind: "inline", sql: inlineSql }, params };
}

/** `--params` の中身を配列にする。省略されていれば空配列。 */
function parseParams(paramsJson: string | undefined): readonly unknown[] {
  if (paramsJson === undefined) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(paramsJson);
  } catch {
    throw new Error(`--params を JSON として読めません: ${paramsJson}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("--params は JSON の配列で渡してください（例: '[1, \"AI\"]'）。");
  }

  return parsed;
}

/**
 * この入口を通さない文の、先頭のキーワード。
 *
 * テーブルの形や権限を変えるもの。**`DELETE` と `UPDATE` は入っていない**（最初の1レースを
 * 手で登録し直すような作業に要るため。消す操作の重さはここでは変わらない）。
 */
const SCHEMA_CHANGING_KEYWORDS = new Set([
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "REINDEX",
  "VACUUM",
]);

/**
 * スキーマや権限を変える文なら例外にする。
 *
 * 手元の `.env.local` は本番の DB を指していて、この入口は人間の確認を挟まずに動く役へ
 * 配られる。スキーマを変える経路は `db/migrations/` と `pnpm db:migrate`（検証ブランチを
 * 通してから本番）に決めてあるので、ここから迂回できないようにする。
 *
 * **完全な防御ではない。** 役はシェルを叩けるし、入れ子のブロックコメントで細工もできる。
 * 意図した回避ではなく事故を止めるためのものなので、判定は素直に最初のキーワードだけを見る。
 */
export function assertNotSchemaChange(sqlText: string): void {
  const keyword = leadingKeyword(sqlText);

  if (keyword === undefined || !SCHEMA_CHANGING_KEYWORDS.has(keyword)) return;

  throw new Error(
    [
      `${keyword} はこの入口では実行できません。テーブルの形や権限を変える文は通していません。`,
      "スキーマを変えるなら db/migrations/ に .sql を足し、pnpm db:migrate:test で検証ブランチを",
      "通してから pnpm db:migrate で本番へ流してください。",
    ].join("\n"),
  );
}

/** SQL の先頭のキーワードを大文字で返す。見つからなければ undefined。 */
function leadingKeyword(sqlText: string): string | undefined {
  const head = skipLeadingNoise(sqlText).match(/^[A-Za-z]+/);
  return head?.[0].toUpperCase();
}

/** SQL の前に付く空白・行コメント・ブロックコメントを飛ばす。 */
function skipLeadingNoise(sqlText: string): string {
  let rest = sqlText;

  for (;;) {
    const before = rest;

    rest = rest.trimStart();

    if (rest.startsWith("--")) {
      const lineEnd = rest.indexOf("\n");
      rest = lineEnd === -1 ? "" : rest.slice(lineEnd + 1);
    } else if (rest.startsWith("/*")) {
      rest = skipBlockComment(rest);
    }

    // 何も削れなくなったら、そこが文の頭
    if (rest === before) return rest;
  }
}

/** ブロックコメントを1つ飛ばす。Postgres のブロックコメントは入れ子にできる。 */
function skipBlockComment(sqlText: string): string {
  let depth = 0;
  let index = 0;

  while (index < sqlText.length) {
    if (sqlText.startsWith("/*", index)) {
      depth++;
      index += 2;
    } else if (sqlText.startsWith("*/", index)) {
      depth--;
      index += 2;
      if (depth === 0) return sqlText.slice(index);
    } else {
      index++;
    }
  }

  // 閉じていないコメント。この先に文は無い
  return "";
}

async function main() {
  let args: ParsedQueryArgs;

  try {
    args = parseQueryArgs(process.argv.slice(2));
  } catch (error) {
    // 引数の間違いは説明を添えて返す。実行時の失敗（下）とは分けている
    console.error(`${messageOf(error)}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  try {
    // --file の SQL は長い日本語の本文を含みうるので UTF-8 で読む
    const sqlText =
      args.source.kind === "file"
        ? await readFile(args.source.path, "utf8")
        : args.source.sql;

    // --file の中身も同じように見る。読んだあとに判定するのはそのため
    assertNotSchemaChange(sqlText);

    const result = await query(sqlText, args.params);

    // 読む側はエージェントなので、飾りを付けずに JSON を1つだけ出す。行が0件でも同じ形。
    // `date` は `query()` が文字列のまま返すので、ここで日付がずれることはない
    process.stdout.write(`${JSON.stringify({ rowCount: result.rowCount, rows: result.rows })}\n`);
  } catch (error) {
    // 出すのはメッセージだけ。Postgres のエラーは detail に値が入ることがあり、
    // 接続文字列やパラメータの中身を漏らしたくない
    console.error(messageOf(error));
    process.exitCode = 1;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// テストから import しても走らないように、直接実行したときだけ動かす
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await main();
}
