import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ANALYSIS_KIND_LABELS,
  checkExecutionConfirmations,
  findAmbiguousSubjects,
  findHorseUntriedConditions,
  findPedigreeEmptyConclusions,
  formatAmbiguousSubjectProblem,
  formatExecutionConfirmation,
  HUMAN_OBSERVATION_WORDING,
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

/** 血統分析を1件返した形。 */
function pedigreeResponse(body: string): string {
  return [
    "## 保存する本文",
    "",
    body,
    "",
    "## 保存する範囲",
    "",
    "父系・母系とも6代。父の子は80頭で、対象馬を除いて79頭。",
    "",
    "## 保存しないメモ",
    "",
    `- ${formatExecutionConfirmation("pedigree")}`,
    "",
  ].join("\n");
}

/** 馬の総合分析を1件返した形。 */
function horseResponse(body: string): string {
  return [
    "## 保存する本文",
    "",
    "## 概要",
    "",
    body,
    "",
    "## 保存しないメモ",
    "",
    `- ${formatExecutionConfirmation("horse")}`,
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

test("血統分析は事実と読みだけなら通る", () => {
  const check = checkExecutionConfirmations({
    kinds: ["pedigree"],
    response: pedigreeResponse(
      "母は芝2000メートルで3勝し、半兄も芝1800メートルで勝ち上がった。" +
        "父の子も芝1800から2200メートルに勝ち鞍が集まり、両側から芝中距離の持続力が重なる。",
    ),
  });

  assert.deepEqual(check, { ok: true, problems: [] });
});

test("血統分析の保存部分に材料不足の報告があれば保存しない", () => {
  const phrases = [
    "気性は材料が無い。",
    "位置取りは材料が薄い。",
    "この条件については何も言えない。",
    "距離の上限までは決められない。",
    "血統だけで能力は決まらない。",
    "ダートの可能性は否定しない。",
    "重馬場が向かないとは言えない。",
    "きょうだい1頭だけでは母が伝える距離を一般化できない。",
    "古馬での成長は未確定である。",
    "小回りへの明確な根拠はない。",
    "芝だけに限定はできない。",
    "配合固有の傾向は語れない。",
    "どちらに優位かは分からない。",
  ];

  for (const phrase of phrases) {
    const check = checkExecutionConfirmations({
      kinds: ["pedigree"],
      response: pedigreeResponse(phrase),
    });

    assert.equal(check.ok, false, phrase);
    assert.ok(
      check.problems.some((problem) => problem.includes("分析結果ではない留保")),
      phrase,
    );
  }
});

test("材料不足の検査は血統分析の保存部分だけに当てる", () => {
  assert.deepEqual(findPedigreeEmptyConclusions("気性は材料が無い。"), ["気性は材料が無い。"]);

  const entryCheck = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("entry")).replace(
      "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
      "位置取りだけでは敗因を断定できない。",
    ),
  });

  assert.deepEqual(entryCheck, { ok: true, problems: [] });
});

test("血統分析は保存する範囲に入った材料不足の報告も保存しない", () => {
  const response = pedigreeResponse("母と父の子から芝中距離の持続力が重なる。").replace(
    "父系・母系とも6代。父の子は80頭で、対象馬を除いて79頭。",
    "父系は6代。母系は資料が不足している。",
  );
  const check = checkExecutionConfirmations({ kinds: ["pedigree"], response });

  assert.equal(check.ok, false);
  assert.ok(check.problems.some((problem) => problem.includes("分析結果ではない留保")));
});

test("馬の総合分析は、確かめた内容だけなら通る", () => {
  const bodies = [
    "重賞初挑戦で勝ち、同世代の上位と互角に戦えることを示した。",
    "初めての阪神で能力を示し、坂のあるコースでも脚が鈍らなかった。",
    "道悪で反応が鈍り、時計のかかる馬場では前が止まらない流れに乗れなかった。",
    "使われるごとに折り合いがつき、経験を重ねて発馬も安定した。",
    "58キロを背負った前走で、同じ相手に半馬身先着した。",
  ];

  for (const body of bodies) {
    assert.deepEqual(
      checkExecutionConfirmations({ kinds: ["horse"], response: horseResponse(body) }),
      { ok: true, problems: [] },
      body,
    );
  }
});

test("馬の総合分析の保存部分に、まだ経験していない条件があれば保存しない", () => {
  const bodies = [
    "後ろから運んだ経験は無い。",
    "重い斤量を課された経験がない。",
    "2000メートルを超える距離を経験していない。",
    "多頭数は未経験である。",
    "逃げた経験はまだなく、戦法の幅を確かめられていない。",
    "洋芝についての材料が無い。",
    "小回りのコースを使われた経験はなかった。",
  ];

  for (const body of bodies) {
    const check = checkExecutionConfirmations({
      kinds: ["horse"],
      response: horseResponse(body),
    });

    assert.equal(check.ok, false, body);
    assert.ok(
      check.problems.some((problem) =>
        problem.startsWith("馬の総合分析の保存部分に、まだ経験していない条件の記述がある"),
      ),
      body,
    );
  }
});

test("まだ経験していない条件の検査は、馬の総合分析の保存部分だけに当てる", () => {
  assert.deepEqual(findHorseUntriedConditions("後ろから運んだ経験は無い。"), [
    "後ろから運んだ経験は無い。",
  ]);

  const inNote = horseResponse("3コーナーから位置を上げ、最後まで脚を使った。").replace(
    "- 実行確認:",
    "- ダートは経験していないので、条件が替わったら読み直す\n- 実行確認:",
  );

  assert.deepEqual(checkExecutionConfirmations({ kinds: ["horse"], response: inNote }), {
    ok: true,
    problems: [],
  });

  const entryCheck = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("entry")).replace(
      "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
      "この距離を経験していない。",
    ),
  });

  assert.deepEqual(entryCheck, { ok: true, problems: [] });
});

/** 朝日杯セントライト記念で実際に保存された1文。出所の書き方だけを直す前の形。 */
const OBSERVATION_LINE_AS_SAVED =
  "本人の観察では、次の出走を見越して途中で無理に動かさなかった結果であり、" +
  "6着だけで悲観しすぎなくてよいと見ている。";

/** 同じ1文を、統一した出所の書き方へ直した形。 */
const OBSERVATION_LINE_FIXED = OBSERVATION_LINE_AS_SAVED.replace(
  "本人の観察では",
  HUMAN_OBSERVATION_WORDING,
);

test("人間の観察の出所が統一した書き方なら通る", () => {
  const entryCheck = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("entry")).replace(
      "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
      OBSERVATION_LINE_FIXED,
    ),
  });

  assert.deepEqual(entryCheck, { ok: true, problems: [] });
  assert.deepEqual(findAmbiguousSubjects(OBSERVATION_LINE_FIXED), []);

  assert.deepEqual(
    checkExecutionConfirmations({
      kinds: ["horse"],
      response: horseResponse(OBSERVATION_LINE_FIXED),
    }),
    { ok: true, problems: [] },
  );
});

test("「本人」と文字が重なるだけの「日本人」は通す", () => {
  const line = "日本人騎手へ乗り替わった前走は、道中の位置を1つ前へ取れていた。";

  assert.deepEqual(findAmbiguousSubjects(line), []);
  assert.deepEqual(
    checkExecutionConfirmations({
      kinds: ["entry"],
      response: entryResponse(formatExecutionConfirmation("entry")).replace(
        "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
        line,
      ),
    }),
    { ok: true, problems: [] },
  );

  // 「日本人」を外したあとに「本人」が残る行は止める。
  const mixed = "日本人騎手へ乗り替わり、騎手本人も手応えに余裕があったと述べている。";
  assert.deepEqual(findAmbiguousSubjects(mixed), [mixed]);
});

test("誰を指すか分からない主語がある本文は保存しない", () => {
  const lines = [
    OBSERVATION_LINE_AS_SAVED,
    OBSERVATION_LINE_AS_SAVED.replace("本人の観察では", "ユーザーの観察では"),
    "騎手本人は直線を向いた地点で手応えに余裕があったと述べている。",
    "父本人は芝の中距離で重賞を3勝している。",
  ];

  for (const line of lines) {
    const entryCheck = checkExecutionConfirmations({
      kinds: ["entry"],
      response: entryResponse(formatExecutionConfirmation("entry")).replace(
        "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
        line,
      ),
    });

    assert.equal(entryCheck.ok, false, line);
    assert.ok(entryCheck.problems.includes(formatAmbiguousSubjectProblem(line)), line);

    const horseCheck = checkExecutionConfirmations({
      kinds: ["horse"],
      response: horseResponse(line),
    });

    assert.equal(horseCheck.ok, false, line);
    assert.deepEqual(findAmbiguousSubjects(line), [line]);
  }
});

test("止めた理由が、直し方を人間の観察へ決め打ちしない", () => {
  // 「本人」が騎手を指している文。人間の観察へ直すと、別の人の話にすり替わる。
  const line = "本人は直線を向いた地点で手応えに余裕があったと述べている。";
  const check = checkExecutionConfirmations({
    kinds: ["entry"],
    response: entryResponse(formatExecutionConfirmation("entry")).replace(
      "前半3Fは35.2で流れ、2番手から直線で抜け出した。",
      line,
    ),
  });

  assert.equal(check.ok, false);

  const problem = check.problems.find((candidate) => candidate.endsWith(line));
  assert.ok(problem !== undefined, "誰を指すか分からない主語の理由が返っていない");

  assert.ok(
    problem.includes("騎手、調教師、この馬のように対象を書く"),
    "対象を明記させる案内が無い",
  );
  assert.ok(
    problem.includes(`人間から渡された観察なら「${HUMAN_OBSERVATION_WORDING}」と書く`),
    "統一した書き方を、人間の観察の場合として案内していない",
  );
  assert.ok(
    !/「レースを見た人間の観察では」に統一/.test(problem),
    "直し方を人間の観察へ決め打ちしている",
  );
});

test("誰を指すか分からない主語の検査は、保存部分だけに当てる", () => {
  const inNote = entryResponse(formatExecutionConfirmation("entry")).replace(
    "- 映像の観察は渡されていない",
    "- 本人から渡された観察は、この出走の分だけだった",
  );

  assert.deepEqual(checkExecutionConfirmations({ kinds: ["entry"], response: inNote }), {
    ok: true,
    problems: [],
  });
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

test("人間の観察の出所を統一する規則が、分析する役と検証する役の指示に載っている", () => {
  for (const role of ["entry-analyst", "race-analyst", "horse-analyst", "verifier"]) {
    const instructions = readInstructions(role);

    assert.ok(
      instructions.includes(HUMAN_OBSERVATION_WORDING),
      `${role} の指示に「${HUMAN_OBSERVATION_WORDING}」が無い`,
    );
    assert.ok(
      instructions.includes("個人名、「本人」、「ユーザー」"),
      `${role} の指示に、個人名・「本人」・「ユーザー」を書かない規則が無い`,
    );
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
