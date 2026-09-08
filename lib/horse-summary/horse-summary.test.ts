import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatExecutionConfirmation } from "../analysis-confirmation/index.ts";
import {
  applyHorseSummaryResponse,
  buildHorseSummary,
  HORSE_SUMMARY_HEADINGS,
  mergeHorseSummary,
  needsAgreementBeforeUpdate,
  parseHorseSummary,
  parseHorseSummaryArgs,
  NO_CHANGE_TEXT,
  parseHorseSummaryUpdates,
  type HorseSummarySection,
} from "./index.ts";

const REPO_ROOT = new URL("../../", import.meta.url);

function readRepoFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, REPO_ROOT)), "utf8");
}

/** 馬の総合分析の実行確認。返答に無ければまとめを作らない。 */
const CONFIRMATION = formatExecutionConfirmation("horse");

/** 見出しの間に本文が入った、既にある馬のまとめ。 */
const CURRENT = [
  "## 概要",
  "",
  "初戦から折り合いが付いており、上のクラスでも足りる。",
  "",
  "## 脚質",
  "",
  "中団から差す形が直近3回続いている。",
  "",
  "## 距離適性",
  "",
  "1600mから2000mで力を出せている。",
  "",
  "## 気性・精神面",
  "",
  "輸送で減っても走れている。",
  "",
].join("\n");

test("変更する項目だけ入れ替わり、ほかの項目は一字も変わらない", () => {
  const merged = mergeHorseSummary(CURRENT, [
    { heading: "距離適性", body: "2400mでも最後まで脚を使えた。" },
  ]);

  assert.equal(merged.state, "updated");
  assert.deepEqual(merged.replaced, ["距離適性"]);
  assert.deepEqual(merged.added, []);

  const before = parseHorseSummary(CURRENT);
  const after = parseHorseSummary(merged.body);
  assert.ok(before.ok && after.ok);

  assert.deepEqual(
    after.sections.map((section) => section.heading),
    before.sections.map((section) => section.heading),
  );

  for (const section of after.sections) {
    if (section.heading === "距離適性") {
      assert.equal(section.body, "2400mでも最後まで脚を使えた。");
      continue;
    }

    const original: HorseSummarySection | undefined = before.sections.find(
      (candidate) => candidate.heading === section.heading,
    );
    assert.equal(section.raw, original?.raw);
  }
});

test("新しい項目は12項目の順序に合う位置へ入る", () => {
  const merged = mergeHorseSummary(CURRENT, [
    { heading: "馬場適性", body: "稍重で脚を使えている。" },
    { heading: "成長・変化", body: "3歳の春から折り合いが付くようになった。" },
  ]);

  assert.equal(merged.state, "updated");
  assert.deepEqual(merged.added, ["馬場適性", "成長・変化"]);

  const parsed = parseHorseSummary(merged.body);
  assert.ok(parsed.ok);
  assert.deepEqual(
    parsed.sections.map((section) => section.heading),
    ["概要", "脚質", "距離適性", "馬場適性", "気性・精神面", "成長・変化"],
  );
});

test("既存本文を項目に読み分けられなければ書き換えない", () => {
  const withPrelude = `この馬について。\n\n${CURRENT}`;
  const unknownHeading = `${CURRENT}\n## 次走の狙い\n\n次は東京で。\n`;
  const duplicated = `${CURRENT}\n## 脚質\n\n逃げても走れる。\n`;

  for (const body of [withPrelude, unknownHeading, duplicated]) {
    const merged = mergeHorseSummary(body, [{ heading: "脚質", body: "先行できる。" }]);
    assert.equal(merged.state, "blocked");
    assert.ok(merged.reasons.length > 0);
  }

  assert.deepEqual(parseHorseSummary(withPrelude), {
    ok: false,
    reasons: ["最初の見出しより前に本文がある"],
  });
  assert.deepEqual(parseHorseSummary(unknownHeading), {
    ok: false,
    reasons: ["12項目に無い見出しがある: 次走の狙い"],
  });
  assert.deepEqual(parseHorseSummary(duplicated), {
    ok: false,
    reasons: ["同じ見出しが2回以上ある: 脚質"],
  });
});

test("12項目に無い見出しへは更新できない", () => {
  const merged = mergeHorseSummary(CURRENT, [
    { heading: "次走の狙い", body: "東京の2000mで買う。" },
  ]);

  assert.equal(merged.state, "blocked");
  assert.deepEqual(merged.reasons, ["12項目に無い見出しは更新できない: 次走の狙い"]);
});

test("更新する項目が無ければ書き換えない", () => {
  const merged = mergeHorseSummary(CURRENT, []);

  assert.equal(merged.state, "blocked");
  assert.deepEqual(merged.reasons, ["更新する項目が無い"]);
});

test("まとめが無い馬は、12項目の順序で初回のまとめを組む", () => {
  const built = buildHorseSummary([
    { heading: "脚質", body: "中団から差す。" },
    { heading: "概要", body: "現級で足りる。" },
  ]);

  assert.equal(built.state, "updated");
  assert.equal(built.body, "## 概要\n\n現級で足りる。\n\n## 脚質\n\n中団から差す。\n");
});

test("初回のまとめに概要が無ければ組まない", () => {
  const built = buildHorseSummary([{ heading: "脚質", body: "中団から差す。" }]);

  assert.equal(built.state, "blocked");
  assert.deepEqual(built.reasons, ["初回のまとめに「概要」が無い"]);
});

test("author が人間・対話のまとめは自動で書き換えない", () => {
  assert.equal(needsAgreementBeforeUpdate("人間"), true);
  assert.equal(needsAgreementBeforeUpdate("対話"), true);
  assert.equal(needsAgreementBeforeUpdate("AI"), false);

  const response = [
    "## 保存する本文",
    "",
    "## 脚質",
    "",
    "先行できる。",
    "",
    "## 保存しないメモ",
    "",
    `- ${CONFIRMATION}`,
    "",
  ].join("\n");

  for (const author of ["人間", "対話"]) {
    const applied = applyHorseSummaryResponse({ currentBody: CURRENT, author, response });

    assert.equal(applied.state, "blocked");
    assert.match(applied.reasons[0], /対話へ返す/);
  }

  assert.equal(
    applyHorseSummaryResponse({ currentBody: CURRENT, author: "AI", response }).state,
    "updated",
  );
});

test("実行確認が無い返答からは、まとめを作らない", () => {
  const withoutConfirmation = [
    "## 保存する本文",
    "",
    "## 脚質",
    "",
    "先行できる。",
    "",
    "## 保存しないメモ",
    "",
    "- なし",
    "",
  ].join("\n");

  const applied = applyHorseSummaryResponse({
    currentBody: CURRENT,
    author: "AI",
    response: withoutConfirmation,
  });

  assert.equal(applied.state, "blocked");
  assert.deepEqual(applied.reasons, ["馬の総合分析の実行確認が無い"]);
});

test("実行確認が保存する本文に混ざった返答からも、まとめを作らない", () => {
  const applied = applyHorseSummaryResponse({
    currentBody: CURRENT,
    author: "AI",
    response: [
      "## 保存する本文",
      "",
      CONFIRMATION,
      "",
      "## 脚質",
      "",
      "先行できる。",
      "",
      "## 保存しないメモ",
      "",
      `- ${CONFIRMATION}`,
      "",
    ].join("\n"),
  });

  assert.equal(applied.state, "blocked");
  assert.deepEqual(applied.reasons, ["実行確認が保存する本文に混ざっている"]);
});

test("返答の保存する本文から、更新する項目を読む", () => {
  const parsed = parseHorseSummaryUpdates(
    [
      "## 保存する本文",
      "",
      "## 距離適性",
      "",
      "2400mでも脚を使えた。",
      "",
      "## 保存しないメモ",
      "",
      "- 距離適性: 今回の2400mで最後まで伸びたため",
      "",
    ].join("\n"),
  );

  assert.deepEqual(parsed, {
    state: "updated",
    updates: [{ heading: "距離適性", body: "2400mでも脚を使えた。" }],
  });
});

test("保存しないメモの中身は、更新する項目に混ざらない", () => {
  const applied = applyHorseSummaryResponse({
    currentBody: CURRENT,
    author: "AI",
    response: [
      "## 保存する本文",
      "",
      "## 脚質",
      "",
      "先行しても止まらない。",
      "",
      "## 保存しないメモ",
      "",
      "- 変更理由: 今回は2番手から押し切った",
      "- 根拠になった出走: 2026-09-06 中京11R",
      `- ${CONFIRMATION}`,
      "",
    ].join("\n"),
  });

  assert.equal(applied.state, "updated");
  assert.ok(!applied.body.includes("変更理由"));
  assert.ok(!applied.body.includes("根拠になった出走"));
  assert.ok(!applied.body.includes("実行確認"));
});

test("変わる項目が無い返答は、書き換えないことと分けて返す", () => {
  const applied = applyHorseSummaryResponse({
    currentBody: CURRENT,
    author: "AI",
    response: ["## 保存する本文", "", NO_CHANGE_TEXT, "", "## 保存しないメモ", "", `- ${CONFIRMATION}`, ""].join(
      "\n",
    ),
  });

  assert.deepEqual(applied, { state: "unchanged" });
});

test("まだまとめが無い馬に「変更なし」は返させない", () => {
  const applied = applyHorseSummaryResponse({
    author: "AI",
    response: ["## 保存する本文", "", NO_CHANGE_TEXT, "", "## 保存しないメモ", "", `- ${CONFIRMATION}`, ""].join(
      "\n",
    ),
  });

  assert.equal(applied.state, "blocked");
  assert.match(applied.reasons[0], /初回のまとめを作る/);
});

test("項目も「変更なし」も無い返答は、形が崩れているので書き換えない", () => {
  const applied = applyHorseSummaryResponse({
    currentBody: CURRENT,
    author: "AI",
    response: [
      "## 保存する本文",
      "",
      "今回は距離が延びても大丈夫そうだった。",
      "",
      "## 保存しないメモ",
      "",
      `- ${CONFIRMATION}`,
      "",
    ].join("\n"),
  });

  assert.equal(applied.state, "blocked");
  assert.match(applied.reasons[0], /`##` の項目が無い/);
});

test("入口の引数は、返答と author が無ければ落ちる", () => {
  assert.deepEqual(
    parseHorseSummaryArgs(["--response", "a.md", "--author", "AI", "--current", "b.md"]),
    { responsePath: "a.md", author: "AI", currentPath: "b.md" },
  );

  assert.deepEqual(
    parseHorseSummaryArgs(["--", "--response", "a.md", "--author", "AI"]),
    { responsePath: "a.md", author: "AI", currentPath: undefined },
  );

  assert.throws(() => parseHorseSummaryArgs(["--author", "AI"]), /--response/);
  assert.throws(() => parseHorseSummaryArgs(["--response", "a.md"]), /--author/);
  assert.throws(() => parseHorseSummaryArgs(["--response"]), /値がありません/);
  assert.throws(() => parseHorseSummaryArgs(["--horse", "1"]), /知らない引数/);
});

test("「変更なし」の書き方が horse-analyst の指示と同じになっている", () => {
  const instructions = readRepoFile("agent/subagents/horse-analyst/instructions.md");

  assert.ok(
    instructions.includes(`「${NO_CHANGE_TEXT}」とだけ書く`),
    `horse-analyst の指示に「${NO_CHANGE_TEXT}」の書き方が無い`,
  );
});

test("12項目が docs/analysis-quality.md と同じ並びになっている", () => {
  const doc = readRepoFile("docs/analysis-quality.md");
  const from = doc.indexOf("## 馬の総合分析");
  const to = doc.indexOf("### 構成", from);

  assert.ok(from !== -1 && to !== -1);

  const headings = doc
    .slice(from, to)
    .split("\n")
    .flatMap((line) => /^- (.+)$/.exec(line)?.[1] ?? []);

  assert.deepEqual(headings, [...HORSE_SUMMARY_HEADINGS]);
});

test("12項目が horse-analyst の指示と同じ並びになっている", () => {
  const instructions = readRepoFile("agent/subagents/horse-analyst/instructions.md");
  const from = instructions.indexOf("| 観点 | その項目に書くこと |");

  assert.ok(from !== -1);

  const rows: string[] = [];

  for (const line of instructions.slice(from).split("\n").slice(2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.split("|")[1].trim());
  }

  assert.deepEqual(rows, [...HORSE_SUMMARY_HEADINGS]);
});
