import { ActionSchema, HandlerResultSchema, StateSchema } from '../schemas';
import { Transaction } from '../imports/smartweave/transaction';
import { Block } from '../imports/smartweave/block';
import { findLargestElementInTheList, getSum, isWhatPercentOf, percentFrom } from '../utils/withdrawRewardUtils';

export function withdrawReward(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const id = action.withdrawReward!!.id;
  const caller = Transaction.owner();
  const currentBlock = Block.height();
  const expirationBlock = state.disputes.get(id).expirationBlock;
  const votesList = state.disputes.get(id).votes;

  if (!state.disputes.has(id)) {
    throw new Error(`[CE:DNE] Dispute does not yet exist.`);
  }

  if (currentBlock < expirationBlock) {
    throw new Error(
      `[CE:DNE] Dispute has not yet ended. Expiration block: ${expirationBlock}. Current block: ${currentBlock}`
    );
  }

  let isOnList: bool[] = [];
  for (let i = 0; i < votesList.length; i++) {
    isOnList.push(votesList[i].has(caller));
  }

  if (!isOnList.includes(true)) {
    throw new Error(`[CE:CNA] Caller is not authorized to withdraw the reward ${isOnList}`);
  }

  // only the first PST holder to withdraw the reward need to calculate all the rewards and set 'calculated' flag to true
  if (!state.disputes.get(id).calculated) {
    // check which option got the most tokens staked for
    const winningOption: i32 = findLargestElementInTheList(votesList);

    // set rewards for the holders who staked for the winning option, based on what is the pool and how much they staked
    const setWithdrawableRewards = (
      votesList: Map<string, i32>[],
      winningOption: i32,
      state: StateSchema,
      id: string
    ): void => {
      const winningList = votesList[winningOption];
      for (let i = 0; i < winningList.keys().length; i++) {
        // calculate percentage between winning pool and amount of tokens which holder staked
        const sumWinning: i32 = getSum(winningList.values());
        const percentage: i32 = isWhatPercentOf(winningList.get(winningList.keys()[i]), sumWinning);

        // calculate reward - percentage of the lost pool - which will be a reward for the PST holder
        const sumLost: i32 = getSum(votesList[winningOption == 0 ? 1 : 0].values());
        const calculatedReward: i32 = percentFrom(percentage, sumLost);

        // add calculated reward to the `withdrawableAmounts` map
        state.disputes.get(id).withdrawableAmounts.set(winningList.keys()[i], calculatedReward);
      }
    };

    setWithdrawableRewards(votesList, winningOption, state, id);

    state.disputes.get(id).calculated = true;
  }

  if (state.disputes.get(id).withdrawableAmounts.get(caller) <= 0) {
    throw new Error(`[CE:CWR] Caller has already withdrew the reward`);
  }

  if (state.disputes.get(id).withdrawableAmounts.get(caller) > 0) {
    const amountToWithdraw = state.disputes.get(id).withdrawableAmounts.get(caller);
    state.balances.set(caller, state.balances.get(caller) + amountToWithdraw);
    state.disputes.get(id).withdrawableAmounts.set(caller, 0);
  }

  return {
    state,
    dispute: state.disputes.get(id),
    result: null,
  };
}
