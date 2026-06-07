import { describe, it, expect } from 'vitest';
import { normalizeAmount, groupAmount, parseAmount, formatView } from '../src/lib/amount-field';

const KRW = { group: ',', decimal: '', decimals: 0 };
const USD = { group: ',', decimal: '.', decimals: 2 };
const EU = { group: '.', decimal: ',', decimals: 2 };

describe('normalizeAmount', () => {
  it('strips grouping and non-numeric chars (KRW)', () => {
    expect(normalizeAmount('₩ 50,983', KRW)).toBe('50983');
  });

  it('drops decimals for whole-unit currencies', () => {
    expect(normalizeAmount('50.99', KRW)).toBe('5099'); // '.' ignored when decimals=0
  });

  it('keeps a trailing decimal while typing (USD)', () => {
    expect(normalizeAmount('50.', USD)).toBe('50.');
  });

  it('limits fractional digits to the currency scale', () => {
    expect(normalizeAmount('12.3456', USD)).toBe('12.34');
  });

  it('treats the locale decimal separator (EU comma)', () => {
    expect(normalizeAmount('1.234,56', EU)).toBe('1234.56');
  });

  it('strips leading zeros', () => {
    expect(normalizeAmount('00050983', KRW)).toBe('50983');
  });
});

describe('groupAmount', () => {
  it('groups KRW integers', () => {
    expect(groupAmount('50983', KRW)).toBe('50,983');
  });

  it('groups USD with decimals', () => {
    expect(groupAmount('1234.5', USD)).toBe('1,234.5');
  });

  it('preserves a trailing decimal point for typing', () => {
    expect(groupAmount('50983.', USD)).toBe('50,983.');
  });

  it('uses EU separators', () => {
    expect(groupAmount('1234.56', EU)).toBe('1.234,56');
  });
});

describe('parseAmount', () => {
  it('parses grouped KRW to a number', () => {
    expect(parseAmount('50,983', KRW)).toBe(50983);
  });

  it('parses USD decimals', () => {
    expect(parseAmount('1,234.50', USD)).toBe(1234.5);
  });

  it('returns NaN for empty input', () => {
    expect(parseAmount('', KRW)).toBeNaN();
    expect(parseAmount('₩', KRW)).toBeNaN();
  });

  it('ignores a trailing decimal point', () => {
    expect(parseAmount('50.', USD)).toBe(50);
  });
});

const KRW_SYM = { ...KRW, symbol: '₩', symbolBefore: true };
const EUR_SYM = { ...EU, symbol: '€', symbolBefore: false };

describe('formatView (with currency symbol)', () => {
  it('prepends the symbol for KRW', () => {
    expect(formatView(50983, KRW_SYM)).toBe('₩ 50,983');
  });

  it('appends the symbol for EUR', () => {
    expect(formatView(1234.56, EUR_SYM)).toBe('1.234,56 €');
  });

  it('renders empty for non-finite input', () => {
    expect(formatView(NaN, KRW_SYM)).toBe('');
  });

  it('falls back to grouping only when no symbol given', () => {
    expect(formatView(50983, KRW)).toBe('50,983');
  });
});

describe('parseAmount (strips currency symbol)', () => {
  it('parses a symbol-prefixed KRW view to the raw number', () => {
    expect(parseAmount('₩ 50,983', KRW_SYM)).toBe(50983);
  });

  it('parses a symbol-suffixed EUR view', () => {
    expect(parseAmount('1.234,56 €', EUR_SYM)).toBe(1234.56);
  });
});
