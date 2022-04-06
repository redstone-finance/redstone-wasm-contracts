import { ActionSchema, DisputeSchema, ResultSchema, StateSchema, VoteOptionSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';
import { Block } from '../../imports/smartweave/block';
import { findLargestElementInTheList, getSum, percentOf, percentFrom } from '../../utils/withdrawRewardUtils';

export function withdrawReward(state: StateSchema, action: ActionSchema): ResultSchema {
  const id = action.withdrawReward!!.id;
  const caller = Transaction.owner();
  const dispute = state.disputes.get(id);
  const currentBlock = Block.height();
  const expirationBlock = dispute.expirationBlock;
  const votesList = dispute.votes;

  if (!state.disputes.has(id)) {
    throw new Error(`[CE:DNE] Dispute does not yet exist.`);
  }

  if (currentBlock < expirationBlock) {
    throw new Error(
      `[CE:DNE] Dispute has not yet ended. Expiration block: ${expirationBlock}. Current block: ${currentBlock}`
    );
  }

  // verify if caller is authorized to withdraw the reward
  let isOnList: bool[] = [];
  for (let i = 0; i < votesList.length; i++) {
    isOnList.push(votesList[i].votes.has(caller));
  }

  if (!isOnList.includes(true)) {
    throw new Error(`[CE:CNA] Caller is not authorized to withdraw the reward`);
  }

  // only the first PST holder to withdraw the reward need to calculate all the rewards and set 'calculated' flag to true
  if (!dispute.calculated) {
    // check which option got the most tokens staked for
    const winningOption: i32 = findLargestElementInTheList(votesList);

    if (winningOption == -1) {
      // in case of draw return staked tokens to the holders
      setWithdrawableRewardsDraw(dispute, votesList);
    } else {
      // set rewards for the holders who staked for the winning option, based on what is the pool and how much they staked
      setWithdrawableRewards(dispute, votesList, winningOption);
    }

    dispute.calculated = true;
  }

  if (!dispute.withdrawableAmounts.has(caller)) {
    throw new Error(`[CE:CWR] Caller has lost the dispute, is not authorized to withdraw the reward`);
  }

  if (dispute.withdrawableAmounts.get(caller) <= 0) {
    throw new Error(`[CE:CWR] Caller has already withdrew the reward`);
  }

  withdrawRewardToCaller(dispute, caller, state);

  return {
    state,
    dispute: state.disputes.get(id),
    balances: null,
  };
}

const setWithdrawableRewards = (dispute: DisputeSchema, votesList: VoteOptionSchema[], winningOption: i32): void => {
  const winningList = votesList[winningOption];
  for (let i = 0; i < winningList.votes.keys().length; i++) {
    // calculate percentage between winning pool and amount of tokens which holder staked
    const sumWinning: i32 = getSum(winningList.votes.values());
    const percentage: f32 = percentOf(winningList.votes.get(winningList.votes.keys()[i]), sumWinning);

    // calculate reward - percentage of the lost pool - which will be a reward for the PST holder
    const sumLost: i32 = getSum(votesList[winningOption == 0 ? 1 : 0].votes.values());
    const calculatedReward: i32 = percentFrom(percentage, sumLost);

    // add calculated reward and staked tokens to the `withdrawableAmounts` map
    dispute.withdrawableAmounts.set(
      winningList.votes.keys()[i],
      calculatedReward + winningList.votes.get(winningList.votes.keys()[i])
    );
  }
};

const setWithdrawableRewardsDraw = (dispute: DisputeSchema, votesList: VoteOptionSchema[]): void => {
  for (let i = 0; i < votesList.length; i++) {
    for (let j = 0; j < votesList[i].votes.keys().length; j++) {
      dispute.withdrawableAmounts.set(votesList[i].votes.keys()[j], votesList[i].votes.values()[j]);
    }
  }
};

const withdrawRewardToCaller = (dispute: DisputeSchema, caller: string, state: StateSchema): void => {
  const amountToWithdraw = dispute.withdrawableAmounts.get(caller);
  state.balances.set(caller, state.balances.get(caller) + amountToWithdraw);
  dispute.withdrawableAmounts.set(caller, 0);
};
