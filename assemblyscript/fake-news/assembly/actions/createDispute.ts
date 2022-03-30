import { ActionSchema, HandlerResultSchema, StateSchema } from '../schemas';
import { Transaction } from '../imports/smartweave/transaction';
import { Block } from '../imports/smartweave/block';

export function createDispute(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const id = action.createDispute!!.id;
  const title = action.createDispute!!.title;
  const description = action.createDispute!!.description;
  const options = action.createDispute!!.options;
  const expirationBlocks = action.createDispute!!.expirationBlocks;
  const initialStakeAmount = action.createDispute!!.initialStakeAmount;

  const caller = Transaction.owner();
  const expirationBlock = Block.height() + expirationBlocks;

  if (state.disputes.has(id)) {
    throw new Error(`[CE:NEB] Dispute with following id: ${id} has been already created.`);
  }

  if (initialStakeAmount && (!state.balances.has(caller) || state.balances.get(caller) < initialStakeAmount)) {
    throw new Error(`[CE:NEB] Caller balance not high enough to stake ${initialStakeAmount} token(s)!`);
  }

  const votesFor: Map<string, i32> = new Map<string, i32>();

  if (initialStakeAmount) {
    votesFor.set(caller, initialStakeAmount);
  }

  const votesAgainst: Map<string, i32> = new Map<string, i32>();
  const withdrawableAmounts: Map<string, i32> = new Map<string, i32>();
  const votes: Map<string, i32>[] = [votesFor, votesAgainst];

  state.disputes.set(id, {
    id,
    title,
    description,
    options,
    votes,
    expirationBlock,
    withdrawableAmounts,
    calculated: false,
  });

  return {
    state,
    dispute: state.disputes.get(id),
    result: null,
  };
}
