import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ANALYSIS_KIND_LABELS,
  checkExecutionConfirmations,
  formatExecutionConfirmation,
  parseAnalysisConfirmationArgs,
  parseExecutionConfirmations,
  splitAnalysisResponse,
} from "./index.ts";
import {
  ANALYSIS_QUALITY_DOC_PATH,
  REFERENCE_EXAMPLE_KINDS,
  REFERENCE_EXAMPLE_PATHS,
  REFERENCE_EXAMPLE_READERS,
} from "../reference-examples/index.ts";

const REPO_ROOT = new URL("../../", import.meta.url);

function readInstructions(role: string): string {
  return readFileSync(
    fileURLToPath(new URL(`agent/subagents/${role}/instructions.md`, REPO_ROOT)),
    "utf8",
  );
}

/** 出走の分析を1件返した形。実行確認は保存しないメモに置く。 */
function entryResponse(confirmation: string): string {
  return [
    "## 保存する本文",
    "",
    "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
    "",
    "## 保存しないメモ",
    "",
    `- ${confirmation}`,
    "- 映像の観察は渡されていない",
    "",
  ].join("\n");
}

test("実行確認は種類と2つのパスを同じ形で書く", () => {
  assert.equal(
    formatExecutionConfirmation("horse"),
    "実行確認: 種類=馬の総合分析 一般ルール=docs/analysis-quality.md" +
      " 参考例=agent/reference-examples/deep-impact/horse.md",
  );

  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    const parsed = parseExecutionConfirmations(formatExecutionConfirmation(kind));

    assert.deepEqual(parsed.malformedLines, []);
    assert.deepEqual(parsed.confirmations, [
      {
        kind,
        kindLabel: ANALYSIS_KIND_LABELS[kind],
        rulePath: ANALYSIS_QUALITY_DOC_PATH,
        examplePath: REFERENCE_EXAMPLE_PATHS[kind],
        line: formatExecutionConfirmation(kind),
      },
    ]);
  }
});

test("そろっている実行確認は通る", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("entry")),
  });

  assert.deepEqual(check, { ok: true, problems: [] });
});

test("実行確認が無ければ保存しない", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: "## 保存する本文\n\n本文。\n\n## 保存しないメモ\n\n- なし\n",
  });

  assert.deepEqual(check, { ok: false, problems: ["1つの出走の分析の実行確認が無い"] });
});

test("一般ルールか参考例のどちらかが欠けた行は、形が違うものとして弾く", () => {
  for (const line of [
    "実行確認: 種類=1つの出走の分析 参考例=agent/reference-examples/deep-impact/entries.md",
    "実行確認: 種類=1つの出走の分析 一般ルール=docs/analysis-quality.md",
    "実行確認: 一般ルールと参考例を読みました",
  ]) {
    const check = checkExecutionConfirmations({
      kinds: ["entry"],
      response: entryResponse(line),
    });

    assert.equal(check.ok, false);
    assert.ok(check.problems.some((problem) => problem.startsWith("実行確認の形が違う")));
    assert.ok(check.problems.includes("1つの出走の分析の実行確認が無い"));
  }
});

test("分析の種類と参考例が対応していなければ保存しない", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(
      "実行確認: 種類=1つの出走の分析 一般ルール=docs/analysis-quality.md" +
        " 参考例=agent/reference-examples/deep-impact/horse.md",
    ),
  });

  assert.equal(check.ok, false);
  assert.deepEqual(check.problems, [
    "1つの出走の分析と参考例が対応していない: agent/reference-examples/deep-impact/horse.md" +
      "（agent/reference-examples/deep-impact/entries.md を読む）",
  ]);
});

test("担当しない種類の実行確認は弾く", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("pedigree")),
  });

  assert.equal(check.ok, false);
  assert.deepEqual(check.problems, [
    "1つの出走の分析の実行確認が無い",
    "担当しない種類の実行確認がある: 血統分析",
  ]);
});

test("読めない種類の呼び名は弾く", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(
      "実行確認: 種類=出走分析 一般ルール=docs/analysis-quality.md" +
        " 参考例=agent/reference-examples/deep-impact/entries.md",
    ),
  });

  assert.equal(check.ok, false);
  assert.ok(check.problems.includes("実行確認の種類が読めない: 出走分析"));
});

test("実行確認が保存する本文に混ざっていたら保存しない", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: [
      "## 保存する本文",
      "",
      formatExecutionConfirmation("entry"),
      "",
      "前半3Fは35.2で流れた。",
      "",
      "## 保存しないメモ",
      "",
      `- ${formatExecutionConfirmation("entry")}`,
      "",
    ].join("\n"),
  });

  assert.equal(check.ok, false);
  assert.deepEqual(check.problems, ["実行確認が保存する本文に混ざっている"]);
});

test("保存しないメモがあるのに、その外へ書いた実行確認は弾く", () => {
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: [
      formatExecutionConfirmation("entry"),
      "",
      "## 保存する本文",
      "",
      "前半3Fは35.2で流れた。",
      "",
      "## 保存しないメモ",
      "",
      "- なし",
      "",
    ].join("\n"),
  });

  assert.equal(check.ok, false);
  assert.ok(check.problems.includes("実行確認が「保存しないメモ」の外にある"));
});

test("見出しで分ける返答は、3種類の見出しだけを区切りにする", () => {
  const parts = splitAnalysisResponse(
    [
      "## 保存する本文",
      "",
      "## 概要",
      "",
      "現級で足りる。",
      "",
      "## 保存する範囲",
      "",
      "父の子は42頭。",
      "",
      "## 保存しないメモ",
      "",
      "- なし",
      "",
    ].join("\n"),
  );

  assert.ok(parts.hasSaved && parts.hasUnsaved);
  assert.ok(parts.saved.includes("## 概要"));
  assert.ok(parts.saved.includes("父の子は42頭。"));
  assert.ok(!parts.unsaved.includes("現級で足りる。"));
  assert.equal(parts.prelude.trim(), "");
});

test("検証する役は、3種類ぶんの実行確認を返す", () => {
  const response = [
    "検証した。",
    "",
    ...REFERENCE_EXAMPLE_KINDS.map((kind) => `- ${formatExecutionConfirmation(kind)}`),
    "",
  ].join("\n");

  assert.deepEqual(
    checkExecutionConfirmations({ kinds: [...REFERENCE_EXAMPLE_KINDS], response }),
    { ok: true, problems: [] },
  );
});

test("実行確認の形が、それを書く役の指示に載っている", () => {
  for (const kind of REFERENCE_EXAMPLE_KINDS) {
    for (const role of REFERENCE_EXAMPLE_READERS[kind]) {
      assert.ok(
        readInstructions(role).includes(formatExecutionConfirmation(kind)),
        `${role} の指示に ${ANALYSIS_KIND_LABELS[kind]} の実行確認の形が無い`,
      );
    }
  }
});

test("自分で書き込む役の指示に、書き込む前の照合が書いてある", () => {
  for (const [role, kind] of [
    ["entry-analyst", "entry"],
    ["pedigree-analyst", "pedigree"],
  ] as const) {
    const instructions = readInstructions(role);

    assert.ok(
      instructions.includes(`pnpm analysis:confirm -- --kind ${kind} --response`),
      `${role} の指示に、書き込む前に実行確認を通す手順が無い`,
    );
    assert.ok(
      instructions.includes("通らなければ書き込まない"),
      `${role} の指示に、通らなければ書き込まないと書かれていない`,
    );
  }
});

test("検証する役の指示に、実行確認を弾く条件が書いてある", () => {
  const instructions = readInstructions("verifier");

  for (const condition of [
    "実行確認が無い",
    "一般ルールか参考例のどちらかが無い",
    "分析の種類と参考例が対応していない",
    "実行確認が保存する本文に混ざっている",
  ]) {
    assert.ok(instructions.includes(condition), `verifier の指示に「${condition}」が無い`);
  }
});

test("入口の引数は、種類と返答が無ければ落ちる", () => {
  assert.deepEqual(
    parseAnalysisConfirmationArgs([
      "--kind",
      "horse",
      "--kind",
      "entry",
      "--response",
      "a.md",
    ]),
    { kinds: ["horse", "entry"], responsePath: "a.md" },
  );

  assert.deepEqual(
    parseAnalysisConfirmationArgs(["--", "--kind", "horse", "--response", "a.md"]),
    { kinds: ["horse"], responsePath: "a.md" },
  );

  assert.throws(() => parseAnalysisConfirmationArgs(["--response", "a.md"]), /--kind/);
  assert.throws(() => parseAnalysisConfirmationArgs(["--kind", "horse"]), /--response/);
  assert.throws(() => parseAnalysisConfirmationArgs(["--kind", "馬"]), /知らない種類/);
  assert.throws(() => parseAnalysisConfirmationArgs(["--file", "a.md"]), /知らない引数/);
});
