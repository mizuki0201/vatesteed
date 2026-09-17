"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checked, type RawInput } from "@/lib/fact-input";
import {
  createCourse,
  createHorse,
  createJockey,
  createRace,
  createTrainer,
  saveEntries,
  searchHorses,
  searchJockeys,
  searchRaces,
  searchTrainers,
  updateCourse,
  updateHorse,
  updateJockey,
  updateRace,
  updateTrainer,
  type CreateResult,
  type Option,
  type UpdateResult,
} from "@/lib/facts";

/**
 * 事実データの登録と修正。**認証は `lib/facts` の中で確かめている。** Server Function は
 * 画面を通らない POST からも呼べるので、守りをここではなくデータの手前に置く。
 */

/** 登録画面が表示に使う状態。成功したときは作ったものの画面へ移るので、ここには来ない。 */
export type RegisterState = {
  readonly message: string | null;
  readonly duplicates: readonly { readonly href: string; readonly label: string }[];
  /** 同名・同じ日付の既存の行を見せたあとで、別のものとして作れるようにするか。 */
  readonly canConfirm: boolean;
};

function values(formData: FormData): RawInput {
  return Object.fromEntries(formData.entries());
}

function afterCreate(
  result: CreateResult,
  href: (id: string) => string,
  duplicateHref: (id: string) => string,
  canConfirm: boolean,
): RegisterState {
  if (result.ok) {
    revalidatePath("/", "layout");
    redirect(href(result.id));
  }

  return {
    message: result.message,
    duplicates: (result.duplicates ?? []).map((item) => ({
      href: duplicateHref(item.id),
      label: item.label,
    })),
    canConfirm: canConfirm && (result.duplicates?.length ?? 0) > 0,
  };
}

export async function registerCourse(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const result = await createCourse(values(formData));

  return afterCreate(result, (id) => `/courses/${id}`, (id) => `/courses/${id}`, false);
}

export async function registerJockey(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const result = await createJockey(values(formData), checked(formData.get("allowDuplicate")));

  return afterCreate(result, (id) => `/jockeys/${id}`, (id) => `/jockeys/${id}`, true);
}

export async function registerTrainer(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const result = await createTrainer(values(formData), checked(formData.get("allowDuplicate")));

  return afterCreate(result, (id) => `/trainers/${id}`, (id) => `/trainers/${id}`, true);
}

export async function registerHorse(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const result = await createHorse(values(formData), checked(formData.get("allowDuplicate")));

  return afterCreate(result, (id) => `/horses/${id}`, (id) => `/horses/${id}`, true);
}

/** レースを作ったら、そのレースを選んだ状態で出走の登録画面へ移る。 */
export async function registerRace(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const result = await createRace(values(formData), checked(formData.get("allowDuplicate")));

  return afterCreate(
    result,
    (id) => `/dashboard/register/entry?race=${id}`,
    (id) => `/races/${id}`,
    true,
  );
}

export async function saveEntrySheet(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const raceId = String(formData.get("raceId") ?? "");
  const result = await saveEntries(raceId, formData.get("rows"), checked(formData.get("complete")));

  if (result.ok) {
    revalidatePath("/", "layout");
    redirect(`/races/${raceId}`);
  }

  return { message: result.message, duplicates: [], canConfirm: false };
}

// ---------------------------------------------------------------------------
// 各画面の「…」から直す
// ---------------------------------------------------------------------------

function afterUpdate(result: UpdateResult): UpdateResult {
  if (result.ok) revalidatePath("/", "layout");

  return result;
}

export async function editCourse(formData: FormData): Promise<UpdateResult> {
  return afterUpdate(await updateCourse(formData.get("courseId"), values(formData)));
}

export async function editJockey(formData: FormData): Promise<UpdateResult> {
  return afterUpdate(await updateJockey(formData.get("jockeyId"), values(formData)));
}

export async function editTrainer(formData: FormData): Promise<UpdateResult> {
  return afterUpdate(await updateTrainer(formData.get("trainerId"), values(formData)));
}

export async function editHorse(formData: FormData): Promise<UpdateResult> {
  return afterUpdate(await updateHorse(formData.get("horseId"), values(formData)));
}

export async function editRace(formData: FormData): Promise<UpdateResult> {
  return afterUpdate(await updateRace(formData.get("raceId"), values(formData)));
}

// ---------------------------------------------------------------------------
// 選ぶ欄の候補
// ---------------------------------------------------------------------------

export async function findHorses(q: string): Promise<readonly Option[]> {
  return searchHorses(q);
}

export async function findJockeys(q: string): Promise<readonly Option[]> {
  return searchJockeys(q);
}

export async function findTrainers(q: string): Promise<readonly Option[]> {
  return searchTrainers(q);
}

export async function findRaces(q: string): Promise<readonly Option[]> {
  return searchRaces(q);
}
