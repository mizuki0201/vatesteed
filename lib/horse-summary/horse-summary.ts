/**
 * 馬のまとめ（`horse_notes.body`）を、項目単位で読み分けて差し替える。
 *
 * レース振り返りのあと、`horse-analyst` は結論が変わった項目だけを返す
 * （`docs/analysis-quality.md` の「レース振り返り後の更新」）。**変更対象外の項目は本文を
 * 一字も変えない**ので、全文を組み直さず、変わる項目の中身だけを入れ替える。
 *
 * 既存の本文が項目に読み分けられないときは、ここで自動更新せずに理由を返す。全文の書き直しは
 * 対話で決めることになっているため、その判断を処理側で握らない。
 */

/**
 * 馬の総合分析で使う12項目。`docs/analysis-quality.md` の「馬の総合分析」の順序に合わせる。
 *
 * 既存の見出しの並びは保つので、この順序を使うのは項目を新しく足すときだけ。
 */
export const HORSE_SUMMARY_HEADINGS = [
  "概要",
  "馬の特徴",
  "脚質",
  "距離適性",
  "馬場適性",
  "競馬場・コース適性",
  "展開による得意不得意・向き不向き",
  "能力面",
  "気性・精神面",
  "実績による裏付け",
  "成長・変化",
  "その他特筆点",
] as const;

export type HorseSummaryHeading = (typeof HORSE_SUMMARY_HEADINGS)[number];

/** 最初に置くと決まっている項目。初回のまとめでは必ず要る。 */
export const HORSE_SUMMARY_LEAD_HEADING: HorseSummaryHeading = "概要";

/** `author` がこの値の行は、AI が単独で書き換えない（`docs/data-model.md`）。 */
export const AUTHORS_NEEDING_AGREEMENT: readonly string[] = ["人間", "対話"];

/** その `horse_notes` を自動更新してよいか。人間と対話が書いた行は合意を取ってからにする。 */
export function needsAgreementBeforeUpdate(author: string): boolean {
  return AUTHORS_NEEDING_AGREEMENT.includes(author.trim());
}

function isKnownHeading(heading: string): heading is HorseSummaryHeading {
  return (HORSE_SUMMARY_HEADINGS as readonly string[]).includes(heading);
}

function headingOrder(heading: HorseSummaryHeading): number {
  return HORSE_SUMMARY_HEADINGS.indexOf(heading);
}

/** 項目1つぶん。`raw` は見出し行から次の見出しの直前までを、空行も含めてそのまま持つ。 */
export type HorseSummarySection = {
  readonly heading: HorseSummaryHeading;
  readonly body: string;
  readonly raw: string;
};

export type HorseSummaryParse =
  | { readonly ok: true; readonly sections: readonly HorseSummarySection[] }
  | { readonly ok: false; readonly reasons: readonly string[] };

const SECTION_HEADING = /^##\s+(.+?)\s*$/;

/**
 * 既存の本文を12項目に読み分ける。
 *
 * **読み分けられないときは推測で直さず、理由を返す。** 見出しの外に本文がある、知らない見出しが
 * ある、同じ見出しが2回ある、といった形は、どこを差し替えてよいかが決まらない。
 */
export function parseHorseSummary(body: string): HorseSummaryParse {
  const reasons: string[] = [];
  const lines = body.split("\n");

  if (lines.some((line) => line.trimStart().startsWith("```"))) {
    reasons.push("本文にコードブロックがあり、項目の区切りを見分けられない");
  }
  if (lines.some((line) => /^#\s+/.test(line))) {
    reasons.push("本文に `#` の見出しがあり、項目の区切りを見分けられない");
  }

  const sections: { heading: string; lines: string[] }[] = [];
  const prelude: string[] = [];

  for (const line of lines) {
    const matched = SECTION_HEADING.exec(line);

    if (matched === null) {
      if (sections.length === 0) prelude.push(line);
      else sections[sections.length - 1].lines.push(line);
      continue;
    }

    sections.push({ heading: matched[1], lines: [line] });
  }

  if (prelude.join("").trim() !== "") {
    reasons.push("最初の見出しより前に本文がある");
  }
  if (sections.length === 0) {
    reasons.push("`##` の見出しが1つも無い");
  }

  const seen = new Set<string>();

  for (const section of sections) {
    if (!isKnownHeading(section.heading)) {
      reasons.push(`12項目に無い見出しがある: ${section.heading}`);
      continue;
    }
    if (seen.has(section.heading)) {
      reasons.push(`同じ見出しが2回以上ある: ${section.heading}`);
      continue;
    }
    seen.add(section.heading);
  }

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    sections: sections.map((section) => {
      const raw = section.lines.join("\n");

      return {
        heading: section.heading as HorseSummaryHeading,
        body: section.lines.slice(1).join("\n").trim(),
        raw,
      };
    }),
  };
}

/** 差し替える項目。`body` はその項目に入る新しい本文そのもの。 */
export type HorseSummaryUpdate = {
  readonly heading: string;
  readonly body: string;
};

/**
 * 結合した結果。
 *
 * **`blocked` は失敗ではなく「書き換えない」。** 既存の本文を読み分けられない、合意が要る、
 * 実行確認が無いといった、そのまま書き込んではいけない状態をまとめて表す。
 */
export type HorseSummaryMerge =
  | {
      readonly state: "updated";
      readonly body: string;
      /** 既にあった項目のうち、中身を入れ替えたもの。 */
      readonly replaced: readonly HorseSummaryHeading[];
      /** 新しく足した項目。 */
      readonly added: readonly HorseSummaryHeading[];
    }
  | { readonly state: "blocked"; readonly reasons: readonly string[] };

function checkUpdates(updates: readonly HorseSummaryUpdate[]): readonly string[] {
  const reasons: string[] = [];
  const seen = new Set<string>();

  if (updates.length === 0) reasons.push("更新する項目が無い");

  for (const update of updates) {
    if (!isKnownHeading(update.heading)) {
      reasons.push(`12項目に無い見出しは更新できない: ${update.heading}`);
      continue;
    }
    if (seen.has(update.heading)) {
      reasons.push(`同じ見出しを2回更新しようとしている: ${update.heading}`);
      continue;
    }
    seen.add(update.heading);

    if (update.body.trim() === "") {
      reasons.push(`本文が空の項目がある: ${update.heading}`);
    }
  }

  return reasons;
}

/**
 * 見出しと本文を、1区画の `raw` にする。
 *
 * `raw` は行を `\n` でつないだもので、**区画どうしの間の改行は持たない**（区画を並べ直すときに
 * `\n` でつなぐ）。`trailing` には、その区画の末尾にあった空行をそのまま渡す。
 */
function sectionText(heading: string, body: string, trailing: string): string {
  return `## ${heading}\n\n${body.trim()}${trailing}`;
}

/** その区画の末尾にある改行の並び。差し替えても本文どうしの間隔を変えないために使う。 */
function trailingNewlines(raw: string): string {
  return /\n*$/.exec(raw)?.[0] ?? "";
}

/**
 * 既存の本文の、指定された項目だけを差し替える。
 *
 * - 変更対象外の項目は `raw` をそのまま並べ直すので、本文も見出しの順序も変わらない
 * - 既にない項目は、12項目の順序に合う位置へ入れる
 * - 既存の本文が読み分けられない、更新の指定がおかしい場合は、書き換えずに理由を返す
 */
export function mergeHorseSummary(
  currentBody: string,
  updates: readonly HorseSummaryUpdate[],
): HorseSummaryMerge {
  const updateReasons = checkUpdates(updates);
  const parsed = parseHorseSummary(currentBody);

  if (!parsed.ok || updateReasons.length > 0) {
    return {
      state: "blocked",
      reasons: [...updateReasons, ...(parsed.ok ? [] : parsed.reasons)],
    };
  }

  const byHeading = new Map<string, string>(
    updates.map((update) => [update.heading, update.body]),
  );
  const replaced: HorseSummaryHeading[] = [];
  const added: HorseSummaryHeading[] = [];

  const parts = parsed.sections.map((section) => {
    const body = byHeading.get(section.heading);

    if (body === undefined) return { heading: section.heading, raw: section.raw };

    replaced.push(section.heading);

    return {
      heading: section.heading,
      raw: sectionText(section.heading, body, trailingNewlines(section.raw)),
    };
  });

  const newHeadings = updates
    .map((update) => update.heading as HorseSummaryHeading)
    .filter((heading) => !parsed.sections.some((section) => section.heading === heading))
    .sort((left, right) => headingOrder(left) - headingOrder(right));

  for (const heading of newHeadings) {
    const body = byHeading.get(heading) ?? "";
    const at = parts.findIndex((part) => headingOrder(part.heading) > headingOrder(heading));

    added.push(heading);

    if (at === -1) {
      const last = parts[parts.length - 1];
      // 直前の区画が空行で終わっていないと、足した見出しが本文へつながってしまう。
      if (last !== undefined && !last.raw.endsWith("\n")) last.raw = `${last.raw}\n`;

      parts.push({ heading, raw: sectionText(heading, body, "\n") });
      continue;
    }

    parts.splice(at, 0, { heading, raw: sectionText(heading, body, "\n") });
  }

  return {
    state: "updated",
    body: parts.map((part) => part.raw).join("\n"),
    replaced,
    added,
  };
}

/**
 * `horse_notes` がまだ無い馬の、初回のまとめを組む。
 *
 * 項目の並びは12項目の順序にそろえる。`概要` を最初に置くと決めてあるので、無ければ作らない。
 */
export function buildHorseSummary(
  sections: readonly HorseSummaryUpdate[],
): HorseSummaryMerge {
  const reasons = [...checkUpdates(sections)];

  if (!sections.some((section) => section.heading === HORSE_SUMMARY_LEAD_HEADING)) {
    reasons.push(`初回のまとめに「${HORSE_SUMMARY_LEAD_HEADING}」が無い`);
  }
  if (reasons.length > 0) return { state: "blocked", reasons };

  const ordered = [...sections].sort(
    (left, right) =>
      headingOrder(left.heading as HorseSummaryHeading) -
      headingOrder(right.heading as HorseSummaryHeading),
  );

  return {
    state: "updated",
    body: `${ordered
      .map((section) => sectionText(section.heading, section.body, ""))
      .join("\n\n")}\n`,
    replaced: [],
    added: ordered.map((section) => section.heading as HorseSummaryHeading),
  };
}
