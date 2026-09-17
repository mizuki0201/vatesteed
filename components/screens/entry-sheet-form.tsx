"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import {
  findHorses,
  findJockeys,
  findRaces,
  saveEntrySheet,
  type RegisterState,
} from "@/app/dashboard/register/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ENTRY_STATUSES } from "@/lib/enums";
import { ENTRY_ROWS_MAX } from "@/lib/fact-input";
import { RecordPicker, type PickerOption } from "./record-picker";

/** 出走を入れるレースを選ぶ。選んだら、そのレースの出走の登録画面へ移る。 */
export function EntryRacePicker() {
  const router = useRouter();

  return (
    <div className="max-w-xl">
      <RecordPicker
        ariaLabel="レース"
        onChange={(option) => {
          if (option) router.push(`/dashboard/register/entry?race=${option.id}`);
        }}
        placeholder="レース名・競馬場・日付（2026-09 など）で探す"
        search={findRaces}
      />
    </div>
  );
}

export type EntrySheetRowValue = {
  readonly entryId: string | null;
  readonly horse: PickerOption | null;
  readonly jockey: PickerOption | null;
  readonly bracketNumber: string;
  readonly horseNumber: string;
  readonly weightCarried: string;
  readonly status: string;
  readonly removable: boolean;
};

type Row = EntrySheetRowValue & { readonly key: number };

const INITIAL: RegisterState = { message: null, duplicates: [], canConfirm: false };

const CELL_INPUT = "h-9 w-16 text-center";

/**
 * 1レースぶんの出走を、1頭1行でまとめて入れる。保存は全行を1回で行う。
 *
 * **馬・騎手は登録済みのものを選ぶだけ。厩舎の欄は無い**（保存するときに馬の所属厩舎を写す）。
 * 評価・印・買い目・結果が付いた出走は外せない。
 */
export function EntrySheetForm({
  raceId,
  rows: initialRows,
  entryListComplete,
}: {
  readonly raceId: string;
  readonly rows: readonly EntrySheetRowValue[];
  readonly entryListComplete: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveEntrySheet, INITIAL);
  const [rows, setRows] = useState<readonly Row[]>(() =>
    initialRows.map((row, index) => ({ ...row, key: index })),
  );
  const [nextKey, setNextKey] = useState(initialRows.length);

  function update(key: number, patch: Partial<EntrySheetRowValue>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const numbers = rows.map((row) => Number(row.horseNumber)).filter((value) => value > 0);
    const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;

    setRows((current) => [
      ...current,
      {
        key: nextKey,
        entryId: null,
        horse: null,
        jockey: null,
        bracketNumber: "",
        horseNumber: String(next),
        weightCarried: "",
        status: "出走",
        removable: true,
      },
    ]);
    setNextKey(nextKey + 1);
  }

  const payload = JSON.stringify(
    rows.map((row) => ({
      entryId: row.entryId,
      horseId: row.horse?.id ?? "",
      jockeyId: row.jockey?.id ?? "",
      bracketNumber: row.bracketNumber,
      horseNumber: row.horseNumber,
      weightCarried: row.weightCarried,
      status: row.status,
    })),
  );

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <input name="raceId" type="hidden" value={raceId} />
      <input name="rows" type="hidden" value={payload} />

      <div className="grid gap-2">
        <div className="hidden grid-cols-[4rem_4rem_minmax(0,1fr)_minmax(0,1fr)_4rem_6rem_2rem] gap-2 px-1 text-xs text-muted-foreground md:grid">
          <span>枠番</span>
          <span>馬番</span>
          <span>馬</span>
          <span>騎手</span>
          <span>斤量</span>
          <span>状態</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            まだ出走がありません。「行を足す」から入れてください。
          </p>
        ) : null}

        {rows.map((row) => (
          <div
            className="grid grid-cols-[4rem_4rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[4rem_4rem_minmax(0,1fr)_minmax(0,1fr)_4rem_6rem_2rem] md:border-0 md:p-1"
            key={row.key}
          >
            <Input
              aria-label="枠番"
              className={CELL_INPUT}
              inputMode="numeric"
              max={8}
              min={1}
              onChange={(event) => update(row.key, { bracketNumber: event.target.value })}
              placeholder="枠"
              type="number"
              value={row.bracketNumber}
            />
            <Input
              aria-label="馬番"
              className={CELL_INPUT}
              inputMode="numeric"
              min={1}
              onChange={(event) => update(row.key, { horseNumber: event.target.value })}
              placeholder="馬番"
              type="number"
              value={row.horseNumber}
            />
            <RecordPicker
              ariaLabel="馬"
              defaultValue={row.horse}
              onChange={(option) => update(row.key, { horse: option })}
              placeholder="馬名で探す"
              search={findHorses}
            />
            <RecordPicker
              ariaLabel="騎手"
              className="col-span-4 md:col-span-1"
              defaultValue={row.jockey}
              onChange={(option) => update(row.key, { jockey: option })}
              placeholder="騎手名で探す"
              search={findJockeys}
            />
            <Input
              aria-label="斤量"
              className={CELL_INPUT}
              inputMode="decimal"
              onChange={(event) => update(row.key, { weightCarried: event.target.value })}
              placeholder="斤量"
              value={row.weightCarried}
            />
            <select
              aria-label="状態"
              className="col-span-2 h-9 rounded-md border border-input bg-transparent px-2 text-sm md:col-span-1"
              onChange={(event) => update(row.key, { status: event.target.value })}
              value={row.status}
            >
              {ENTRY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              aria-label="この行を外す"
              className="row-start-1 flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 md:row-start-auto"
              disabled={!row.removable}
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              style={{ gridColumnStart: "-2" }}
              title={row.removable ? "この行を外す" : "評価・印・買い目・結果が付いているので外せません"}
              type="button"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}

        <div>
          <Button
            disabled={rows.length >= ENTRY_ROWS_MAX}
            onClick={addRow}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon />
            行を足す
          </Button>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input className="mt-1" defaultChecked={entryListComplete} name="complete" type="checkbox" />
        <span>
          出馬表をすべて入れた
          <span className="block text-xs text-muted-foreground">
            予想するレースとして、全頭を入れ終えたときだけチェックする。チェックしたレースはレースの一覧に出る。
          </span>
        </span>
      </label>

      {state.message ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button disabled={pending} type="submit">
          {pending ? "保存しています" : "保存する"}
        </Button>
      </div>
    </form>
  );
}
