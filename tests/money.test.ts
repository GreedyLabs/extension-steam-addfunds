import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  deriveFactor,
  deriveFormat,
  formatMoney,
  computeTopUp,
} from '../src/lib/money';

describe('parseMoney', () => {
  it('parses KRW balance with fractional minor units', () => {
    expect(parseMoney('₩ 95,277.85')).toEqual({ value: 95277.85, decimals: 2 });
  });

  it('parses whole KRW amount (no decimals)', () => {
    expect(parseMoney('₩ 146,260')).toEqual({ value: 146260, decimals: 0 });
  });

  it('parses USD with dot decimal', () => {
    expect(parseMoney('$1,234.50')).toEqual({ value: 1234.5, decimals: 2 });
  });

  it('parses EU format (dot group, comma decimal)', () => {
    expect(parseMoney('1.234,56 €')).toEqual({ value: 1234.56, decimals: 2 });
  });

  it('parses space-grouped format', () => {
    expect(parseMoney('1 234,56 zł')).toEqual({ value: 1234.56, decimals: 2 });
  });
});

describe('deriveFactor', () => {
  it('derives ×100 for KRW from the cart subtotal pair', () => {
    expect(deriveFactor(14626000, '₩ 146,260')).toBe(100);
  });

  it('derives ×100 for USD', () => {
    expect(deriveFactor(1650, '$16.50')).toBe(100);
  });
});

describe('deriveFormat', () => {
  it('learns the KRW display format', () => {
    expect(deriveFormat(14626000, '₩ 146,260')).toEqual({
      prefix: '₩ ',
      suffix: '',
      group: ',',
      decimal: '',
      decimals: 0,
      factor: 100,
    });
  });
});

describe('formatMoney', () => {
  it('round-trips a KRW amount through the learned format', () => {
    const fmt = deriveFormat(14626000, '₩ 146,260');
    expect(formatMoney(50983, fmt)).toBe('₩ 50,983');
  });

  it('formats USD with two decimals and grouping', () => {
    const fmt = deriveFormat(1650, '$16.50');
    expect(formatMoney(1234.5, fmt)).toBe('$1,234.50');
  });
});

describe('computeTopUp', () => {
  it('computes the rounded-up shortfall for the real cart payload', () => {
    const t = computeTopUp({
      subtotalMinor: '14626000',
      subtotalFormatted: '₩ 146,260',
      balanceText: '₩ 95,277.85',
    });
    expect(t.subtotalCents).toBe(14626000);
    expect(t.balanceCents).toBe(9527785);
    expect(t.shortfallCents).toBe(5098215);
    expect(t.neededCents).toBe(5098300); // rounded up to whole won
    expect(t.neededDisplay).toBe(50983);
    expect(formatMoney(t.neededDisplay, t.format)).toBe('₩ 50,983');
  });

  it('returns zero when the balance already covers the cart', () => {
    const t = computeTopUp({
      subtotalMinor: '5000000',
      subtotalFormatted: '₩ 50,000',
      balanceText: '₩ 95,277.85',
    });
    expect(t.shortfallCents).toBe(0);
    expect(t.neededCents).toBe(0);
    expect(t.neededDisplay).toBe(0);
  });

  it('rounds USD shortfall up to the cent', () => {
    const t = computeTopUp({
      subtotalMinor: '5000',
      subtotalFormatted: '$50.00',
      balanceText: '$12.34',
    });
    expect(t.balanceCents).toBe(1234);
    expect(t.neededCents).toBe(3766);
    expect(t.neededDisplay).toBe(37.66);
  });
});
