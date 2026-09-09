/** 馬の画面が読む、1つの出走。 */

/** 評価の本文と、それを書いたのが誰か。 */
export type HorseEntryNote = {
  readonly body: string;
  readonly author: string;
};

export type HorseEntry = {
  readonly id: string;
  readonly raceId: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly grade: string | null;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly finishPosition: number | null;
  readonly popularity: number | null;
  readonly status: string;
  readonly jockeyName: string | null;
  readonly cornerPositions: string | null;
  /** `entry_notes`。この出走でこの馬に何が起きたか。 */
  readonly entryNote: HorseEntryNote | null;
  /** `race_notes`。レース全体の分析。同じレースに出た他の馬とも共通の内容。 */
  readonly raceNote: HorseEntryNote | null;
};

/**
 * `listHorseEntries` が読んだ1行を、画面が使う形に直す。
 *
 * **2種類の評価はどちらも欠けうる。** レース全体の分析だけを先に書くこともあれば、その逆も
 * ある。片方が無いことをもう片方が無いことにしないよう、別々に判定する。
 */
export function toHorseEntry(row: Record<string, unknown>): HorseEntry {
  return {
    id: String(row.id),
    raceId: String(row.race_id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    track: String(row.track),
    surface: String(row.surface),
    distanceM: Number(row.distance_m),
    finishPosition: (row.finish_position as number | null) ?? null,
    popularity: (row.popularity as number | null) ?? null,
    status: String(row.status),
    jockeyName: (row.jockey_name as string | null) ?? null,
    cornerPositions: (row.corner_positions as string | null) ?? null,
    entryNote: note(row.entry_note_body, row.entry_note_author),
    raceNote: note(row.race_note_body, row.race_note_author),
  };
}

function note(body: unknown, author: unknown): HorseEntryNote | null {
  return body ? { body: String(body), author: String(author) } : null;
}
