/**
 * 買い目の展開と的中判定。
 *
 * 買い目は「列」だけで保存し、展開後の組み合わせは持たない（docs/decisions/0003）。
 * ここはその列から実際の買い目を組み立て直す側。
 *
 * **どこまでをこの関心に含めるかは未確定。** `lib/` の責務分割は docs/agent-design.md で
 * 保留のまま。分けることになっても済むよう、DB に触らない純粋な計算だけにしてある。
 */

export const TICKET_TYPES = [
  "単勝",
  "複勝",
  "枠連",
  "馬連",
  "馬単",
  "ワイド",
  "3連複",
  "3連単",
  "WIN5",
] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const BET_STYLES = ["単点", "ボックス", "流し", "フォーメーション"] as const;
export type BetStyle = (typeof BET_STYLES)[number];

export const ENTRY_STATUSES = ["出走", "取消", "除外", "中止", "失格"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** 券種が必要とする列の数。WIN5 は対象5レースぶん。 */
const LEG_COUNT: Record<TicketType, number> = {
  単勝: 1,
  複勝: 1,
  枠連: 2,
  馬連: 2,
  馬単: 2,
  ワイド: 2,
  "3連複": 3,
  "3連単": 3,
  WIN5: 5,
};

/** 順不同の券種。顔ぶれが同じ組み合わせは1点にまとめる。 */
const UNORDERED: ReadonlySet<TicketType> = new Set<TicketType>([
  "枠連",
  "馬連",
  "ワイド",
  "3連複",
]);

/** マルチを指定できる券種。 */
const MULTI_ALLOWED: ReadonlySet<TicketType> = new Set<TicketType>(["馬単", "3連単"]);

/** 対象を枠番で指定する券種。それ以外は entry_id で指定する。 */
export function usesBracketNumber(ticketType: TicketType): boolean {
  return ticketType === "枠連";
}

export type BetInput = {
  ticketType: TicketType;
  betStyle: BetStyle;
  isMulti: boolean;
  /**
   * `bet_legs` の列。`leg_group` の昇順に並べる。
   * 中身は枠連なら枠番、それ以外は `entry_id`。
   */
  legs: number[][];
  /** 1点あたりの金額。100円単位 */
  unitAmount: number;
};

export type ExpandedBet = {
  /** 展開した買い目。順不同の券種は昇順に正規化してある */
  combinations: number[][];
  combinationCount: number;
  totalAmount: number;
};

/**
 * 列から買い目を展開する。
 *
 * 1. 各列から1つずつ選ぶ全組み合わせを作る
 * 2. 同じ対象が2回出るものを捨てる（枠連のゾロ目だけ例外）
 * 3. マルチなら、各組み合わせの並べ替えをすべて加える
 * 4. 順不同の券種は、顔ぶれが同じものを1点にまとめる
 */
export function expandBet(input: BetInput): ExpandedBet {
  const { ticketType, betStyle, isMulti, legs, unitAmount } = input;

  const expected = LEG_COUNT[ticketType];
  if (legs.length !== expected) {
    throw new Error(`${ticketType} の列は ${expected} 本必要ですが ${legs.length} 本でした。`);
  }
  if (legs.some((leg) => leg.length === 0)) {
    throw new Error("空の列があります。");
  }
  if (isMulti && !MULTI_ALLOWED.has(ticketType)) {
    throw new Error(`${ticketType} にマルチは指定できません。`);
  }
  if (unitAmount <= 0 || unitAmount % 100 !== 0) {
    throw new Error("1点あたりの金額は100円単位で指定してください。");
  }

  // 枠連にはゾロ目（同じ枠が2つ）がある。ただしボックスでは作らない。
  //
  // ここだけ bet_style を見ている。decisions/0003 の「bet_style は計算に使わない」と
  // 食い違うが、ゾロ目を含めるかどうかは列の中身からは決められない。docs 側の
  // 整理が必要な箇所として残してある。
  const allowRepeat = ticketType === "枠連" && betStyle !== "ボックス";

  let combinations = cartesianProduct(legs);

  if (!allowRepeat) {
    combinations = combinations.filter((row) => new Set(row).size === row.length);
  }

  if (isMulti) {
    combinations = combinations.flatMap(permutations);
  }

  const normalize = UNORDERED.has(ticketType)
    ? (row: number[]) => [...row].sort((a, b) => a - b)
    : (row: number[]) => row;

  const seen = new Map<string, number[]>();
  for (const row of combinations) {
    const normalized = normalize(row);
    seen.set(normalized.join("-"), normalized);
  }

  const result = [...seen.values()];

  return {
    combinations: result,
    combinationCount: result.length,
    totalAmount: unitAmount * result.length,
  };
}

export type EntryResult = {
  entryId: number;
  bracketNumber: number | null;
  status: EntryStatus;
  /** 降着があれば降着後の確定着順。入るのは status が「出走」のときだけ */
  finishPosition: number | null;
};

/**
 * 1点が的中したかを判定する。
 *
 * 基本の規則は券種をまたいで共通で、同着があっても分岐が要らない。
 *
 * > 買った馬を着順の小さい順に並べたとき、i番目の馬の着順が i 以下であること。
 *
 * 順序を問う券種（馬単・3連単）は並べ替えず、買った順のまま同じ条件を見る。
 * 複勝とワイドだけは「n着以内に入っていればいい」型なので別扱い。
 *
 * **返還はここで扱わない。** 取消・除外の馬を含む買い目は false を返す。返還額は
 * `refund` 列で別に持つ（返還ルールの詳細は docs/data-model.md で未確定）。
 *
 * @param combination `expandBet` が返した1点。枠連なら枠番、それ以外は entry_id
 * @param results そのレースの全出走。複勝の上限を出すのに全頭ぶんが要る
 */
export function isHit(
  ticketType: TicketType,
  combination: number[],
  results: EntryResult[],
): boolean {
  if (ticketType === "枠連") {
    return isBracketQuinellaHit(combination, results);
  }

  const byId = new Map(results.map((entry) => [entry.entryId, entry]));
  const bought = combination.map((entryId) => {
    const entry = byId.get(entryId);
    if (!entry) {
      throw new Error(`出走 ${entryId} がこのレースの結果に含まれていません。`);
    }
    return entry;
  });

  // 着順が無い（取消・除外・中止・失格）馬を含む時点で当たらない
  if (bought.some((entry) => entry.finishPosition === null)) {
    return false;
  }
  const positions = bought.map((entry) => entry.finishPosition as number);

  if (ticketType === "複勝") {
    return positions[0] <= placeLimit(results);
  }
  if (ticketType === "ワイド") {
    // 出走頭数による縮小があるかは JRA 公式に記載を見つけられなかった。常に3着までとする
    return positions.every((position) => position <= 3);
  }
  if (ticketType === "WIN5") {
    // 5レースすべての1着。同着でも着順は 1 なのでそのまま見ればいい
    return positions.every((position) => position === 1);
  }

  // 順序を問う券種は買った順のまま。順不同の券種は着順の小さい順に並べ直す
  const ordered = ticketType === "馬単" || ticketType === "3連単";
  return satisfiesRank(ordered ? positions : [...positions].sort((a, b) => a - b));
}

/** 「i番目の着順が i 以下」を見る。渡す時点で並び順は決まっている前提。 */
function satisfiesRank(positions: number[]): boolean {
  return positions.every((position, index) => position <= index + 1);
}

/** 複勝の的中上限。出走頭数が8頭以上なら3着、7頭以下なら2着。 */
export function placeLimit(results: EntryResult[]): number {
  const runners = countRunners(results);
  if (runners <= 4) {
    throw new Error("4頭以下では複勝は発売されません。");
  }
  return runners >= 8 ? 3 : 2;
}

/**
 * 出走頭数。
 *
 * 取消・除外**以外**の行数で数える。着順が入っている行だけを数えると、中止した馬が
 * 漏れて頭数を1つ少なく見積もる。
 */
export function countRunners(results: EntryResult[]): number {
  return results.filter((entry) => entry.status !== "取消" && entry.status !== "除外").length;
}

/**
 * 枠連の的中判定。
 *
 * 枠連だけは買った対象が馬ではなく枠なので、共通の規則をそのままは当てられない。
 * 「1着・2着になりうる馬の組」を共通の規則で先に出してから、その枠の組に
 * 買った組が含まれるかを見る。ゾロ目（同じ枠の2頭）もこれで自然に通る。
 */
function isBracketQuinellaHit(combination: number[], results: EntryResult[]): boolean {
  const bought = [...combination].sort((a, b) => a - b).join("-");

  const finishers = results.filter(
    (entry) => entry.finishPosition !== null && entry.bracketNumber !== null,
  );

  for (const first of finishers) {
    if ((first.finishPosition as number) > 1) continue;

    for (const second of finishers) {
      if (second.entryId === first.entryId) continue;
      if ((second.finishPosition as number) > 2) continue;

      const pair = [first.bracketNumber as number, second.bracketNumber as number]
        .sort((a, b) => a - b)
        .join("-");
      if (pair === bought) return true;
    }
  }

  return false;
}

/** 回収率。返還は払戻と同じく戻ってきた金額として扱う。 */
export function recoveryRate(bet: {
  payout: number | null;
  refund: number | null;
  totalAmount: number;
}): number {
  return ((bet.payout ?? 0) + (bet.refund ?? 0)) / bet.totalAmount;
}

/** 各列から1つずつ選ぶ全組み合わせ。 */
function cartesianProduct(legs: number[][]): number[][] {
  return legs.reduce<number[][]>(
    (rows, leg) => rows.flatMap((row) => leg.map((value) => [...row, value])),
    [[]],
  );
}

/** 並べ替えをすべて返す。 */
function permutations(row: number[]): number[][] {
  if (row.length <= 1) return [row];

  return row.flatMap((value, index) => {
    const rest = [...row.slice(0, index), ...row.slice(index + 1)];
    return permutations(rest).map((tail) => [value, ...tail]);
  });
}
