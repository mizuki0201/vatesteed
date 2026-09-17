"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * メニューの1項目。選ぶと確認画面を出し、OK で `action` を呼ぶ。
 *
 * `hidden` は書き換える対象を示す値（馬の ID など）で、`fields` は確認画面で入れてもらう
 * 入力欄。どちらもフォームの値として `action` に届く。`action` が理由を返せば、失敗したときに
 * それを出す。
 */
export type EditDialogAction = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly fields?: ReactNode;
  readonly hidden: Readonly<Record<string, string>>;
  readonly action: (
    formData: FormData,
  ) => Promise<{ readonly ok: boolean; readonly message?: string }>;
};

/** 選ぶと別の画面へ移る項目（出走の登録画面など）。 */
export type EditLinkAction = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export type EditAction = EditDialogAction | EditLinkAction;

function isLink(action: EditAction): action is EditLinkAction {
  return "href" in action;
}

const FAILED = "変更できませんでした。入力を見直すか、画面を読み込み直してから、もう一度試してください。";

/** 画面右上の「…」と、項目ごとの確認画面。出してよいかは `EditMenu` が決める。 */
export function EditMenuClient({ actions }: { readonly actions: readonly EditAction[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = actions.find(
    (action): action is EditDialogAction => !isLink(action) && action.id === selectedId,
  );

  // `<form action>` に渡すと送信のたびに入力欄が空に戻るので、送信を自分で受ける
  async function submit(formData: FormData) {
    if (!selected) return;

    setPending(true);
    try {
      const result = await selected.action(formData);

      if (result.ok) {
        setSelectedId(null);
      } else {
        setFailure(result.message ?? FAILED);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* modal を切らないと、メニューを閉じた直後に確認を開いたとき画面が操作できなくなる */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="データを変更" size="icon-sm" variant="ghost">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) =>
            isLink(action) ? (
              <DropdownMenuItem asChild key={action.id}>
                <Link href={action.href}>{action.label}</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={action.id}
                onSelect={() => {
                  setFailure(null);
                  setSelectedId(action.id);
                }}
              >
                {action.label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open && !pending) setSelectedId(null);
        }}
      >
        {selected ? (
          <DialogContent showCloseButton={false}>
            <form
              className="grid max-h-[80vh] gap-4 overflow-y-auto"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(new FormData(event.currentTarget));
              }}
            >
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              {Object.entries(selected.hidden).map(([name, value]) => (
                <input key={name} name={name} type="hidden" value={value} />
              ))}
              {selected.fields}
              {failure ? <p className="text-sm text-destructive">{failure}</p> : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button disabled={pending} type="button" variant="outline">
                    キャンセル
                  </Button>
                </DialogClose>
                <Button disabled={pending} type="submit">
                  {pending ? "変更しています" : "OK"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
