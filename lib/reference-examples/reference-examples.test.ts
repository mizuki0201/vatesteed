import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FIXED_ANALYSIS_DIGESTS, FIXED_ENTRY_IDS } from "./checksums.ts";
import {
  ANALYSIS_QUALITY_DOC_PATH,
  fixedAnalysisDigest,
  fixedAnalysisTexts,
  parseEntryReferenceExamples,
  parsePedigreeReferenceExample,
  REFERENCE_EXAMPLE_KINDS,
  REFERENCE_EXAMPLE_PATHS,
  REFERENCE_EXAMPLE_READERS,
  splitReferenceSections,
  type ReferenceExampleKind,
} from "./reference-examples.ts";

const REPO_ROOT = new URL("../../", import.meta.url);

function readRepoFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, REPO_ROOT)), "utf8");
}

function readExample(kind: ReferenceExampleKind): string {
  return readRepoFile(REFERENCE_EXAMPLE_PATHS[kind]);
}

function readInstructions(role: string): string {
  return readRepoFile(`agent/subagents/${role}/instructions.md`);
}

test("3種類の参考例のファイルがそろっている", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    assert.ok(readExample(kind).trim() !== "", `${REFERENCE_EXAMPLE_PATHS[kind]} が空`);
  }
});

test("固定した分析本文が確認値と一致する", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    const digest = fixedAnalysisDigest(fixedAnalysisTexts(kind, readExample(kind)));
    assert.equal(
      digest,
      FIXED_ANALYSIS_DIGESTS[kind],
      `${REFERENCE_EXAMPLE_PATHS[kind]} の本文が変わっている。本人の指示で変更したときだけ` +
        ` lib/reference-examples/checksums.ts を更新する`,
    );
  }
});

test("血統分析の参考例は本文と調べた範囲に分かれている", () => {
  const example = parsePedigreeReferenceExample(readExample("pedigree"));

  assert.ok(example.body.includes("概要"));
  assert.ok(example.scope.length > 0);
  assert.ok(!example.body.includes(example.scope));
});

test("出走の分析の参考例は14件が日付順に1件ずつ入っている", () => {
  const examples = parseEntryReferenceExamples(readExample("entry"));

  assert.deepEqual(
    examples.map((example) => example.entryId),
    FIXED_ENTRY_IDS,
  );

  const dates = examples.map((example) => example.raceDate);
  assert.deepEqual(dates, [...dates].sort());

  for (const example of examples) {
    assert.ok(example.raceName.trim() !== "", `出走${example.entryId}のレース名が空`);
    assert.ok(example.body.trim() !== "", `出走${example.entryId}の本文が空`);
  }
});

test("参考例を読む役の指示が、担当する参考例と一般ルールを参照している", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    for (const role of REFERENCE_EXAMPLE_READERS[kind]) {
      const instructions = readInstructions(role);

      assert.ok(
        instructions.includes(REFERENCE_EXAMPLE_PATHS[kind]),
        `${role} が ${REFERENCE_EXAMPLE_PATHS[kind]} を参照していない`,
      );
      assert.ok(
        instructions.includes(ANALYSIS_QUALITY_DOC_PATH),
        `${role} が ${ANALYSIS_QUALITY_DOC_PATH} を参照していない`,
      );
    }
  }
});

test("分析する役は、担当しない種類の参考例を参照しない", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    for (const other of REFERENCE_EXAMPLE_KINDS) {
      if (other === kind) continue;

      for (const role of REFERENCE_EXAMPLE_READERS[kind]) {
        if (REFERENCE_EXAMPLE_READERS[other].includes(role)) continue;

        assert.ok(
          !readInstructions(role).includes(REFERENCE_EXAMPLE_PATHS[other]),
          `${role} が担当しない ${REFERENCE_EXAMPLE_PATHS[other]} を参照している`,
        );
      }
    }
  }
});

test("参考例を読む指示が、材料を読む手順より前に置かれている", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    for (const role of REFERENCE_EXAMPLE_READERS[kind]) {
      const instructions = readInstructions(role);
      const referenceAt = instructions.indexOf(REFERENCE_EXAMPLE_PATHS[kind]);
      const orderAt = instructions.indexOf("\n## 見る順序");

      assert.notEqual(orderAt, -1, `${role} に「見る順序」が無い`);
      assert.ok(
        referenceAt < orderAt,
        `${role} の参考例を読む指示が「見る順序」より後にある`,
      );
    }
  }
});

test("`#` の見出しで区切り、前後の空行を落とす", () => {
  const sections = splitReferenceSections(
    ["# 前書き", "", "## 中の見出し", "", "本文。", "", "# 次", "", "次の本文。", ""].join("\n"),
  );

  assert.deepEqual(sections, [
    { heading: "前書き", body: "## 中の見出し\n\n本文。" },
    { heading: "次", body: "次の本文。" },
  ]);
});

test("血統分析の参考例に本文か調べた範囲が無ければ落ちる", () => {
  assert.throws(
    () => parsePedigreeReferenceExample("# 本文\n\n血統の話。\n"),
    /調べた範囲/,
  );
});

test("出走の参考例の見出しが形どおりでなければ落ちる", () => {
  assert.throws(
    () => parseEntryReferenceExamples("# 2歳新馬\n\n本文。\n"),
    /見出しが読めません/,
  );
});

test("確認値は本文だけから作り、ファイル側で足した見出しでは変わらない", () => {
  const original = readExample("entry");
  const renamed = original.replace(
    /^# (\d{4}-\d{2}-\d{2}) (.+)（出走(\d+)）$/m,
    "# $1 別のレース名（出走$3）",
  );

  assert.notEqual(renamed, original);
  assert.equal(
    fixedAnalysisDigest(fixedAnalysisTexts("entry", renamed)),
    fixedAnalysisDigest(fixedAnalysisTexts("entry", original)),
  );
});

test("本文を1文字でも書き換えると確認値が変わる", () => {
  const changed = `${readExample("horse")}\n書き足した1行。\n`;

  assert.notEqual(
    fixedAnalysisDigest(fixedAnalysisTexts("horse", changed)),
    FIXED_ANALYSIS_DIGESTS.horse,
  );
});
