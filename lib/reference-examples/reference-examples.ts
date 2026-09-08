import { createHash } from "node:crypto";

/**
 * 分析の完成度を比べるために固定した参考例（ディープインパクト）を、読み取って照合する。
 *
 * 参考例は 2026年9月8日時点で DB に保存されていた本文を `agent/reference-examples/` へ
 * 写したもの。分析のたびに DB から取り直さず、ここにあるファイルだけを読む
 * （`docs/analysis-quality.md`）。
 *
 * ここに置くのは、ファイルの形と役の対応を機械で確かめるための部分だけ。参考例の使い方は
 * 役の指示と `docs/analysis-quality.md` が正本なので、本文をここへ写さない。
 */

/** 参考例を用意した分析の種類。 */
export type ReferenceExampleKind = "horse" | "pedigree" | "entry";

export const REFERENCE_EXAMPLE_KINDS: readonly ReferenceExampleKind[] = [
  "horse",
  "pedigree",
  "entry",
];

/** 種類ごとの参考例のファイル。リポジトリの根からの相対で書く。 */
export const REFERENCE_EXAMPLE_PATHS: Readonly<Record<ReferenceExampleKind, string>> = {
  horse: "agent/reference-examples/deep-impact/horse.md",
  pedigree: "agent/reference-examples/deep-impact/pedigree.md",
  entry: "agent/reference-examples/deep-impact/entries.md",
};

/**
 * 種類ごとに、その参考例を読む役。
 *
 * 分析する役は自分が担当する1種類だけを読み、`verifier` は3種類とも読む。役の指示から
 * 参考例への参照が外れたときに気づけるよう、対応をここに置く。
 */
export const REFERENCE_EXAMPLE_READERS: Readonly<
  Record<ReferenceExampleKind, readonly string[]>
> = {
  horse: ["horse-analyst", "verifier"],
  pedigree: ["pedigree-analyst", "verifier"],
  entry: ["entry-analyst", "verifier"],
};

/** 3種類に共通する一般ルールの正本。参考例を読む役は、こちらも読む。 */
export const ANALYSIS_QUALITY_DOC_PATH = "docs/analysis-quality.md";

/** 参考例のファイルを `#` の見出しで区切ったときの、1つの区画。 */
export type ReferenceSection = {
  readonly heading: string;
  readonly body: string;
};

/**
 * `#` の見出しでファイルを区切る。
 *
 * 固定した本文の中の見出しは `##` 以下なので、`#` の行はファイル側で足した区切りだけになる。
 */
export function splitReferenceSections(fileText: string): readonly ReferenceSection[] {
  const sections: ReferenceSection[] = [];
  let heading: string | undefined;
  let lines: string[] = [];

  const flush = () => {
    if (heading === undefined) return;
    sections.push({ heading, body: lines.join("\n").trim() });
    lines = [];
  };

  for (const line of fileText.split("\n")) {
    const matched = /^# (.+)$/.exec(line);
    if (matched === null) {
      lines.push(line);
      continue;
    }
    flush();
    heading = matched[1].trim();
  }
  flush();

  return sections;
}

/** 馬の総合分析の参考例。ファイル全体がそのまま本文になっている。 */
export function parseHorseReferenceExample(fileText: string): string {
  const body = fileText.trim();
  if (body === "") throw new Error("馬の総合分析の参考例に本文がありません。");
  return body;
}

/** 血統分析の参考例。本文と、調べた範囲（`scope`）に分かれている。 */
export type PedigreeReferenceExample = {
  readonly body: string;
  readonly scope: string;
};

/** 血統分析の参考例で、本文と調べた範囲に付ける見出し。 */
export const PEDIGREE_REFERENCE_HEADINGS = { body: "本文", scope: "調べた範囲" } as const;

export function parsePedigreeReferenceExample(fileText: string): PedigreeReferenceExample {
  const sections = splitReferenceSections(fileText);

  const find = (heading: string): string => {
    const section = sections.find((candidate) => candidate.heading === heading);
    if (section === undefined || section.body === "") {
      throw new Error(`血統分析の参考例に「${heading}」がありません。`);
    }
    return section.body;
  };

  return {
    body: find(PEDIGREE_REFERENCE_HEADINGS.body),
    scope: find(PEDIGREE_REFERENCE_HEADINGS.scope),
  };
}

/** 1つの出走の分析の参考例。どの出走かは見出しで区別する。 */
export type EntryReferenceExample = {
  readonly entryId: number;
  readonly raceDate: string;
  readonly raceName: string;
  readonly body: string;
};

/** 出走の参考例の見出し。「2004-12-19 2歳新馬（出走452）」の形にする。 */
const ENTRY_HEADING = /^(\d{4}-\d{2}-\d{2}) (.+)（出走(\d+)）$/;

export function parseEntryReferenceExamples(
  fileText: string,
): readonly EntryReferenceExample[] {
  return splitReferenceSections(fileText).map((section) => {
    const matched = ENTRY_HEADING.exec(section.heading);
    if (matched === null) {
      throw new Error(`出走の分析の参考例の見出しが読めません: ${section.heading}`);
    }
    if (section.body === "") {
      throw new Error(`出走${matched[3]}の参考例に本文がありません。`);
    }

    return {
      entryId: Number(matched[3]),
      raceDate: matched[1],
      raceName: matched[2],
      body: section.body,
    };
  });
}

/**
 * ファイルから、固定した分析本文だけを取り出す。
 *
 * 見出しや日付など、参考例として読みやすくするためにファイル側で足したものは入れない。
 * 分析本文そのものが変わったことだけを検出できるようにするため。
 */
export function fixedAnalysisTexts(
  kind: ReferenceExampleKind,
  fileText: string,
): readonly string[] {
  switch (kind) {
    case "horse":
      return [parseHorseReferenceExample(fileText)];
    case "pedigree": {
      const example = parsePedigreeReferenceExample(fileText);
      return [example.body, example.scope];
    }
    case "entry":
      return parseEntryReferenceExamples(fileText).map((example) => example.body);
  }
}

/**
 * 固定した分析本文から確認値を作る。
 *
 * 本文どうしの境目は、本文には現れない制御文字で区切る。区切りが本文の一部と読めてしまうと、
 * 境目をまたいだ移動を検出できなくなるため。
 */
export function fixedAnalysisDigest(texts: readonly string[]): string {
  const hash = createHash("sha256");

  for (const text of texts) {
    hash.update(text);
    hash.update("\u0000");
  }

  return hash.digest("hex");
}
