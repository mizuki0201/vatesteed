/**
 * 画面に出すときの整形。**DB には触らない純粋な変換。**
 *
 * 時計はミリ秒で持っているが、競馬で読むのは「1:58.3」「34.7」の形。画面ごとに書き直すと
 * 桁の丸め方がずれるので、ここに寄せる。
 */

/** 走破時計。`118300` → `1:58.3`。1分未満なら `58.3`。 */
export function formatFinishTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "";

  const tenths = Math.round(ms / 100);
  const totalSeconds = Math.floor(tenths / 10);
  const decimal = tenths % 10;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}.${decimal}`;

  return `${minutes}:${String(seconds).padStart(2, "0")}.${decimal}`;
}

/** 上がり3F。`34700` → `34.7`。分に繰り上げない。 */
export function formatSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "";

  const tenths = Math.round(ms / 100);

  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** 馬体重の増減。`+8` `-4` `0` の形にする。 */
export function formatWeightDiff(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || !Number.isFinite(diff)) return "";
  if (diff === 0) return "0";

  return diff > 0 ? `+${diff}` : String(diff);
}
