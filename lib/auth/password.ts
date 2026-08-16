import type { AccessLevel } from "../enums/index.ts";
import { safeEqual } from "./session.ts";

/**
 * どのパスワードで入ったかで、見えるレベルが決まる。
 *
 * **入口を1つにする。** ログインの画面でレベルを選ばせない。選べる形にすると、友達に渡した
 * パスワードで owner を名乗る試行ができてしまう。**入力された文字列だけでレベルが決まる。**
 *
 * これは仮の仕組み。note の会員を入れる段になったら入口を差し替えるが、そのときも
 * `getViewer()` から先は変えずに済むようにしてある
 * （[docs/architecture.md](../../docs/architecture.md#認証)）。
 */

/** レベルごとのパスワードを置く環境変数。**設定されていないレベルでは、誰も入れない。** */
export const PASSWORD_ENV = {
  owner: "OWNER_PASSWORD",
  friend: "FRIEND_PASSWORD",
  member: "MEMBER_PASSWORD",
} as const satisfies Partial<Record<AccessLevel, string>>;

/** パスワードで入れるレベル。`public` は誰でも見られるので、パスワードを持たない。 */
export type PasswordLevel = keyof typeof PASSWORD_ENV;

/** 強い順。同じ文字列が2つのレベルに設定されていたら、**強い方**を返す。 */
const STRONGEST_FIRST: readonly PasswordLevel[] = ["owner", "friend", "member"];

type Env = Readonly<Record<string, string | undefined>>;

/**
 * 入力されたパスワードから、見えるレベルを決める。合わなければ `undefined`。
 *
 * **合致した時点で打ち切らない。** 早く返すと、応答の速さから「どのレベルのパスワードに
 * 近いか」を測られる余地が出る。設定されているぶんは必ず全部比べる。
 */
export function resolvePasswordLevel(
  input: string,
  env: Env = process.env,
): PasswordLevel | undefined {
  // 空文字は、環境変数が空のときに素通りする経路になるので先に落とす
  if (input === "") return undefined;

  let matched: PasswordLevel | undefined;

  for (const level of STRONGEST_FIRST) {
    const expected = env[PASSWORD_ENV[level]];

    if (!expected) continue;
    if (safeEqual(input, expected) && matched === undefined) matched = level;
  }

  return matched;
}

/** パスワードが1つも設定されていないか。設定漏れを画面で知らせるために使う。 */
export function hasAnyPassword(env: Env = process.env): boolean {
  return STRONGEST_FIRST.some((level) => Boolean(env[PASSWORD_ENV[level]]));
}
