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
    expect(parts.grouping).toEqual({ primary: 3, secondary: 3 });
  });

  it('learns Indian grouping widths from the locale formatter', () => {
    const parts = getCurrencyParts(
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
    );
    expect(parts.group).toBe(',');
    expect(parts.decimal).toBe('.');
    expect(parts.grouping).toEqual({ primary: 3, secondary: 2 });
  });

  it('learns the locale decimal separator even when the currency omits fractions', () => {
    const parts = getCurrencyParts(
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'JPY' }),
    );
    expect(parts.group).toBe('.');
    expect(parts.decimal).toBe(',');
  });

  it('finds grouping in locales that do not group four-digit amounts', () => {
    const parts = getCurrencyParts(
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }),
    );
    expect(parts.group).toBe('.');
    expect(parts.decimal).toBe(',');
  });
});

describe('evaluateAmount', () => {
  const min = 5000;

  it('reports empty for blank input', () => {
    expect(evaluateAmount('', min)).toEqual({ status: 'empty', amount: NaN });
  });

  it.each(['abc', '5000abc', 'NaN', 'Infinity', '-5000', '+5000', '5e3', '5,000'])(
    'reports invalid for nonblank malformed input: %s',
    (value) => expect(evaluateAmount(value, min)).toEqual({ status: 'invalid', amount: NaN }),
  );

  it('rejects amounts that cannot be represented safely', () => {
    expect(evaluateAmount('9007199254740992', min)).toEqual({ status: 'invalid', amount: NaN });
    expect(evaluateAmount('9'.repeat(400), min)).toEqual({ status: 'invalid', amount: NaN });
  });

  it('accepts zero as an amount below the minimum, not an empty value', () => {
    expect(evaluateAmount('0', min)).toEqual({ status: 'below', amount: 0 });
  });

  it('supports decimal currency amounts and a trailing decimal point', () => {
    expect(evaluateAmount('5.25', 5)).toEqual({ status: 'valid', amount: 5.25 });
    expect(evaluateAmount('5.', 5)).toEqual({ status: 'valid', amount: 5 });
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
