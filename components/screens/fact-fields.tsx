"use client";

import { useState, type ReactNode } from "react";
import { findHorses, findTrainers } from "@/app/dashboard/register/actions";
import { Input } from "@/components/ui/input";
import {
  AFFILIATIONS,
  COURSE_LAYOUTS,
  GRADES,
  SEXES,
  SURFACES,
  TURNS,
  WEIGHT_RULES,
} from "@/lib/enums";
import { looksOverseas } from "@/lib/fact-input";
import { normalizeRaceName } from "@/lib/race-name";
import { RecordPicker, type PickerOption } from "./record-picker";

/**
 * 事実データの入力欄の組。**登録画面と、各画面の「…」の直す確認画面で同じものを使う。**
 * 欄の `name` は `lib/fact-input` が読む名前に合わせてある。
 */

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Choice({
  name,
  values,
  defaultValue,
  required,
  emptyLabel = "（空）",
}: {
  readonly name: string;
  readonly values: readonly string[];
  readonly defaultValue?: string | null;
  readonly required?: boolean;
  readonly emptyLabel?: string;
}) {
  return (
    <select className={SELECT_CLASS} defaultValue={defaultValue ?? ""} name={name} required={required}>
      <option value="">{required ? "選んでください" : emptyLabel}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}

function Grid({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

// ---------------------------------------------------------------------------
// コース
// ---------------------------------------------------------------------------

export type CourseDefaults = {
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly turn: string;
  readonly layout: string | null;
};

/** 競馬場は登録済みの名前から選ぶ。無ければそのまま新しく入れられる。 */
export function CourseFields({
  tracks,
  defaults,
}: {
  readonly tracks: readonly string[];
  readonly defaults?: CourseDefaults;
}) {
  return (
    <Grid>
      <Field hint="登録済みの競馬場から選ぶ。無ければ新しく入れる" label="競馬場">
        <Input defaultValue={defaults?.track} list="registered-tracks" name="track" required />
        <datalist id="registered-tracks">
          {tracks.map((track) => (
            <option key={track} value={track} />
          ))}
        </datalist>
      </Field>
      <Field label="芝・ダート・障害">
        <Choice defaultValue={defaults?.surface} name="surface" required values={SURFACES} />
      </Field>
      <Field label="距離（m）">
        <Input defaultValue={defaults?.distanceM} inputMode="numeric" name="distanceM" required type="number" min={1} />
      </Field>
      <Field label="回り">
        <Choice defaultValue={defaults?.turn} name="turn" required values={TURNS} />
      </Field>
      <Field hint="同じ距離で内回りと外回りがあるときだけ選ぶ" label="内外">
        <Choice defaultValue={defaults?.layout} emptyLabel="区別なし" name="layout" values={COURSE_LAYOUTS} />
      </Field>
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// 騎手・厩舎
// ---------------------------------------------------------------------------

export type JockeyDefaults = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly debutYear: number | null;
  readonly affiliation: string | null;
};

export function JockeyFields({ defaults }: { readonly defaults?: JockeyDefaults }) {
  return (
    <Grid>
      <Field label="名前">
        <Input defaultValue={defaults?.name} name="name" required />
      </Field>
      <Field label="読み">
        <Input defaultValue={defaults?.nameKana ?? ""} name="nameKana" />
      </Field>
      <Field label="生年">
        <Input defaultValue={defaults?.birthYear ?? ""} inputMode="numeric" name="birthYear" type="number" />
      </Field>
      <Field label="デビュー年">
        <Input defaultValue={defaults?.debutYear ?? ""} inputMode="numeric" name="debutYear" type="number" />
      </Field>
      <Field label="所属">
        <Choice defaultValue={defaults?.affiliation} name="affiliation" values={AFFILIATIONS} />
      </Field>
    </Grid>
  );
}

export type TrainerDefaults = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly openedOn: string | null;
  readonly affiliation: string | null;
};

export function TrainerFields({ defaults }: { readonly defaults?: TrainerDefaults }) {
  return (
    <Grid>
      <Field label="名前">
        <Input defaultValue={defaults?.name} name="name" required />
      </Field>
      <Field label="読み">
        <Input defaultValue={defaults?.nameKana ?? ""} name="nameKana" />
      </Field>
      <Field label="開業日">
        <Input defaultValue={defaults?.openedOn ?? ""} name="openedOn" type="date" />
      </Field>
      <Field label="所属">
        <Choice defaultValue={defaults?.affiliation} name="affiliation" values={AFFILIATIONS} />
      </Field>
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// 馬
// ---------------------------------------------------------------------------

export type HorseDefaults = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly sex: string | null;
  readonly sire: PickerOption | null;
  readonly dam: PickerOption | null;
  readonly trainer: PickerOption | null;
  readonly isOverseas: boolean;
};

/**
 * 馬の入力欄。`defaults` が無ければ新しく作るときの欄で、引退の欄も出す。直すときは
 * 引退を出さない（馬の画面の「現役／引退に変更」で直す）。
 *
 * **海外の馬かどうかは、馬名に英字があれば初期値を海外にする。** 手で切り替えたあとは
 * 馬名を変えても追いかけない。
 */
export function HorseFields({ defaults }: { readonly defaults?: HorseDefaults }) {
  const creating = defaults === undefined;
  const [overseas, setOverseas] = useState(defaults?.isOverseas ?? false);
  const [touched, setTouched] = useState(!creating);
  const [retired, setRetired] = useState(false);

  return (
    <div className="grid gap-4">
      <Grid>
        <Field label="馬名">
          <Input
            defaultValue={defaults?.name}
            name="name"
            onChange={(event) => {
              if (!touched) setOverseas(looksOverseas(event.target.value));
            }}
            required
          />
        </Field>
        <Field label="読み">
          <Input defaultValue={defaults?.nameKana ?? ""} name="nameKana" />
        </Field>
        <Field label="生年">
          <Input defaultValue={defaults?.birthYear ?? ""} inputMode="numeric" name="birthYear" type="number" />
        </Field>
        <Field label="性別">
          <Choice defaultValue={defaults?.sex} name="sex" values={SEXES} />
        </Field>
        <Field hint="登録済みの馬から選ぶ。居なければ空のまま" label="父">
          <RecordPicker ariaLabel="父" defaultValue={defaults?.sire} name="sireId" search={findHorses} />
        </Field>
        <Field hint="登録済みの馬から選ぶ。居なければ空のまま" label="母">
          <RecordPicker ariaLabel="母" defaultValue={defaults?.dam} name="damId" search={findHorses} />
        </Field>
        <Field label="所属厩舎">
          <RecordPicker ariaLabel="所属厩舎" defaultValue={defaults?.trainer} name="trainerId" search={findTrainers} />
        </Field>
      </Grid>

      <label className="flex items-center gap-2 text-sm">
        <input
          checked={overseas}
          name="isOverseas"
          onChange={(event) => {
            setTouched(true);
            setOverseas(event.target.checked);
          }}
          type="checkbox"
        />
        海外の馬
        {creating ? <span className="text-xs text-muted-foreground">（馬名に英字があれば最初からチェックが入る）</span> : null}
      </label>

      {creating && !overseas ? (
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input checked={retired} name="retired" onChange={(event) => setRetired(event.target.checked)} type="checkbox" />
            引退している
          </label>
          {retired ? (
            <Field hint="空のままなら日付不明として登録する" label="引退日">
              <Input name="retiredOn" type="date" />
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// レース
// ---------------------------------------------------------------------------

export type RaceDefaults = {
  readonly raceDate: string;
  readonly courseId: string;
  readonly meetingNumber: number | null;
  readonly meetingDay: number | null;
  readonly raceNumber: number | null;
  readonly raceName: string | null;
  readonly grade: string | null;
  readonly weightRule: string | null;
  readonly weatherForecast: string | null;
};

/** レース名は、保存される表記（半角・空白なし）を入力欄の下に出す。 */
export function RaceFields({
  courses,
  defaults,
}: {
  readonly courses: readonly PickerOption[];
  readonly defaults?: RaceDefaults;
}) {
  const [raceName, setRaceName] = useState(defaults?.raceName ?? "");
  const normalized = normalizeRaceName(raceName);

  return (
    <Grid>
      <Field label="日付">
        <Input defaultValue={defaults?.raceDate} name="raceDate" required type="date" />
      </Field>
      <Field hint="無ければ先にコースを登録する" label="コース">
        <select className={SELECT_CLASS} defaultValue={defaults?.courseId ?? ""} name="courseId" required>
          <option value="">選んでください</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      </Field>
      <Field hint="開催回が無いレース（海外・地方など）は空" label="開催回">
        <Input defaultValue={defaults?.meetingNumber ?? ""} inputMode="numeric" name="meetingNumber" type="number" min={1} />
      </Field>
      <Field hint="日目が無いレース（海外・地方など）は空" label="日目">
        <Input defaultValue={defaults?.meetingDay ?? ""} inputMode="numeric" name="meetingDay" type="number" min={1} />
      </Field>
      <Field hint="分からなければ空" label="レース番号">
        <Input defaultValue={defaults?.raceNumber ?? ""} inputMode="numeric" name="raceNumber" type="number" min={1} />
      </Field>
      <Field
        hint={
          normalized !== raceName && normalized !== ""
            ? `「${normalized}」として保存する`
            : "正式名称。条件戦は空"
        }
        label="レース名"
      >
        <Input name="raceName" onChange={(event) => setRaceName(event.target.value)} value={raceName} />
      </Field>
      <Field label="格">
        <Choice defaultValue={defaults?.grade} name="grade" values={GRADES} />
      </Field>
      <Field label="負担重量">
        <Choice defaultValue={defaults?.weightRule} name="weightRule" values={WEIGHT_RULES} />
      </Field>
      <Field hint="予想する時点の天気予報。例: 曇のち雨" label="天気予報">
        <Input defaultValue={defaults?.weatherForecast ?? ""} name="weatherForecast" />
      </Field>
    </Grid>
  );
}
