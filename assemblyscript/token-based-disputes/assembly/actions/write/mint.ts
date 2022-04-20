import { ActionSchema, HandlerResultSchema, StateSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';

export function mint(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const qty = action.mint!!.qty;

  if (qty > 10000000) {
    throw new Error(`[CE:NPM] It is not possible to mint more than 10000000 tokens`);
  }

  const caller = Transaction.owner();

  if (state.balances.has(caller)) {
    state.balances.set(caller, state.balances.get(caller) + qty);
  } else {
    state.balances.set(caller, qty);
  }

  return {
    state,
    result: null,
  };
}
