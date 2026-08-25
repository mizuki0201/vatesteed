import type { Affiliation } from "../enums/index.ts";

/**
 * 騎手の一覧を切り替える所属の区分。
 *
 * DB の `jockeys.affiliation`（美浦・栗東・地方・外国）は変えずに、画面で選べる3つに
 * まとめたもの。美浦と栗東はどちらも JRA の所属なので、一覧では1つにして扱う。
 */
export type AffiliationGroup = "jra" | "local" | "overseas";

/** 区分ごとの、画面に出す名前と、そこに入る `affiliation` の値。 */
export const AFFILIATION_GROUPS = {
  jra: { label: "JRA所属", affiliations: ["美浦", "栗東"] },
  local: { label: "地方所属", affiliations: ["地方"] },
  overseas: { label: "海外", affiliations: ["外国"] },
} as const satisfies Record<
  AffiliationGroup,
  { readonly label: string; readonly affiliations: readonly Affiliation[] }
>;

/** 一覧に並べる順。 */
export const AFFILIATION_GROUP_ORDER = [
  "jra",
  "local",
  "overseas",
] as const satisfies readonly AffiliationGroup[];

/** 一覧を開いたときに出す区分。 */
export const DEFAULT_AFFILIATION_GROUP = "jra" satisfies AffiliationGroup;

/** URL の `?group=` を区分にする。**知らない値と未指定は JRA 所属。** */
export function affiliationGroup(value: string | undefined): AffiliationGroup {
  return AFFILIATION_GROUP_ORDER.find((group) => group === value) ?? DEFAULT_AFFILIATION_GROUP;
}

/** その区分に含まれる `affiliation` の値。DB の絞り込みに渡す。 */
export function groupAffiliations(group: AffiliationGroup): readonly Affiliation[] {
  return AFFILIATION_GROUPS[group].affiliations;
}

/** 画面に出す区分の名前。 */
export function affiliationGroupLabel(group: AffiliationGroup): string {
  return AFFILIATION_GROUPS[group].label;
}
