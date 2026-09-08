/**
 * 分析する役と `verifier` が返す「実行確認」を読み、そろっているかを確かめる。
 *
 * 一般ルールと参考例への参照が指示に書いてあるだけでは、その実行で両方を読んだかが分からない。
 * そこで、担当する種類の一般ルールと参考例を読んだことを、返答の保存しない側へ決まった形で
 * 残す（`docs/analysis-quality.md` の「実行時の確認」）。
 *
 * ここで見るのは形と対応だけで、分析の中身は見ない。**実行確認は分析が正しいことの証明では
 * なく、何を基準に作り、何を基準に検証したかを実行ごとに確かめるためのもの**である。
 */

import {
  ANALYSIS_QUALITY_DOC_PATH,
  REFERENCE_EXAMPLE_KINDS,
  REFERENCE_EXAMPLE_PATHS,
  type ReferenceExampleKind,
} from "../reference-examples/index.ts";

/** 分析の種類の呼び名。`docs/analysis-quality.md` の見出しに合わせる。 */
export const ANALYSIS_KIND_LABELS: Readonly<Record<ReferenceExampleKind, string>> = {
  horse: "馬の総合分析",
  pedigree: "血統分析",
  entry: "1つの出走の分析",
};

/** そのまま保存される部分の見出し。ここに実行確認が入っていたら弾く。 */
export const SAVED_PART_HEADINGS: readonly string[] = ["保存する本文", "保存する範囲"];

/** 保存しない部分の見出し。実行確認はここに置く。 */
export const UNSAVED_PART_HEADING = "保存しないメモ";

/** 実行確認の行の書き出し。 */
export const EXECUTION_CONFIRMATION_PREFIX = "実行確認:";

/**
 * 実行確認の1行を組む。
 *
 * 自由記述にすると読んだかどうかを機械で判定できないので、**種類と2つのパスを同じ形で書く**。
 * 役の指示に載せる文面もこの関数の結果と一致させる（単体テストで確かめる）。
 */
export function formatExecutionConfirmation(kind: ReferenceExampleKind): string {
  return (
    `${EXECUTION_CONFIRMATION_PREFIX} 種類=${ANALYSIS_KIND_LABELS[kind]}` +
    ` 一般ルール=${ANALYSIS_QUALITY_DOC_PATH} 参考例=${REFERENCE_EXAMPLE_PATHS[kind]}`
  );
}

/** 返答を、保存される部分と保存しない部分に分ける。 */
export type AnalysisResponseParts = {
  /** 最初の見出しより前。 */
  readonly prelude: string;
  /** `保存する本文` と `保存する範囲` を合わせたもの。 */
  readonly saved: string;
  /** `保存しないメモ`。 */
  readonly unsaved: string;
  readonly hasSaved: boolean;
  readonly hasUnsaved: boolean;
};

const PART_HEADING = new RegExp(
  `^##\\s+(${[...SAVED_PART_HEADINGS, UNSAVED_PART_HEADING].join("|")})\\s*$`,
);

/**
 * 返答の見出しで分ける。
 *
 * **分ける目印にするのは、決まった3つの見出しだけ。** 保存する本文の中にも `##` の見出しが
 * 並ぶ（馬のまとめの12項目など）ので、`##` の行をすべて区切りにすると本文が切れてしまう。
 */
export function splitAnalysisResponse(response: string): AnalysisResponseParts {
  const prelude: string[] = [];
  const saved: string[] = [];
  const unsaved: string[] = [];

  let current = prelude;
  let hasSaved = false;
  let hasUnsaved = false;

  for (const line of response.split("\n")) {
    const matched = PART_HEADING.exec(line);

    if (matched === null) {
      current.push(line);
      continue;
    }

    if (matched[1] === UNSAVED_PART_HEADING) {
      hasUnsaved = true;
      current = unsaved;
    } else {
      hasSaved = true;
      current = saved;
    }
  }

  return {
    prelude: prelude.join("\n"),
    saved: saved.join("\n"),
    unsaved: unsaved.join("\n"),
    hasSaved,
    hasUnsaved,
  };
}

/** 読み取れた実行確認の1件。 */
export type ExecutionConfirmation = {
  /** 呼び名から分かった種類。読めない呼び名なら `undefined`。 */
  readonly kind: ReferenceExampleKind | undefined;
  readonly kindLabel: string;
  readonly rulePath: string;
  readonly examplePath: string;
  readonly line: string;
};

export type ParsedExecutionConfirmations = {
  readonly confirmations: readonly ExecutionConfirmation[];
  /** 実行確認として書かれているが、形が違って読めなかった行。 */
  readonly malformedLines: readonly string[];
};

const CONFIRMATION_LINE =
  /^(?:[-*]\s+)?実行確認:\s*種類=(\S+)\s+一般ルール=(\S+)\s+参考例=(\S+)\s*$/;

function kindOfLabel(label: string): ReferenceExampleKind | undefined {
  return REFERENCE_EXAMPLE_KINDS.find((kind) => ANALYSIS_KIND_LABELS[kind] === label);
}

/** 文章から実行確認の行を拾う。箇条書きの `- ` だけは付いていてよい。 */
export function parseExecutionConfirmations(text: string): ParsedExecutionConfirmations {
  const confirmations: ExecutionConfirmation[] = [];
  const malformedLines: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.replace(/^[-*]\s+/, "").startsWith(EXECUTION_CONFIRMATION_PREFIX)) continue;

    const matched = CONFIRMATION_LINE.exec(line);

    if (matched === null) {
      malformedLines.push(line);
      continue;
    }

    confirmations.push({
      kind: kindOfLabel(matched[1]),
      kindLabel: matched[1],
      rulePath: matched[2],
      examplePath: matched[3],
      line,
    });
  }

  return { confirmations, malformedLines };
}

export type ExecutionConfirmationCheck = {
  readonly ok: boolean;
  /** 保存してはいけない理由。1件ずつ日本語で返す。 */
  readonly problems: readonly string[];
};

/**
 * 返答に、担当した種類ぶんの実行確認がそろっているかを見る。
 *
 * 次のどれかに当たったら、その分析を保存しない（`docs/analysis-quality.md`）。
 *
 * - 実行確認が無い
 * - 一般ルールか参考例のパスが違う
 * - 分析の種類と参考例が対応していない
 * - 担当しない種類の実行確認が混ざっている
 * - 実行確認が保存する本文に混ざっている
 */
export function checkExecutionConfirmations(input: {
  readonly kinds: readonly ReferenceExampleKind[];
  readonly response: string;
}): ExecutionConfirmationCheck {
  const problems: string[] = [];
  const parts = splitAnalysisResponse(input.response);
  const { confirmations, malformedLines } = parseExecutionConfirmations(input.response);

  for (const line of malformedLines) {
    problems.push(`実行確認の形が違う: ${line}`);
  }

  if (parts.hasSaved && parseExecutionConfirmations(parts.saved).confirmations.length > 0) {
    problems.push("実行確認が保存する本文に混ざっている");
  }
  if (parts.hasUnsaved && parseExecutionConfirmations(parts.prelude).confirmations.length > 0) {
    problems.push(`実行確認が「${UNSAVED_PART_HEADING}」の外にある`);
  }

  for (const kind of input.kinds) {
    const label = ANALYSIS_KIND_LABELS[kind];
    const found = confirmations.filter((confirmation) => confirmation.kind === kind);

    if (found.length === 0) {
      problems.push(`${label}の実行確認が無い`);
      continue;
    }

    for (const confirmation of found) {
      if (confirmation.rulePath !== ANALYSIS_QUALITY_DOC_PATH) {
        problems.push(
          `${label}の一般ルールのパスが違う: ${confirmation.rulePath}` +
            `（${ANALYSIS_QUALITY_DOC_PATH} を読む）`,
        );
      }
      if (confirmation.examplePath !== REFERENCE_EXAMPLE_PATHS[kind]) {
        problems.push(
          `${label}と参考例が対応していない: ${confirmation.examplePath}` +
            `（${REFERENCE_EXAMPLE_PATHS[kind]} を読む）`,
        );
      }
    }
  }

  for (const confirmation of confirmations) {
    if (confirmation.kind === undefined) {
      problems.push(`実行確認の種類が読めない: ${confirmation.kindLabel}`);
      continue;
    }
    if (!input.kinds.includes(confirmation.kind)) {
      problems.push(`担当しない種類の実行確認がある: ${confirmation.kindLabel}`);
    }
  }

  return { ok: problems.length === 0, problems };
}

export type AnalysisConfirmationArgs = {
  /** その返答で担当した分析の種類。`verifier` のように複数を見た返答では複数入る。 */
  readonly kinds: readonly ReferenceExampleKind[];
  /** 返答を保存したファイル。 */
  readonly responsePath: string;
};

/**
 * `pnpm analysis:confirm` の引数を読む。おかしな引数はすべて例外にする。
 *
 * 先頭の `--` は落とす。`pnpm <script> -- --kind ...` の区切りがそのまま渡ってくるため。
 */
export function parseAnalysisConfirmationArgs(
  rawArgv: readonly string[],
): AnalysisConfirmationArgs {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  const kinds: ReferenceExampleKind[] = [];
  let responsePath: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg !== "--kind" && arg !== "--response") {
      throw new Error(`知らない引数です: ${arg}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${arg} の値がありません。`);
    }
    index++;

    if (arg === "--response") {
      responsePath = value;
      continue;
    }
    if (!(REFERENCE_EXAMPLE_KINDS as readonly string[]).includes(value)) {
      throw new Error(`知らない種類です: ${value}`);
    }
    kinds.push(value as ReferenceExampleKind);
  }

  if (kinds.length === 0) throw new Error("--kind がありません。");
  if (responsePath === undefined) throw new Error("--response がありません。");

  return { kinds, responsePath };
}
