import { VoteOptionSchema } from '../schemas';

export const findLargestElementInTheList = (list: VoteOptionSchema[]): i32 => {
  let sumsList: i32[] = [];
  for (let i = 0; i < list.length; i++) {
    let listValues: i32[] = [];

    for (let j = 0; j < list[i].votes.values().length; j++) {
      listValues.push(list[i].votes.values()[j].quadraticAmount);
    }
    const sum = getSum(listValues);
    sumsList.push(sum);
  }
  return indexOfMax(sumsList);
};

export function getSum(valuesList: i32[]): i32 {
  let sum = 0;
  for (let i = 0; i < valuesList.length; i++) {
    sum += valuesList[i];
  }
  return sum;
}

function indexOfMax(list: i32[]): i32 {
  let max = list[0];
  let maxIndex = 0;
  let maxCounter = 1;

  for (let i = 1; i < list.length; i++) {
    if (list[i] > max) {
      maxIndex = i;
      max = list[i];
      maxCounter = 1;
    } else if (list[i] == max) {
      maxCounter++;
    }
  }

  if (maxCounter > 1) {
    return -1;
  }
  return maxIndex;
}

export const percentOf = (numA: i32, numB: i32, divisibility: i32): i32 => {
  return ((100 * divisibility * (numA as u64)) / (numB as u64)) as i32;
};

export const percentFrom = (percent: i32, num: i32, divisibility: i32): i32 => {
  return (((percent as u64) * (num as u64)) / (divisibility * 100)) as i32;
};
