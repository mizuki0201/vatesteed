import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNotSchemaChange, parseQueryArgs } from "./query.ts";

test("第1引数の SQL をそのまま受け取る", () => {
  const args = parseQueryArgs(["SELECT 1"]);

  assert.deepEqual(args.source, { kind: "inline", sql: "SELECT 1" });
  assert.deepEqual(args.params, []);
});

test("--file でファイルのパスを受け取る", () => {
  const args = parseQueryArgs(["--file", "tmp/insert-note.sql"]);

  assert.deepEqual(args.source, { kind: "file", path: "tmp/insert-note.sql" });
  assert.deepEqual(args.params, []);
});

test("--params の JSON 配列をそのままの並びで受け取る", () => {
  const args = parseQueryArgs(["SELECT * FROM entries WHERE id = $1", "--params", '[12, "AI"]']);

  assert.deepEqual(args.params, [12, "AI"]);
});

test("--params には null も入れられる", () => {
  const args = parseQueryArgs(["SELECT $1", "--params", "[null]"]);

  assert.deepEqual(args.params, [null]);
});

test("SQL と --file を同時に渡したらエラー", () => {
  assert.throws(() => parseQueryArgs(["SELECT 1", "--file", "a.sql"]), /同時に指定できません/);
});

test("SQL も --file も無ければエラー", () => {
  assert.throws(() => parseQueryArgs([]), /SQL が渡されていません/);
});

test("--params だけ渡しても SQL が無ければエラー", () => {
  assert.throws(() => parseQueryArgs(["--params", "[1]"]), /SQL が渡されていません/);
});

test("--file に値が続かなければエラー", () => {
  assert.throws(() => parseQueryArgs(["--file"]), /--file に値がありません/);
});

test("--params に値が続かなければエラー", () => {
  assert.throws(() => parseQueryArgs(["SELECT 1", "--params"]), /--params に値がありません/);
});

test("--params が JSON として読めなければエラー", () => {
  assert.throws(() => parseQueryArgs(["SELECT $1", "--params", "[1,"]), /JSON として読めません/);
});

test("--params が配列でなければエラー", () => {
  // 単独の値をうっかり渡したときに、そのまま1個目の値として扱わない。
  assert.throws(() => parseQueryArgs(["SELECT $1", "--params", "12"]), /JSON の配列/);
});

test("SQL を2つ渡したらエラー", () => {
  assert.throws(() => parseQueryArgs(["SELECT 1", "SELECT 2"]), /1つだけ渡してください/);
});

test("知らないオプションはエラー", () => {
  assert.throws(() => parseQueryArgs(["SELECT 1", "--json"]), /知らないオプションです/);
});

test("同じオプションを2回渡したらエラー", () => {
  assert.throws(() => parseQueryArgs(["--file", "a.sql", "--file", "b.sql"]), /1つだけ指定/);
});

test("テーブルの形や権限を変える文は弾く", () => {
  for (const sqlText of [
    "CREATE TABLE x (id int)",
    "ALTER TABLE entries ADD COLUMN x text",
    "DROP TABLE entries",
    "TRUNCATE entries",
    "GRANT ALL ON entries TO public",
    "REVOKE ALL ON entries FROM public",
    "REINDEX TABLE entries",
    "VACUUM entries",
  ]) {
    assert.throws(() => assertNotSchemaChange(sqlText), /この入口では実行できません/, sqlText);
  }
});

test("弾いたときに、スキーマを変える正しい経路を伝える", () => {
  assert.throws(() => assertNotSchemaChange("DROP TABLE entries"), (error: Error) => {
    assert.match(error.message, /DROP/);
    assert.match(error.message, /db\/migrations\//);
    assert.match(error.message, /pnpm db:migrate:test/);
    assert.match(error.message, /pnpm db:migrate/);
    return true;
  });
});

test("大文字小文字は問わない", () => {
  assert.throws(() => assertNotSchemaChange("drop table entries"), /DROP/);
  assert.throws(() => assertNotSchemaChange("Create Table x (id int)"), /CREATE/);
});

test("DELETE と UPDATE は通す。手で登録し直す作業に要る", () => {
  assert.doesNotThrow(() => assertNotSchemaChange("DELETE FROM entries WHERE id = $1"));
  assert.doesNotThrow(() => assertNotSchemaChange("UPDATE entries SET horse_id = $1"));
});

test("SELECT と INSERT は通す", () => {
  assert.doesNotThrow(() => assertNotSchemaChange("SELECT 1"));
  assert.doesNotThrow(() => assertNotSchemaChange("INSERT INTO entry_notes (body) VALUES ($1)"));
});

test("前に付く空白と改行を飛ばしてから判定する", () => {
  assert.throws(() => assertNotSchemaChange("\n\n  DROP TABLE entries"), /DROP/);
  assert.doesNotThrow(() => assertNotSchemaChange("\n  SELECT 1"));
});

test("前に付く行コメントを飛ばしてから判定する", () => {
  assert.throws(() => assertNotSchemaChange("-- 一時的に消す\nDROP TABLE entries"), /DROP/);
  assert.doesNotThrow(() => assertNotSchemaChange("-- DROP TABLE entries\nSELECT 1"));
});

test("前に付くブロックコメントを飛ばしてから判定する", () => {
  assert.throws(() => assertNotSchemaChange("/* 説明 */ DROP TABLE entries"), /DROP/);
  assert.throws(() => assertNotSchemaChange("/* 入れ子 /* も */ 飛ばす */ DROP TABLE x"), /DROP/);
  assert.doesNotThrow(() => assertNotSchemaChange("/* DROP TABLE entries */ SELECT 1"));
});

test("コメントと空白が混ざっていても飛ばす", () => {
  const sqlText = "  -- 出走の評価を消す\n\n  /* 手で登録し直す前に */\n  DROP TABLE entry_notes";

  assert.throws(() => assertNotSchemaChange(sqlText), /DROP/);
});

test("キーワードが読み取れない文は判定できないので通す。落とすのは DB の側", () => {
  // コメントが閉じていない、括弧で始まる、など。ここで無理に弾こうとしない。
  assert.doesNotThrow(() => assertNotSchemaChange("/* 閉じ忘れ"));
  assert.doesNotThrow(() => assertNotSchemaChange("(SELECT 1) UNION (SELECT 2)"));
  assert.doesNotThrow(() => assertNotSchemaChange(""));
});
