import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCESS_LEVELS, type AccessLevel } from "../enums/index.ts";

/**
 * ログインの状態を、署名付きの文字列にして Cookie に入れる。
 *
 * **中身は秘密ではない。** 入っているのは閲覧レベルと期限だけで、隠したいものは無い。
 * 必要なのは「他人が勝手に owner と書けないこと」だけなので、暗号化はせず署名で足りる。
 * 依存を足さずに済むよう `node:crypto` の HMAC を使う。暗号化が要るようになったら
 * jose のようなライブラリに替える（[docs/architecture.md](../../docs/architecture.md)）。
 *
 * 形は `<payload>.<signature>`。payload は JSON を base64url にしたもの。
 */

/** Cookie の名前。 */
export const SESSION_COOKIE_NAME = "vatesteed_session";

/** 期限。1年。**入れ直しを年1回で済ませるための長さ。** */
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type SessionPayload = {
  /** 閲覧レベル。 */
  readonly level: AccessLevel;
  /** 期限。UNIX 時間の秒。 */
  readonly exp: number;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * 長さの違う文字列でも、比較にかかる時間から中身を推測されないように比べる。
 *
 * `timingSafeEqual` は長さが違うと例外を投げるので、先に長さを見て早期に返す。**長さの
 * 一致・不一致は漏れる**が、隠したいのは中身なのでそこは許容する。
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}

/** 署名付きの Cookie の値を作る。`nowMs` を渡せるのはテストのため。 */
export function createSessionValue(
  level: AccessLevel,
  secret: string,
  nowMs: number = Date.now(),
): string {
  const payload: SessionPayload = {
    level,
    exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = toBase64Url(JSON.stringify(payload));

  return `${encoded}.${sign(encoded, secret)}`;
}

/**
 * Cookie の値を検証して、閲覧レベルを返す。
 *
 * **署名が合わない・期限が切れている・形が壊れているときは、すべて `undefined`。**
 * 呼ぶ側が理由で分岐する必要は無い（どれも「見せない」に落ちる）ので、区別して返さない。
 */
export function readSessionValue(
  value: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
): AccessLevel | undefined {
  if (!value) return undefined;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return undefined;

  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!safeEqual(signature, sign(encoded, secret))) return undefined;

  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(encoded));
  } catch {
    return undefined;
  }

  if (typeof payload !== "object" || payload === null) return undefined;

  const { level, exp } = payload as Record<string, unknown>;

  if (!isAccessLevel(level)) return undefined;
  if (typeof exp !== "number" || exp * 1000 <= nowMs) return undefined;

  return level;
}
