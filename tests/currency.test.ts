import { describe, it, expect } from 'vitest';
import { getCurrencyParts, evaluateAmount } from '../src/lib/currency';

const krw = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

describe('getCurrencyParts', () => {
  it('extracts separators and symbol for KRW (no decimals, comma groups)', () => {
    const parts = getCurrencyParts(krw);
    expect(parts.group).toBe(',');
    expect(parts.symbol).toContain('₩');
  });

  it('extracts separators and symbol for USD (dot decimal, comma groups)', () => {
    const parts = getCurrencyParts(usd);
    expect(parts.group).toBe(',');
    expect(parts.decimal).toBe('.');
    expect(parts.symbol).toBe('$');
  });
});

describe('evaluateAmount', () => {
  const min = 5000;

  it('reports empty for blank input', () => {
    expect(evaluateAmount('', min)).toEqual({ status: 'empty', amount: NaN });
  });

  it('reports empty for non-numeric input', () => {
    expect(evaluateAmount('abc', min)).toEqual({ status: 'empty', amount: NaN });
  });

  it('reports below when under the minimum', () => {
    expect(evaluateAmount('1000', min)).toEqual({ status: 'below', amount: 1000 });
  });

  it('reports valid at exactly the minimum', () => {
    expect(evaluateAmount('5000', min)).toEqual({ status: 'valid', amount: 5000 });
  });

  it('reports valid above the minimum', () => {
    expect(evaluateAmount('10000', min)).toEqual({ status: 'valid', amount: 10000 });
  });
});
