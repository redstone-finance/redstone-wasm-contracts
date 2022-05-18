export const quadraticFormula = (amount: u64, divisibility: i32): u64 => sqrt(amount) / sqrt(divisibility);

function sqrt(x: u64): u64 {
  let y = 0 as u64;
  let z = (x + 1) / 2;
  y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / 2;
  }

  return y;
}
