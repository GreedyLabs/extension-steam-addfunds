import { describe, expect, it } from 'vitest';
import { createCartHref, readCartContext } from '../src/lib/cart-context';
import { deriveFormat } from '../src/lib/money';

const KRW = deriveFormat(500000, '₩ 5,000');
const USD = deriveFormat(500, '$5.00');
const EUR = deriveFormat(500, '5,00 €');

describe('cart amount handoff', () => {
  it('creates a real Steam add-funds link containing only the requested amount', () => {
    const href = createCartHref({ amount: 50983, format: KRW });
    expect(href).toBe('https://store.steampowered.com/steamaccount/addfunds/#shp=50983');
    expect(readCartContext(new URL(href).hash, KRW)).toEqual({ requested: 50983 });
  });

  it('handles decimal USD and comma-decimal EUR as plain decimal URL values', () => {
    for (const format of [USD, EUR]) {
      const url = new URL(createCartHref({ amount: 37.66, format }));
      expect(url.hash).toBe('#shp=37.66');
      expect(readCartContext(url.hash, format)).toEqual({ requested: 37.66 });
    }
  });

  it('preserves amount-only hashes and ignores legacy cart metadata', () => {
    expect(readCartContext('#shp=5000', KRW)).toEqual({ requested: 5000 });
    const legacy = new URLSearchParams({
      shp: '5000',
      shp_cart: '9000',
      shp_currency: JSON.stringify([KRW.factor, KRW.prefix.trim(), KRW.suffix.trim()]),
    });
    expect(readCartContext(`#${legacy}`, KRW)).toEqual({ requested: 5000 });
    legacy.set('shp_currency', 'different currency');
    legacy.set('shp_cart', 'invalid metadata');
    legacy.append('shp_cart', '10000');
    expect(readCartContext(`#${legacy}`, KRW)).toEqual({ requested: 5000 });
  });

  it.each([
    '',
    '#shp=',
    '#shp=0',
    '#shp=-1',
    '#shp=NaN',
    '#shp=Infinity',
    '#shp=5000foo',
    '#shp=5e3',
    '#shp=0x1000',
    '#shp=+5000',
    '#shp=%205000',
    '#shp=5,000',
    '#shp=5000&shp=6000',
    '#shp=9007199254740991',
    '#shp=0.001',
    '#shp=%ZZ',
    `#shp=${'0'.repeat(70)}5000`,
    `#shp=5000&extra=${'x'.repeat(2048)}`,
  ])('rejects malformed or unsafe hash %s', (hash) => {
    expect(readCartContext(hash, KRW)).toEqual({ requested: null });
  });

  it('does not recover an invalid requested amount from ignored cart metadata', () => {
    expect(readCartContext('#shp=bad&shp_cart=9000&shp_currency=KRW', KRW)).toEqual({
      requested: null,
    });
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid currency factor %s', (factor) => {
    expect(readCartContext('#shp=5000', { ...KRW, factor })).toEqual({ requested: null });
  });

  it('returns the safe destination without prefill when asked to generate an invalid amount', () => {
    for (const value of [NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER]) {
      expect(createCartHref({ amount: value, format: KRW })).toBe(
        'https://store.steampowered.com/steamaccount/addfunds/',
      );
    }
  });
});
