import type { AccessLevel } from "../enums/index.ts";

/**
 * 誰に何を見せるか。**公開範囲を変えるときに触るのは、この表だけ。**
 *
 * 見せる単位は画面ではなく**情報の種類**にしてある。1つの画面の中で節ごとに出し分けられる
 * ようにするため（「馬の画面は friend だが、その中の自分の買い目は owner だけ」のような形が
 * 後から作れる）。
 *
 * URL には閲覧レベルを出さない。ここを書き換えても URL は変わらないので、**外に出した
 * リンクが壊れない**（[docs/architecture.md](../../docs/architecture.md)）。
 */

/** レベルの強さ。間に有料プランを足せるように数値で持つ。 */
export const LEVEL_WEIGHT: Readonly<Record<AccessLevel, number>> = {
  owner: 100,
  friend: 50,
  member: 10,
  public: 0,
};

/**
 * 情報の種類ごとに、見るために要るレベル。
 *
 * **ここに無いものは owner だけが見られる**（`requiredLevel` を参照）。足し忘れたものが
 * 勝手に公開されないよう、厳しい側に倒してある。
 */
export const REQUIRED_LEVEL = {
  /** Vatesteed の紹介。 */
  about: "public",
  /** 技術情報（構成・DB 設計）。 */
  tech: "public",
  /** レースの一覧と詳細。印・予想・評価を含む。 */
  races: "member",
  /** AI の成績と回収率。 */
  "results.ai": "member",
  /** 馬の一覧と詳細。 */
  horses: "friend",
  /** 騎手の一覧と詳細。 */
  jockeys: "friend",
  /** 厩舎の一覧と詳細。 */
  trainers: "friend",
  /** コースの一覧と詳細。 */
  courses: "friend",
  /** 自分の成績と収支。 */
  "results.mine": "friend",
  /** 蓄積の横断一覧（7種類の評価をそのまま並べたもの）。 */
  "notes.raw": "owner",
  /** 裏側の設計（誰にどこを見せているか）。 */
  dashboard: "owner",
} as const satisfies Readonly<Record<string, AccessLevel>>;

/** 見せる単位の名前。 */
export type Capability = keyof typeof REQUIRED_LEVEL;

/** その情報を見るために要るレベル。表に無いものは `owner`。 */
export function requiredLevel(capability: Capability): AccessLevel {
  return REQUIRED_LEVEL[capability] ?? "owner";
}

/** その人がその情報を見てよいか。 */
export function can(viewer: AccessLevel, capability: Capability): boolean {
  return LEVEL_WEIGHT[viewer] >= LEVEL_WEIGHT[requiredLevel(capability)];
}

/** 見せる単位を、レベルの強い順に並べて返す。画面に一覧を出すために使う。 */
export function listCapabilities(): readonly { capability: Capability; level: AccessLevel }[] {
  return (Object.keys(REQUIRED_LEVEL) as Capability[])
    .map((capability) => ({ capability, level: requiredLevel(capability) }))
    .sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]);
}
