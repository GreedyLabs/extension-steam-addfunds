export type TopUpMode = 'amount' | 'target';
export type TopUpStatus = 'valid' | 'invalid' | 'below' | 'covered' | 'unavailable';

export interface TopUpInput {
  mode: TopUpMode;
  value: number;
  balance: number | null;
  minimum: number;
  factor: number;
  decimals: number;
}

export interface TopUpCalculation {
  status: TopUpStatus;
  amount: number;
  amountMinor: number;
  balanceAfter: number | null;
  adjustedToMinimum: boolean;
  rounded: boolean;
}

const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

/** Convert the decimal representation exactly, without floating-point cent rounding. */
function toMinor(value: number, factor: number): bigint | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const [mantissa = '', exponent = '0'] = value.toString().split('e');
  const [whole = '', fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  let numerator = BigInt(whole + fraction) * BigInt(factor);
  if (scale < 0) numerator *= 10n ** BigInt(-scale);
  const denominator = scale > 0 ? 10n ** BigInt(scale) : 1n;
  if (numerator % denominator !== 0n) return null;
  const minor = numerator / denominator;
  return minor <= MAX_MINOR ? minor : null;
}

function emptyResult(status: TopUpStatus): TopUpCalculation {
  return {
    status,
    amount: 0,
    amountMinor: 0,
    balanceAfter: null,
    adjustedToMinimum: false,
    rounded: false,
  };
}

/** Calculate a direct top-up or the smallest allowed top-up reaching a target balance. */
export function calculateTopUp(input: TopUpInput): TopUpCalculation {
  const { mode, value, balance, minimum, factor, decimals } = input;
  if (
    (mode !== 'amount' && mode !== 'target') ||
    !Number.isSafeInteger(factor) ||
    factor <= 0 ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 15
  ) {
    return emptyResult('invalid');
  }

  const incrementValue = factor / 10 ** decimals;
  if (!Number.isSafeInteger(incrementValue) || incrementValue < 1) {
    return emptyResult('invalid');
  }
  const increment = BigInt(incrementValue);
  const valueMinor = toMinor(value, factor);
  const minimumMinor = toMinor(minimum, factor);
  const balanceMinor = balance === null ? null : toMinor(balance, factor);
  if (
    valueMinor === null ||
    minimumMinor === null ||
    minimumMinor <= 0n ||
    minimumMinor % increment !== 0n ||
    (balance !== null && balanceMinor === null)
  ) {
    return emptyResult('invalid');
  }
  if (mode === 'target' && balanceMinor === null) return emptyResult('unavailable');
  if (mode === 'amount' && valueMinor % increment !== 0n) return emptyResult('invalid');

  let status: TopUpStatus = 'valid';
  let amountMinor = valueMinor;
  let adjustedToMinimum = false;
  let rounded = false;
  if (mode === 'target' && balanceMinor !== null) {
    const shortfall = valueMinor - balanceMinor;
    if (shortfall <= 0n) {
      status = 'covered';
      amountMinor = 0n;
    } else {
      amountMinor = ((shortfall + increment - 1n) / increment) * increment;
      rounded = amountMinor !== shortfall;
      adjustedToMinimum = amountMinor < minimumMinor;
      if (adjustedToMinimum) amountMinor = minimumMinor;
    }
  } else if (amountMinor < minimumMinor) {
    status = 'below';
  }

  const balanceAfterMinor = balanceMinor === null ? null : balanceMinor + amountMinor;
  if (amountMinor > MAX_MINOR || (balanceAfterMinor !== null && balanceAfterMinor > MAX_MINOR)) {
    return emptyResult('invalid');
  }
  return {
    status,
    amount: Number(amountMinor) / factor,
    amountMinor: Number(amountMinor),
    balanceAfter: balanceAfterMinor === null ? null : Number(balanceAfterMinor) / factor,
    adjustedToMinimum,
    rounded,
  };
}
