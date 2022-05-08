@serializable
export class StateSchema {
  divisibility: i32;
  balances: Map<string, i32> = new Map<string, i32>();
  canEvolve: boolean;
  evolve: string | null;
  name: string;
  owner: string;
  ticker: string;
  disputes: Map<string, DisputeSchema> = new Map<string, DisputeSchema>();
}

@serializable
export class DisputeSchema {
  id: string;
  title: string;
  description: string;
  options: string[];
  votes: VoteOptionSchema[];
  expirationTimestamp: i64;
  withdrawableAmounts: Map<string, i32>;
  calculated: boolean;
  winningOption: string;
}

@serializable
export class VoteOptionSchema {
  label: string;
  votes: Map<string, i32>;
}
@serializable
export class ActionSchema {
  function: string;
  contractTxId: string | null;
  evolve: EvolveSchema | null;
  balance: BalanceSchema | null;
  mint: MintSchema | null;
  transfer: TransferSchema | null;
  createDispute: CreateDisputeSchema | null;
  vote: VoteSchema | null;
  withdrawReward: WithdrawRewardSchema | null;
}

@serializable
export class BalanceSchema {
  target: string;
}

@serializable
export class EvolveSchema {
  value: string;
}
@serializable
export class MintSchema {
  qty: i32;
}

@serializable
export class TransferSchema {
  target: string;
  qty: i32;
}

@serializable
export class CreateDisputeSchema {
  id: string;
  title: string;
  description: string;
  options: string[];
  expirationTimestamp: i64;
  initialStakeAmount: StakeSchema;
}

@serializable
export class StakeSchema {
  amount: i32;
  optionIndex: i32;
}
@serializable
export class VoteSchema {
  id: string;
  selectedOptionIndex: i32;
  stakeAmount: i32;
}

export class WithdrawRewardSchema {
  id: string;
}

@serializable
export class BalanceResultSchema {
  balance: i32;
  target: string;
  ticker: string;
}

@serializable
export class ResultSchema {
  dispute: DisputeSchema | null;
  balance: BalanceResultSchema | null;
}

@serializable
export class HandlerResultSchema {
  state: StateSchema | null;
  result: ResultSchema | null;
}
