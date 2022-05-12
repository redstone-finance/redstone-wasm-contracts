import {
  ActionSchema,
  HandlerResultSchema,
  StakeAndQuadraticSchema,
  StateSchema,
  VoteOptionSchema,
} from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';
import { Block } from '../../imports/smartweave/block';
import { quadraticFormula } from '../../utils/quadraticFormula';

export function createDispute(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const id = action.createDispute!!.id;
  const title = action.createDispute!!.title;
  const description = action.createDispute!!.description;

  const options = action.createDispute!!.options;
  const expirationTimestamp = action.createDispute!!.expirationTimestamp;
  const initialStakeAmount = action.createDispute!!.initialStakeAmount;

  const currentTimestamp = (Block.timestamp() as i64) * 1000;

  const caller = Transaction.owner();

  if (state.disputes.has(id)) {
    throw new Error(`[CE:DAC] Dispute with following id: ${id} has been already created.`);
  }

  if (initialStakeAmount && (!state.balances.has(caller) || state.balances.get(caller) < initialStakeAmount.amount)) {
    throw new Error(`[CE:NEB] Caller balance not high enough to stake ${initialStakeAmount.amount} token(s)!`);
  }

  let votes: VoteOptionSchema[] = [];

  for (let i = 0; i < options.length; i++) {
    votes.push({ label: options[i], votes: new Map<string, StakeAndQuadraticSchema>() });
  }

  if (initialStakeAmount) {
    votes[initialStakeAmount.optionIndex].votes.set(caller, {
      stakedAmount: initialStakeAmount.amount,
      quadraticAmount: quadraticFormula(initialStakeAmount.amount),
    });
    state.balances.set(caller, state.balances.get(caller) - initialStakeAmount.amount);
  }

  const withdrawableAmounts: Map<string, i32> = new Map<string, i32>();

  state.disputes.set(id, {
    id,
    title,
    description,
    options,
    votes,
    expirationTimestamp,
    withdrawableAmounts,
    calculated: false,
    winningOption: '',
    creationTimestamp: currentTimestamp,
  });

  return {
    state,
    result: null,
  };
}
