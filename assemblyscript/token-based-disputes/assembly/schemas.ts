@serializable
export class StateSchema {
  divisibility: i32;
  balances: Map<string, u64> = new Map<string, u64>();
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
  withdrawableAmounts: Map<string, u64>;
  calculated: boolean;
  winningOption: string;
  creationTimestamp: i64;
}

@serializable
export class VoteOptionSchema {
  label: string;
  votes: Map<string, StakeAndQuadraticSchema>;
}

@serializable
export class StakeAndQuadraticSchema {
  stakedAmount: u64;
  quadraticAmount: u64;
}

@serializable
export class ActionSchema {
  function: string;
  contractTxId: string;
  evolve: EvolveSchema;
  balance: BalanceSchema;
  mint: MintSchema;
  transfer: TransferSchema;
  createDispute: CreateDisputeSchema;
  vote: VoteSchema;
  withdrawReward: WithdrawRewardSchema;
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
  qty: u64;
}

@serializable
export class TransferSchema {
  target: string;
  qty: u64;
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
  amount: u64;
  optionIndex: i32;
}
@serializable
export class VoteSchema {
  id: string;
  selectedOptionIndex: i32;
  stakeAmount: u64;
}

export class WithdrawRewardSchema {
  id: string;
}

@serializable
export class BalanceResultSchema {
  balance: u64;
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
