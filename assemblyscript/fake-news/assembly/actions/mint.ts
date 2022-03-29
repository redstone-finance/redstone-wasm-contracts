import { ActionSchema, HandlerResultSchema, StateSchema } from '../schemas';
import { Transaction } from '../imports/smartweave/transaction';

export function mint(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const qty = action.mint!!.qty;

  const caller = Transaction.owner();

  state.balances.set(caller, state.balances.get(caller) + qty);

  return {
    state,
    result: null,
    dispute: null,
  };
}
