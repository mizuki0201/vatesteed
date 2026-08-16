import { notFound } from "next/navigation";
import { getViewer } from "../auth/index.ts";
import { can, type Capability } from "./policy.ts";

/**
 * 見てよいかを確かめる。**DB を読む関数の中から呼ぶ。**
 *
 * 画面側で隠すだけにすると、書き忘れた画面から中身が出る。データを取る手前に置けば、
 * 忘れてもデータが出てこない（[docs/architecture.md](../../docs/architecture.md)）。
 *
 * **見せられないときは 404 にする。** 「ここに何かがある」ことも隠すため。ログインが要る
 * ことを知らせたい画面では、`can()` を使って自分で出し分ける。
 */
export async function assertCan(capability: Capability): Promise<void> {
  const viewer = await getViewer();

  if (!can(viewer, capability)) notFound();
}
