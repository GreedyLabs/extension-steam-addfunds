/**
 * Pure, side-effect-free helpers for currency parsing and amount validation.
 * Imported by content.ts and unit-tested directly under Vitest.
 */

export interface CurrencyParts {
  group: string;
  decimal: string;
  symbol: string;
}

/**
 * Extract the group separator, decimal separator, and currency symbol that a
 * given Intl.NumberFormat uses, by inspecting a formatted sample number.
 * Computed once per formatter and reused for every parse.
 */
export function getCurrencyParts(formatter: Intl.NumberFormat): CurrencyParts {
  const parts = formatter.formatToParts(1234.5);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? '',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    symbol: parts.find((p) => p.type === 'currency')?.value ?? '',
  };
}

/**
 * Parse a locale-formatted currency string (e.g. "₩ 5,000", "$10.50") into a
 * plain number, using the separators/symbol from getCurrencyParts. Falls back
 * to a digit-only regex if the locale-aware parse fails.
 *
 * @returns the parsed amount, or NaN if nothing numeric is present
 */
export function parseCurrencyText(text: string, parts: CurrencyParts): number {
  let cleaned = text.trim();
  if (parts.symbol) cleaned = cleaned.split(parts.symbol).join('');
  if (parts.group) cleaned = cleaned.split(parts.group).join('');
  if (parts.decimal && parts.decimal !== '.') cleaned = cleaned.replace(parts.decimal, '.');
  cleaned = cleaned.trim();

  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : parseFloat(text.replace(/[^\d.]/g, ''));
}

export type AmountStatus = 'empty' | 'below' | 'valid';

export interface AmountResult {
  status: AmountStatus;
  amount: number;
}

/**
 * Classify a raw user-entered value against the minimum allowed amount.
 *   - 'empty': blank or non-numeric input
 *   - 'below': numeric but under the minimum
 *   - 'valid': numeric and at or above the minimum
 */
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
