import { can } from "@/lib/access";
import { getViewer } from "@/lib/auth";
import { EditMenuClient, type EditAction } from "./edit-menu-client";

export type { EditAction } from "./edit-menu-client";

/**
 * 各画面の右上に出す、事実データを書き換えるメニュー。**owner にだけ出す。**
 *
 * どの画面でも `PageShell` の `actions` にこれを置き、その画面で書き換えたいものを
 * `actions` に並べる。項目が無ければ何も出さない（docs/product.md#画面）。
 *
 * ここで隠すのは画面の出し分けだけ。**書き換えの守りは、`action` が呼ぶ `lib/` の関数の中に
 * 置く**（Server Function は画面を通らない POST からも呼べるため）。
 */
export async function EditMenu({ actions }: { readonly actions: readonly EditAction[] }) {
  if (actions.length === 0) return null;
  if (!can(await getViewer(), "data.edit")) return null;

  return <EditMenuClient actions={actions} />;
}
