import { describe, expect, it } from 'vitest';
import { calculateTopUp, type TopUpInput } from '../src/lib/topup';

const KRW: TopUpInput = {
  mode: 'amount',
  value: 5000,
  balance: 95277.85,
  minimum: 5000,
  factor: 100,
  decimals: 0,
};
const USD: TopUpInput = {
  mode: 'target',
  value: 50,
  balance: 12.34,
  minimum: 5,
  factor: 100,
  decimals: 2,
};

describe('calculateTopUp', () => {
  it('shows direct top-up projections without losing fractional KRW balance', () => {
    expect(calculateTopUp(KRW)).toEqual({
      status: 'valid',
      amount: 5000,
      amountMinor: 500000,
      balanceAfter: 100277.85,
      adjustedToMinimum: false,
      rounded: false,
    });
  });

  it('rounds a target shortfall up to whole won', () => {
    expect(calculateTopUp({ ...KRW, mode: 'target', value: 146260 })).toMatchObject({
      status: 'valid',
      amount: 50983,
      amountMinor: 5098300,
      balanceAfter: 146260.85,
      rounded: true,
      adjustedToMinimum: false,
    });
  });

  it('clamps target shortfalls to the Steam minimum', () => {
    expect(calculateTopUp({ ...KRW, mode: 'target', value: 96000 })).toMatchObject({
      status: 'valid',
      amount: 5000,
      balanceAfter: 100277.85,
      rounded: true,
      adjustedToMinimum: true,
    });
  });

  it('does not silently increase a direct top-up below the minimum', () => {
    expect(calculateTopUp({ ...KRW, value: 1000 })).toMatchObject({
      status: 'below',
      amount: 1000,
      amountMinor: 100000,
      adjustedToMinimum: false,
    });
  });

  it('calculates USD targets in exact cents', () => {
    expect(calculateTopUp(USD)).toMatchObject({
      status: 'valid',
      amount: 37.66,
      amountMinor: 3766,
      balanceAfter: 50,
      rounded: false,
    });
  });

  it.each([6.01, 8.03, 9.99, 12.34, 19.99])(
    'does not round an exact decimal target of %s up by one cent',
    (value) => {
      const result = calculateTopUp({ ...USD, value, balance: 0 });
      expect(result.status).toBe('valid');
      expect(result.amount).toBe(value);
      expect(result.balanceAfter).toBe(value);
      expect(result.rounded).toBe(false);
    },
  );

  it('subtracts decimal balances before rounding to avoid a spurious extra cent', () => {
    expect(calculateTopUp({ ...USD, value: 6.1, balance: 0.1 })).toMatchObject({
      amount: 6,
      amountMinor: 600,
      balanceAfter: 6.1,
      rounded: false,
    });
  });

  it.each([0, 12.34])('requires no top-up for an already covered target of %s', (value) => {
    expect(calculateTopUp({ ...USD, value })).toMatchObject({
      status: 'covered',
      amount: 0,
      amountMinor: 0,
      balanceAfter: 12.34,
    });
  });

  it('accepts a known zero balance', () => {
    expect(calculateTopUp({ ...USD, balance: 0 })).toMatchObject({
      status: 'valid',
      amount: 50,
      balanceAfter: 50,
    });
    expect(calculateTopUp({ ...USD, value: 0, balance: 0 }).status).toBe('covered');
  });

  it('blocks target mode when balance is unknown but permits direct top-ups', () => {
    expect(calculateTopUp({ ...USD, balance: null })).toMatchObject({
      status: 'unavailable',
      balanceAfter: null,
    });
    expect(calculateTopUp({ ...KRW, balance: null })).toMatchObject({
      status: 'valid',
      amount: 5000,
      balanceAfter: null,
    });
  });

  it.each([NaN, Infinity, -Infinity, -1, 1e30, Number.MAX_SAFE_INTEGER])(
    'rejects invalid or unsafe monetary input %s',
    (value) => {
      expect(calculateTopUp({ ...KRW, value }).status).toBe('invalid');
      expect(calculateTopUp({ ...KRW, balance: value }).status).toBe('invalid');
    },
  );

  it('rejects values finer than the currency increment or the underlying minor unit', () => {
    expect(calculateTopUp({ ...KRW, value: 5000.01 }).status).toBe('invalid');
    expect(calculateTopUp({ ...USD, value: 6.001 }).status).toBe('invalid');
  });

  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid minor-unit factor %s',
    (factor) => expect(calculateTopUp({ ...KRW, factor }).status).toBe('invalid'),
  );

  it.each([-1, 0.5, 3, 16, NaN, Infinity])('rejects incompatible precision %s', (decimals) => {
    expect(calculateTopUp({ ...KRW, decimals }).status).toBe('invalid');
  });

  it.each([0, -1, NaN, Infinity, 0.001, 5000.01])('rejects invalid minimum %s', (minimum) => {
    expect(calculateTopUp({ ...KRW, minimum }).status).toBe('invalid');
  });

  it('rejects a resulting wallet balance beyond safe integer minor units', () => {
    expect(
      calculateTopUp({
        ...KRW,
        factor: 1,
        balance: Number.MAX_SAFE_INTEGER,
      }).status,
    ).toBe('invalid');
  });
});
