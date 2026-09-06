import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasSendBackMarker,
  parseAcceptanceNotes,
  parseSendBackNotes,
} from "./notes.ts";

function taskBody(acceptance: string): string {
  return `\n## テスト結果\n通った\n\n## 受け入れ結果\n\n${acceptance}\n\n## 保存確認\n確認済み\n`;
}

test("受け入れ結果の箇条書きを1項目1件として読む", () => {
  const notes = parseAcceptanceNotes(
    taskBody("- 差し戻し\n- 往復の数え方が仕様と違う\n- 画面に指摘が出ていない"),
  );

  assert.deepEqual(notes, ["往復の数え方が仕様と違う", "画面に指摘が出ていない"]);
});

test("差し戻しと書いただけの行は指摘に数えない", () => {
  assert.deepEqual(parseAcceptanceNotes(taskBody("- 差し戻し")), []);
  assert.deepEqual(parseAcceptanceNotes(taskBody("差し戻し")), []);
});

test("差し戻しの印は、地の文と箇条書きのどちらでも読める", () => {
  assert.equal(hasSendBackMarker(taskBody("差し戻し\n\n- 指摘")), true);
  assert.equal(hasSendBackMarker(taskBody("- 差し戻し\n- 指摘")), true);
  assert.equal(hasSendBackMarker(taskBody("- 指摘だけ")), false);
});

test("差し戻しの印が無ければ再開用の指摘として受け取らない", () => {
  assert.throws(() => parseSendBackNotes(taskBody("- 指摘だけ")), /「差し戻し」がありません/);
});

test("差し戻しの印だけで具体的な指摘が無ければ受け取らない", () => {
  assert.throws(() => parseSendBackNotes(taskBody("差し戻し")), /具体的な指摘がありません/);
});

test("差し戻しの印と具体的な指摘があれば、指摘だけを返す", () => {
  assert.deepEqual(parseSendBackNotes(taskBody("差し戻し\n\n- 指摘A\n- 指摘B")), [
    "指摘A",
    "指摘B",
  ]);
});

test("字下げした続きの行と入れ子の箇条書きは、直前の指摘と同じ1件にする", () => {
  const notes = parseAcceptanceNotes(
    taskBody("- 保存が壊れる\n  一時ファイルが残る\n  - 置き換えで書く\n- 画面が読めない"),
  );

  // 入れ子の箇条書きは記号ごと残す。指摘の中の並びが読めなくなるため。
  assert.deepEqual(notes, ["保存が壊れる\n一時ファイルが残る\n- 置き換えで書く", "画面が読めない"]);
});

test("次の見出しの内容を混ぜない", () => {
  assert.deepEqual(parseAcceptanceNotes(taskBody("- 指摘")), ["指摘"]);
});

test("見出しが無い、または箇条書きが無ければ空にする", () => {
  assert.deepEqual(parseAcceptanceNotes("## テスト結果\n通った\n"), []);
  assert.deepEqual(parseAcceptanceNotes(taskBody("未確認の状態。")), []);
});
