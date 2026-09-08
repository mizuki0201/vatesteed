import type { ReferenceExampleKind } from "./reference-examples.ts";

/**
 * 固定した分析本文の確認値。
 *
 * 参考例は 2026年9月8日時点の保存値を写したもので、勝手に変わらないことに意味がある。
 * ここの値と食い違ったら単体テストが落ちる。
 *
 * **本人が参考例を変更すると決めたときだけ、参考例のファイルと一緒にここも更新する。**
 * DB の本文が変わったこと、テストが落ちたことは、更新してよい理由にならない。
 *
 * 値は本文だけから作る（`fixedAnalysisDigest`）。ファイル側で足した見出しや日付を変えても
 * 動かない。
 */
export const FIXED_ANALYSIS_DIGESTS: Readonly<Record<ReferenceExampleKind, string>> = {
  horse: "f5baa5ae09deb94b2a4242805317bd4bcfbd798019e95d14ed7ca92ae22e688c",
  pedigree: "87cf64aeb41b05e5d0bf37f4ccf2520e493f9b32a51b2117c0e2af8498864310",
  entry: "880a336e8bfae194a4371485bec3e5337a8de645053bfc444386fd7b0978a08f",
};

/** 出走の分析の参考例に入れる出走。ディープインパクトの全14件を日付順に並べる。 */
export const FIXED_ENTRY_IDS: readonly number[] = [
  452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 462, 463, 464, 465,
];
