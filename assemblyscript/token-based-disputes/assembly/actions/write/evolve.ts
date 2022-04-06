import { ActionSchema, StateSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';
import { ResultSchema } from '../../schemas';
import { Contract } from '../../imports';

export function evolve(state: StateSchema, action: ActionSchema): ResultSchema {
  const evolve = action.evolve!!.value;
  const contractOwner = Contract.owner();
  const sender = Transaction.owner();

  if (sender != contractOwner) {
    throw new Error('[CE:EPE] Evolve permissions error - only contract owner can evolve');
  }

  if (!state.canEvolve) {
    throw new Error('[CE:ECE] Evolve not allowed');
  }

  state.evolve = evolve;

  return {
    state,
    balances: null,
    dispute: null,
  };
}
