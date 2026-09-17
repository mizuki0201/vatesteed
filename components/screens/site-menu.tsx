"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * スマホ幅で出すメニュー。**中を選んでも、外側を押しても閉じる。**
 *
 * `details` で作ると、リンクを選んだあとも開いたまま残る（画面の移動で閉じないため）。
 */
export function SiteMenu({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 同じ画面の中で移動したときも閉じる
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative ml-auto sm:hidden" ref={container}>
      <button
        aria-expanded={open}
        aria-label="メニュー"
        className="cursor-pointer rounded-md border border-border px-3 py-1.5 hover:bg-accent"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-10 mt-2 flex w-52 flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-lg"
          // 中のリンクを選んだときと、ログアウトを押したときに閉じる
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
