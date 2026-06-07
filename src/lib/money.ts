/**
 * Self-calibrating money helpers shared by the add-funds and cart scripts.
 *
 * Steam stores every amount as integer minor units ("cents", value × 100) and
 * renders a currency-specific string. Instead of a per-currency table, we learn
 * the factor, separators, and symbol from a known (minorUnits, formattedText)
 * pair Steam already puts on the page, then reuse it to parse/format others.
 */

export interface MoneyFormat {
  prefix: string;
  suffix: string;
  group: string;
  decimal: string;
  decimals: number;
  factor: number; // minor units per display unit (e.g. 100)
}

/** Insert a thousands separator into a run of digits. */
export function groupInteger(digits: string, sep: string): string {
  if (!sep || digits.length <= 3) return digits;
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return out;
}

/** Split a formatted amount into the text before/after the number and the numeric core. */
function extractNumeric(text: string): { prefix: string; numCore: string; suffix: string } {
  const first = text.search(/\d/);
  if (first === -1) return { prefix: text, numCore: '', suffix: '' };
  let last = text.length - 1;
  while (last >= 0 && (text[last] < '0' || text[last] > '9')) last -= 1;
  return {
    prefix: text.slice(0, first),
    numCore: text.slice(first, last + 1),
    suffix: text.slice(last + 1),
  };
}

/** Parse a numeric core, self-detecting which separator is the decimal point. */
function normalizeNumber(core: string): {
  value: number;
  decimals: number;
  group: string;
  decimal: string;
} {
  let group = '';
  let decimal = '';
  let decimals = 0;

  // Spaces/apostrophes are always grouping separators; note then drop them.
  const spaceGroup = /\d[\s'’]\d/.exec(core);
  let s = core.replace(/[\s'’]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    group = decimal === ',' ? '.' : ',';
    s = s.split(group).join('');
    const i = s.lastIndexOf(decimal);
    decimals = s.length - i - 1;
    s = `${s.slice(0, i)}.${s.slice(i + 1)}`;
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const count = s.split(sep).length - 1;
    const after = s.length - s.lastIndexOf(sep) - 1;
    if (count === 1 && (after === 1 || after === 2)) {
      decimal = sep;
      decimals = after;
      s = s.replace(sep, '.');
    } else {
      group = sep;
      s = s.split(sep).join('');
    }
  }

  if (!group && spaceGroup) group = spaceGroup[1];
  return { value: parseFloat(s), decimals, group, decimal };
}

/** Parse any formatted money string into a plain value + the decimals it showed. */
export function parseMoney(text: string): { value: number; decimals: number } {
  const { value, decimals } = normalizeNumber(extractNumeric(text).numCore);
  return { value, decimals };
}

/** Minor-units-per-display-unit, snapped to a power of ten (Steam uses ×100). */
export function deriveFactor(minorUnits: number | string, formattedText: string): number {
  const { value } = parseMoney(formattedText);
  if (!value || !Number.isFinite(value)) return 100;
  const raw = Number(minorUnits) / value;
  return 10 ** Math.max(0, Math.round(Math.log10(raw)));
}

/** Learn the full display format (symbol, separators, decimals, factor) from a known pair. */
export function deriveFormat(minorUnits: number | string, formattedText: string): MoneyFormat {
  const { prefix, numCore, suffix } = extractNumeric(formattedText);
  const n = normalizeNumber(numCore);
  return {
    prefix,
    suffix,
    // If the sample was too small to show grouping, infer it from the decimal.
    group: n.group || (n.decimal === ',' ? '.' : ','),
    decimal: n.decimal,
    decimals: n.decimals,
    factor: deriveFactor(minorUnits, formattedText),
  };
}

/** Render a value using a learned MoneyFormat. */
export function formatMoney(value: number, fmt: MoneyFormat): string {
  const sign = value < 0 ? '-' : '';
  const fixed = Math.abs(value).toFixed(fmt.decimals);
  const dot = fixed.indexOf('.');
  const intPart = groupInteger(dot === -1 ? fixed : fixed.slice(0, dot), fmt.group);
  const frac = dot === -1 ? '' : fixed.slice(dot + 1);
  const num = frac ? intPart + (fmt.decimal || '.') + frac : intPart;
  return fmt.prefix + sign + num + fmt.suffix;
}

/** Shortfall to top up, rounded UP to the currency's enterable increment. */
export function topUpFromCents(
  totalCents: number,
  balanceCents: number,
  format: MoneyFormat,
): { neededCents: number; neededDisplay: number } {
  const shortfall = Math.max(0, totalCents - balanceCents);
  const increment = Math.max(1, Math.round(format.factor / 10 ** format.decimals));
  const neededCents = Math.ceil(shortfall / increment) * increment;
  return { neededCents, neededDisplay: neededCents / format.factor };
}

export interface TopUp {
  format: MoneyFormat;
  subtotalCents: number;
  balanceCents: number;
  shortfallCents: number;
  neededCents: number;
  neededDisplay: number;
}

/** Compute the wallet top-up for a cart from a calibration pair + balance text. */
export function computeTopUp(args: {
  subtotalMinor: number | string;
  subtotalFormatted: string;
  balanceText: string;
}): TopUp {
  const format = deriveFormat(args.subtotalMinor, args.subtotalFormatted);
  const subtotalCents = Math.round(Number(args.subtotalMinor));
  const balanceCents = Math.round(parseMoney(args.balanceText).value * format.factor);
  const { neededCents, neededDisplay } = topUpFromCents(subtotalCents, balanceCents, format);
  return {
    format,
    subtotalCents,
    balanceCents,
    shortfallCents: Math.max(0, subtotalCents - balanceCents),
    neededCents,
    neededDisplay,
  };
}
