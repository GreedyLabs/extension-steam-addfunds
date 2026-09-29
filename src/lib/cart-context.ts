import type { MoneyFormat } from './money';

const ADDFUNDS_URL = 'https://store.steampowered.com/steamaccount/addfunds/';
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

/** Accept a decimal amount only when it maps exactly to safe integer minor units. */
function readAmount(text: string | null, factor: number): number | null {
  if (
    text === null ||
    text.length > 64 ||
    !/^\d+(?:\.\d+)?$/.test(text) ||
    !Number.isSafeInteger(factor) ||
    factor <= 0
  ) {
    return null;
  }
  const [whole, fraction = ''] = text.split('.');
  const numerator = BigInt(whole + fraction) * BigInt(factor);
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n || numerator % denominator !== 0n || numerator / denominator > MAX_MINOR) {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Pass only the requested amount to the independent add-funds page. */
export function createCartHref(args: { amount: number; format: MoneyFormat }): string {
  const { amount, format } = args;
  const amountText = String(amount);
  if (readAmount(amountText, format.factor) === null) {
    return ADDFUNDS_URL;
  }
  const hash = new URLSearchParams({ shp: amountText });
  return `${ADDFUNDS_URL}#${hash}`;
}

/** Read the amount from current or legacy links, ignoring any extra cart metadata. */
export function readCartContext(hash: string, format: MoneyFormat): { requested: number | null } {
  const empty = { requested: null };
  if (hash.length > 2048) return empty;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  if (params.getAll('shp').length !== 1) return empty;
  const requested = readAmount(params.get('shp'), format.factor);
  return { requested };
}
