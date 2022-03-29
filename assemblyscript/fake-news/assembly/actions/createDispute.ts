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

  if (initialStakeAmount && (!state.balances.has(caller) || state.balances.get(caller) < initialStakeAmount)) {
    throw new Error(`[CE:NEB] Caller balance not high enough to stake ${initialStakeAmount} token(s)!`);
  }

  const votesForMap: Map<string, i32> = new Map<string, i32>();

  if (initialStakeAmount) {
    votesForMap.set(caller, initialStakeAmount);
  }

  const votesAgainstMap: Map<string, i32> = new Map<string, i32>();
  const withdrawableAmounts: Map<string, i32> = new Map<string, i32>();
  const votes: Map<string, i32>[] = [votesForMap, votesAgainstMap];

  if (!state.disputes.has(id)) {
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
  }

  return {
    state,
    dispute: state.disputes.get(id),
    result: null,
  };
}
