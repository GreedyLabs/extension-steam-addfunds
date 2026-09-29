/** Currency metadata (from Intl) and amount validation. */
import type { DigitGrouping } from './money';

export interface CurrencyParts {
  group: string;
  decimal: string;
  symbol: string;
  grouping: DigitGrouping;
}

/** Keep the locale's symbol position while separating it from the amount by one space. */
export function formatCurrencyWithSpacing(formatter: Intl.NumberFormat, value: number): string {
  const parts = formatter.formatToParts(value);
  const currencyIndex = parts.findIndex((part) => part.type === 'currency');
  if (currencyIndex === -1) return formatter.format(value);
  const before = parts
    .slice(0, currencyIndex)
    .map((part) => part.value)
    .join('');
  const afterParts = parts.slice(currencyIndex + 1);
  const after = afterParts.map((part) => part.value).join('');
  const symbol = parts[currencyIndex].value;
  return afterParts.some((part) => part.type === 'integer')
    ? `${before}${symbol} ${after.trimStart()}`
    : `${before.trimEnd()} ${symbol}${after}`;
}

/** Group/decimal separators and currency symbol used by an Intl formatter. */
export function getCurrencyParts(formatter: Intl.NumberFormat): CurrencyParts {
  const parts = formatter.formatToParts(1234567.5);
  const integers = parts.filter((part) => part.type === 'integer');
  // Whole-unit currencies omit decimals, but their locale still defines which
  // separator a pasted fractional suffix uses. It may not be a period.
  const localeParts = new Intl.NumberFormat(formatter.resolvedOptions().locale).formatToParts(1.5);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? '',
    decimal:
      parts.find((p) => p.type === 'decimal')?.value ??
      localeParts.find((p) => p.type === 'decimal')?.value ??
      '.',
    symbol: parts.find((p) => p.type === 'currency')?.value ?? '',
    grouping: {
      primary: integers.length > 1 ? (integers.at(-1)?.value.length ?? 3) : 3,
      secondary: integers.length > 2 ? (integers.at(-2)?.value.length ?? 3) : 3,
    },
  };
}

export type AmountStatus = 'empty' | 'invalid' | 'below' | 'valid';

export interface AmountResult {
  status: AmountStatus;
  amount: number;
}

/** Classify an unformatted, nonnegative amount without accepting numeric prefixes. */
export function evaluateAmount(
  rawValue: string | null | undefined,
  minAmount: number,
): AmountResult {
  if (rawValue == null || String(rawValue).trim() === '') {
    return { status: 'empty', amount: NaN };
  }
  const text = String(rawValue).trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return { status: 'invalid', amount: NaN };
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) {
    return { status: 'invalid', amount: NaN };
  }
  if (amount < minAmount) return { status: 'below', amount };
  return { status: 'valid', amount };
}
