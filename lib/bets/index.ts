// 券種・買い方・出走状態は「入っていい値」なので lib/enums/ にある。
// ここからは再輸出しない
export {
  countRunners,
  expandBet,
  isHit,
  placeLimit,
  recoveryRate,
  usesBracketNumber,
  type BetInput,
  type EntryResult,
  type ExpandedBet,
} from "./bets.ts";
export {
  allocateEvenPayout,
  DEFAULT_BUDGET,
  maxProfitableCount,
  parseAllocateArgs,
  payoutPerUnit,
  type AllocateArgs,
  type EvenPayoutAllocation,
} from "./allocation.ts";
