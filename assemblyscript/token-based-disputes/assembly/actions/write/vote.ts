import { ActionSchema, HandlerResultSchema, StateSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';
import { console } from '../../imports/console';

export function vote(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const id = action.vote!!.id;
  const selectedOptionIndex = action.vote!!.selectedOptionIndex;

  const stakeAmount = action.vote!!.stakeAmount;
  const dispute = state.disputes.get(id);
  const selectedOption = state.disputes.get(id).votes[selectedOptionIndex];

  const caller = Transaction.owner();

  if (!state.balances.has(caller) || state.balances.get(caller) < stakeAmount) {
    throw new Error(`[CE:NEB] Caller balance not high enough to stake ${stakeAmount} token(s)!`);
  }

  if (!state.disputes.has(id)) {
    throw new Error(`[CE:DNE] Dispute does not yet exist.`);
  }

  if (selectedOption.votes.has(caller)) {
    throw new Error(`[CE:CST] Caller has already staked tokens for the dispute.`);
  }

  selectedOption.votes.set(caller, stakeAmount);
  state.balances.set(caller, state.balances.get(caller) - stakeAmount);

  console.log(`New vote has been added to following dispute: ${dispute.id}`);

  return {
    state,
    dispute: state.disputes.get(id),
    result: null,
  };
}
