import assert from "node:assert/strict";
import { test } from "node:test";
import { leadingKeyword, stripSqlNoise } from "./sql-text.ts";

test("行コメントを取り除く。改行は残す", () => {
  assert.equal(stripSqlNoise("-- 消す\nSELECT 1"), "\nSELECT 1");
});

test("ブロックコメントは空白1つにする。入れ子も1つとして扱う", () => {
  assert.equal(stripSqlNoise("SELECT /* 説明 */ 1"), "SELECT   1");
  assert.equal(stripSqlNoise("/* 入れ子 /* も */ 飛ばす */SELECT 1"), " SELECT 1");
});

test("文字列リテラルは中身を落とす。中の引用符2つも1つの文字列として読む", () => {
  assert.equal(stripSqlNoise("SELECT 'DROP TABLE x'"), "SELECT ''");
  assert.equal(stripSqlNoise("SELECT 'it''s' , 1"), "SELECT '' , 1");
});

test("ドル引用符の中身も落とす", () => {
  assert.equal(stripSqlNoise("SELECT $tag$ DELETE FROM entries $tag$"), "SELECT  ");
  assert.equal(stripSqlNoise("SELECT $$ x $$"), "SELECT  ");
});

test("$1 のようなプレースホルダはそのまま残す", () => {
  assert.equal(stripSqlNoise("SELECT * FROM entries WHERE id = $1"), "SELECT * FROM entries WHERE id = $1");
});

test("二重引用符の識別子は残す。テーブル名を読み取るのに要る", () => {
  assert.equal(stripSqlNoise('UPDATE "horse_notes" SET body = $1'), 'UPDATE "horse_notes" SET body = $1');
});

test("閉じていないコメントや文字列は、そこで終わりにする", () => {
  assert.equal(stripSqlNoise("/* 閉じ忘れ"), " ");
  assert.equal(stripSqlNoise("SELECT '閉じ忘れ"), "SELECT ''");
});

test("先頭のキーワードを大文字で返す", () => {
  assert.equal(leadingKeyword("  \n select 1"), "SELECT");
  assert.equal(leadingKeyword("/* 説明 */ -- 続き\n DROP TABLE x"), "DROP");
  assert.equal(leadingKeyword("(SELECT 1) UNION (SELECT 2)"), undefined);
  assert.equal(leadingKeyword(""), undefined);
});
