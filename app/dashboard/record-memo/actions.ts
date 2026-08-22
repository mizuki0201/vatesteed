"use server";

import { redirect } from "next/navigation";
import { recordMemo } from "@/lib/memos";

/**
 * 見かけた話を1つ入れる。
 *
 * **分類も宛先も受け取らない。** 決めるのは取り込む側の仕事
 * （docs/agent-design.md#メモの取り込み2026-08-22-決定）。
 *
 * 認証は `recordMemo` の中で確かめている。**Server Function は画面を通らない POST からも
 * 呼べる**ので、守りをここではなくデータの手前に置く。
 *
 * 空と長すぎは、画面側の `required` と `maxLength` が先に止める（どちらも JavaScript が
 * 無くても効く）。ここで返すのは、画面を通らずに叩かれた場合の分。
 */
export async function record(formData: FormData): Promise<void> {
  const result = await recordMemo({
    body: formData.get("body"),
    source: formData.get("source"),
  });

  redirect(result.ok ? "/dashboard/record-memo?saved=1" : `/dashboard/record-memo?error=${result.reason}`);
}
