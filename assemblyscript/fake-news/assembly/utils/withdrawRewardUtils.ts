export const findLargestElementInTheList = (list: Map<string, i32>[]): i32 => {
  let sumsList: i32[] = [];
  for (let i = 0; i < list.length; i++) {
    const sum = getSum(list[i].values());
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
  if (list.length === 0) {
    return -1;
  }

  let max = list[0];
  let maxIndex = 0;

  for (var i = 1; i < list.length; i++) {
    if (list[i] > max) {
      maxIndex = i;
      max = list[i];
    }
  }

  return maxIndex;
}

export const isWhatPercentOf = (numA: i32, numB: i32): i32 => {
  return (100 * numA) / numB;
};

export const percentFrom = (percent: i32, num: i32): i32 => {
  return (percent * num) / 100;
};
