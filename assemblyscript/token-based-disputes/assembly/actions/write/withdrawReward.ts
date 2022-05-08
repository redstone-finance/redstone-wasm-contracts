import { ActionSchema, DisputeSchema, HandlerResultSchema, StateSchema, VoteOptionSchema } from '../../schemas';
import { Transaction } from '../../imports/smartweave/transaction';
import { Block } from '../../imports/smartweave/block';
import { findLargestElementInTheList, getSum, percentOf, percentFrom } from '../../utils/withdrawRewardUtils';

export function withdrawReward(state: StateSchema, action: ActionSchema): HandlerResultSchema {
  const id = action.withdrawReward!!.id;
  const caller = Transaction.owner();
  const dispute = state.disputes.get(id);
  const currentTimestamp = (Block.timestamp() as i64) * 1000;
  const expirationTimestamp = dispute.expirationTimestamp;
  const votesList = dispute.votes;
  const divisibility = state.divisibility;

  if (!state.disputes.has(id)) {
    throw new Error(`[CE:DNE] Dispute does not yet exist.`);
  }

  if (currentTimestamp < expirationTimestamp) {
    throw new Error(
      `[CE:DNE] Dispute has not yet ended. Expiration timestamp: ${expirationTimestamp}. Current timestamp: ${currentTimestamp}`
    );
  }

  // verify if caller is authorized to withdraw the reward
  let isOnList = false;
  for (let i = 0; i < votesList.length; i++) {
    if (votesList[i].votes.has(caller)) {
      isOnList = true;
      break;
    }
  }

  if (!isOnList) {
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
      setWithdrawableRewards(dispute, votesList, winningOption, divisibility);
      dispute.winningOption = votesList[winningOption].label;
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
    result: null,
  };
}

const setWithdrawableRewards = (
  dispute: DisputeSchema,
  votesList: VoteOptionSchema[],
  winningOption: i32,
  divisibility: i32
): void => {
  const winningListVotes = votesList[winningOption].votes;
  const winningListHolders = votesList[winningOption].votes.keys();
  const winningListStakedTokens = votesList[winningOption].votes.values();

  for (let i = 0; i < winningListHolders.length; i++) {
    // calculate percentage between winning pool and amount of tokens which holder staked
    const sumWinning: i32 = getSum(winningListStakedTokens);
    const percentage: i32 = percentOf(winningListVotes.get(winningListHolders[i]), sumWinning, divisibility);

    // calculate reward - percentage of the lost pool - which will be a reward for the PST holder
    let sumLost: i32 = 0;
    for (let i = 0; i < votesList.length; i++) {
      if (i == winningOption) {
        continue;
      }
      const sum = getSum(votesList[i].votes.values());
      sumLost += sum;
    }
    const calculatedReward: i32 = percentFrom(percentage, sumLost, divisibility);

    // add calculated reward and staked tokens to the `withdrawableAmounts` map
    dispute.withdrawableAmounts.set(
      winningListHolders[i],
      calculatedReward + winningListVotes.get(winningListHolders[i])
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
