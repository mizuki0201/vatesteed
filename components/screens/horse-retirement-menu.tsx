"use client";

import { useState, useTransition } from "react";
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
import { changeRetirement } from "@/app/horses/[id]/actions";

/**
 * 馬の詳細画面の右上に出すメニュー。**owner にだけ出す**（出し分けは画面側、書き換えの
 * 守りは `setHorseRetirement` の中）。
 *
 * メニューから選ぶと確認を出し、OK で切り替える。切り替えた先と名前は画面側で決めて渡す
 * （`lib/horses` は DB を読むので、ここからは読まない）。
 */
export function HorseRetirementMenu({
  horseId,
  horseName,
  target,
  label,
}: {
  readonly horseId: string;
  readonly horseName: string;
  readonly target: "active" | "retired";
  readonly label: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("horseId", horseId);
    formData.set("target", target);

    startTransition(async () => {
      const result = await changeRetirement(formData);

      if (result.ok) {
        setOpen(false);
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <>
      {/* modal を切らないと、メニューを閉じた直後に確認を開いたとき画面が操作できなくなる */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="馬の操作" size="icon-sm" variant="ghost">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setFailed(false);
              setOpen(true);
            }}
          >
            {label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{horseName}を{label}しますか？</DialogTitle>
            <DialogDescription>
              {target === "retired"
                ? "今日の日付を引退日として記録し、馬の一覧では「引退」に出ます。"
                : "記録している引退日を消し、馬の一覧では「現役」に出ます。"}
            </DialogDescription>
          </DialogHeader>
          {failed ? (
            <p className="text-sm text-destructive">
              変更できませんでした。画面を読み込み直してから、もう一度試してください。
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={pending} variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button disabled={pending} onClick={submit}>
              {pending ? "変更しています" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
