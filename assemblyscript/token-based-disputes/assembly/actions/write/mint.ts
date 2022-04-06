import { ActionSchema, ResultSchema, StateSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';

export function mint(state: StateSchema, action: ActionSchema): ResultSchema {
  const qty = action.mint!!.qty;

  if (qty > 1000) {
    throw new Error(`[CE:NPM] It is not possible to mint more than 1000 tokens`);
  }

  const caller = Transaction.owner();

  state.balances.set(caller, state.balances.get(caller) + qty);

  return {
    state,
    balances: null,
    dispute: null,
  };
}
