import { VoteOptionSchema } from '../schemas';

export const findLargestElementInTheList = (list: VoteOptionSchema[]): i32 => {
  let sumsList: i32[] = [];
  for (let i = 0; i < list.length; i++) {
    const sum = getSum(list[i].votes.values());
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

export const percentOf = (numA: i32, numB: i32): f32 => {
  return (100 * (numA as f32)) / (numB as f32);
};

export const percentFrom = (percent: f32, num: i32): i32 => {
  return ((percent * (num as f32)) / 100) as i32;
};
