"use client";

import Link from "next/link";
import { startTransition, useActionState, type ReactNode } from "react";
import type { RegisterState } from "@/app/dashboard/register/actions";
import { Button } from "@/components/ui/button";

const INITIAL: RegisterState = { message: null, duplicates: [], canConfirm: false };

/**
 * 登録画面のフォーム。**作れたら作ったものの画面へ移る**ので、ここに残るのは失敗したときだけ。
 *
 * 同名・同じ日付の行が既にあれば、その行へのリンクと「別のものとして登録する」の確認を出す。
 * 確認にチェックを入れて押し直したときだけ作る。
 *
 * **`<form action>` には渡さない。** 渡すと送信のたびに入力欄が空に戻り、失敗したときに
 * 入れた値が消えるため、送信を自分で受けて呼ぶ。
 */
export function RegisterForm({
  action,
  confirmLabel,
  submitLabel = "登録する",
  children,
}: {
  readonly action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
  readonly confirmLabel?: string;
  readonly submitLabel?: string;
  readonly children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form
      className="grid max-w-2xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}

      {state.message ? (
        <div aria-live="polite" className="grid gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
          <p className="text-destructive">{state.message}</p>
          {state.duplicates.length > 0 ? (
            <ul className="grid gap-1">
              {state.duplicates.map((item) => (
                <li key={item.href}>
                  <Link className="underline hover:no-underline" href={item.href} target="_blank">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {state.canConfirm ? (
            <label className="flex items-center gap-2">
              <input name="allowDuplicate" type="checkbox" />
              {confirmLabel ?? "別のものとして登録する"}
            </label>
          ) : null}
        </div>
      ) : null}

      <div>
        <Button disabled={pending} type="submit">
          {pending ? "登録しています" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
