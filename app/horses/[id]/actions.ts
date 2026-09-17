"use server";

import { revalidatePath } from "next/cache";
import { setHorseRetirement } from "@/lib/horses";

/**
 * 馬を現役か引退に切り替える。
 *
 * 認証は `setHorseRetirement` の中で確かめている。**Server Function は画面を通らない POST
 * からも呼べる**ので、守りをここではなくデータの手前に置く。
 *
 * 馬の一覧も現役と引退で分けているので、詳細だけでなく一覧も読み直させる。
 */
export async function changeRetirement(formData: FormData): Promise<{ readonly ok: boolean }> {
  const result = await setHorseRetirement({
    horseId: formData.get("horseId"),
    target: formData.get("target"),
  });

  if (result.ok) revalidatePath("/horses", "layout");

  return result;
}
