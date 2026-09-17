"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickerOption = { readonly id: string; readonly label: string };

/**
 * 登録済みの行を名前で探して1つ選ぶ欄。選んだ行の ID を `name` でフォームへ送る。
 *
 * **ここから新しい行は作らない。** 選ぶ先が無ければ、先にその登録画面で作る
 * （docs/product.md#画面）。
 */
export function RecordPicker({
  name,
  search,
  defaultValue,
  placeholder,
  onChange,
  className,
  ariaLabel,
}: {
  readonly name?: string;
  readonly search: (q: string) => Promise<readonly PickerOption[]>;
  readonly defaultValue?: PickerOption | null;
  readonly placeholder?: string;
  readonly onChange?: (option: PickerOption | null) => void;
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  const [selected, setSelected] = useState<PickerOption | null>(defaultValue ?? null);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<readonly PickerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);
  const listId = useId();

  useEffect(() => {
    const q = term.trim();

    if (q === "") {
      setOptions([]);
      return;
    }

    const request = ++latest.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await search(q);
        if (request === latest.current) setOptions(found);
      } finally {
        if (request === latest.current) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [term, search]);

  function choose(option: PickerOption | null) {
    setSelected(option);
    setTerm("");
    setOptions([]);
    setOpen(false);
    onChange?.(option);
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input name={name} type="hidden" value={selected?.id ?? ""} /> : null}

      {selected ? (
        <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input px-3 text-sm">
          <span className="truncate">{selected.label}</span>
          <button
            aria-label="選び直す"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => choose(null)}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <Input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-label={ariaLabel}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            // 日本語入力の変換を確定する Enter では選ばない
            if (event.nativeEvent.isComposing) return;
            // 候補を選ぶつもりの Enter でフォームが送られないようにする
            if (event.key === "Enter") {
              event.preventDefault();
              if (options[0]) choose(options[0]);
            }
          }}
          placeholder={placeholder ?? "名前で探す"}
          role="combobox"
          value={term}
        />
      )}

      {open && !selected && term.trim() !== "" ? (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
          id={listId}
          role="listbox"
        >
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">
              {searching ? "探しています" : "見つかりません。先に登録してください"}
            </li>
          ) : (
            options.map((option) => (
              <li key={option.id} role="option" aria-selected={false}>
                <button
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  type="button"
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
