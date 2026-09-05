/**
 * 競馬モードで動いている Claude Code からの DB 更新を、分析結果のテーブルだけに絞る。
 *
 * Codex から Claude Code へ渡す経路では、外部調査で確かめた事実の登録までを Codex が終えて
 * から渡す（`docs/claude-code-bridge.md`、`docs/agent-design.md`）。Claude Code は登録済みの
 * 事実を使って分析し、その結果だけを保存する。指示を読み違えて事実のテーブルを更新しようと
 * したときに、指示だけでなく実行時にも止めるためにここで判定する。
 *
 * **拒否側が既定。** 読み取りと、下に並べた分析結果のテーブルへの更新だけを通す。新しい
 * テーブルは、分析結果の保存先だと決めてこの一覧へ足すまで更新できない。
 *
 * **完全な防御ではない。** 役はシェルを叩けるし、環境変数も書き換えられる。意図した回避では
 * なく事故を止めるためのもので、権限の仕組みまでは作らない。
 */

import { leadingKeyword, stripSqlNoise } from "./sql-text.ts";

/**
 * 競馬モードの Claude Code が更新してよいテーブル。
 *
 * 根拠から導いた評価・判断の置き場所だけを並べる。外部情報や人間の入力から確かめられて、
 * 評価では内容が変わらない土台（馬・レース・出走・血統関係・結果・ラップ・払戻・コメント・
 * メモ・印の一覧・人間の予想と買い目）は入れない。
 */
export const ANALYSIS_RESULT_TABLES: ReadonlySet<string> = new Set([
  "ai_bet_legs",
  "ai_bets",
  "ai_predictions",
  "course_notes",
  "entry_notes",
  "horse_notes",
  "jockey_notes",
  "pedigree_notes",
  "progeny_notes",
  "race_notes",
  "race_prediction_conditions",
  "race_predictions",
  "trainer_notes",
]);

/**
 * 更新先を伴わずに通してよい文の、先頭のキーワード。
 *
 * **読み取りは常に許可する。** ここに無いものは、更新のキーワードが見つからなくても通さない。
 */
const READ_KEYWORDS = new Set(["SELECT", "WITH", "TABLE", "VALUES", "SHOW", "EXPLAIN"]);

/**
 * 更新の始まりと、その更新先。
 *
 * `ON CONFLICT ... DO UPDATE` と `SELECT ... FOR UPDATE` は更新の始まりではないので、先に
 * 書いて読み飛ばす。並べる順序に意味があり、`INSERT INTO` を `INSERT` より前に置いている。
 *
 * `COPY` と `TRUNCATE` は入れていない。文の先頭にしか置けないので、上の読み取りのキーワードに
 * 無い文として拒否される。
 */
const WRITE_CLAUSE =
  /\b(do\s+update|for\s+(?:no\s+key\s+)?update|insert\s+into|delete\s+from|merge\s+into|insert|delete|merge|update)\b\s*(?:only\s+)?([A-Za-z_"][A-Za-z0-9_$."]*)?/gi;

/** 更新の始まりではない読み飛ばし対象。 */
const NOT_A_WRITE = new Set(["do update", "for update", "for no key update"]);

/** 更新先が1つの名前で書かれる文。ここに無いキーワードは、更新先を読み取れないものとして扱う。 */
const TARGETED_WRITES = new Set(["insert into", "delete from", "merge into", "update"]);

/** 見つかった更新。`table` が null なら更新先を読み取れなかったもの。 */
type SqlWrite = { readonly keyword: string; readonly table: string | null };

/**
 * 競馬モードで実行してよい SQL かを確かめ、違えば例外にする。
 *
 * 読み取りは常に通す。更新は、更新先がすべて分析結果のテーブルのときだけ通す。
 */
export function assertRacingModeAllows(sqlText: string): void {
  const stripped = stripSqlNoise(sqlText);
  const writes = findWrites(stripped);

  if (writes.length === 0) {
    const keyword = leadingReadKeyword(stripped);
    if (keyword !== undefined && READ_KEYWORDS.has(keyword)) return;

    throw new Error(
      [
        `${keyword ?? "この文"} は競馬の分析では実行できません。`,
        "通しているのは、読み取りと分析結果のテーブルへの更新だけです。",
        "必要なことは、タスクMarkdownの「未登録・未分析」へ書いて進行役へ返してください。",
      ].join("\n"),
    );
  }

  for (const write of writes) {
    if (write.table === null) {
      throw new Error(
        [
          `更新先のテーブルを読み取れないため実行できません（${write.keyword.toUpperCase()}）。`,
          "1文ずつ、更新先のテーブル名が読める形で投げてください。",
        ].join("\n"),
      );
    }

    if (!ANALYSIS_RESULT_TABLES.has(write.table)) {
      throw new Error(
        [
          `${write.table} は事実データのテーブルなので、競馬の分析からは更新できません。`,
          "事実の登録は進行役の担当です。自分で登録せず、対象・必要な事実・その事実を使う判断を",
          "タスクMarkdownの「未登録・未分析」へ書いて進行役へ返してください。",
          `更新してよいのは分析結果のテーブルだけです: ${[...ANALYSIS_RESULT_TABLES].join(", ")}`,
        ].join("\n"),
      );
    }
  }
}

/** SQL の中の更新をすべて拾う。読み飛ばす語は結果に入れない。 */
function findWrites(stripped: string): readonly SqlWrite[] {
  const writes: SqlWrite[] = [];

  for (const match of stripped.matchAll(WRITE_CLAUSE)) {
    const keyword = match[1].replace(/\s+/g, " ").toLowerCase();
    if (NOT_A_WRITE.has(keyword)) continue;

    const target = TARGETED_WRITES.has(keyword) ? normalizeTable(match[2]) : null;
    writes.push({ keyword, table: target });
  }

  return writes;
}

/** `public."entry_notes"` のような書き方から、テーブル名だけを小文字で取り出す。 */
function normalizeTable(raw: string | undefined): string | null {
  if (raw === undefined) return null;

  const name = raw.split(".").at(-1)?.replaceAll('"', "").trim() ?? "";
  return name === "" ? null : name.toLowerCase();
}

/** 括弧で始まる読み取り（`(SELECT ...) UNION ...`）も読めるようにする。 */
function leadingReadKeyword(stripped: string): string | undefined {
  return leadingKeyword(stripped.replace(/^[\s(]+/, ""));
}
