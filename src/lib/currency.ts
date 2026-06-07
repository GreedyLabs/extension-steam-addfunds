/** Currency metadata (from Intl) and amount validation. */

export interface CurrencyParts {
  group: string;
  decimal: string;
  symbol: string;
}

/** Group/decimal separators and currency symbol used by an Intl formatter. */
export function getCurrencyParts(formatter: Intl.NumberFormat): CurrencyParts {
  const parts = formatter.formatToParts(1234.5);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? '',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    symbol: parts.find((p) => p.type === 'currency')?.value ?? '',
  };
}

export type AmountStatus = 'empty' | 'below' | 'valid';

export interface AmountResult {
  status: AmountStatus;
  amount: number;
}

/** Classify a raw value: blank/non-numeric → empty, under min → below, else valid. */
export function evaluateAmount(
  rawValue: string | null | undefined,
  minAmount: number,
): AmountResult {
  if (rawValue == null || String(rawValue).trim() === '') {
    return { status: 'empty', amount: NaN };
  }
  const amount = parseFloat(rawValue);
  if (Number.isNaN(amount)) return { status: 'empty', amount: NaN };
  if (amount < minAmount) return { status: 'below', amount };
  return { status: 'valid', amount };
}
