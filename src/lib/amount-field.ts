/**
 * Dependency-free formatted-number input. Separates the model (raw number, for
 * validation/submission) from the view (grouped, symbol-prefixed string). The
 * caret is preserved by counting significant chars (digits + decimal), so
 * inserted/removed grouping separators don't move it.
 */
import { groupInteger } from './money';

export interface AmountFieldOptions {
  group: string;
  decimal: string;
  decimals: number;
  symbol?: string;
  symbolBefore?: boolean;
}

/** Reduce a typed string to a normalized numeric string ("50983", "50983.", "50983.5"). */
export function normalizeAmount(view: string, opts: AmountFieldOptions): string {
  const dec = opts.decimal || '.';
  // '.' is a decimal point only when it isn't the grouping separator (EU: "1.234,56").
  const dotIsDecimal = opts.group !== '.';
  let int = '';
  let frac = '';
  let seenDot = false;
  for (const ch of view) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) frac += ch;
      else int += ch;
    } else if (!seenDot && opts.decimals > 0 && (ch === dec || (dotIsDecimal && ch === '.'))) {
      seenDot = true;
    }
  }
  while (int.length > 1 && int.startsWith('0')) int = int.slice(1);
  frac = frac.slice(0, opts.decimals);
  return seenDot ? `${int}.${frac}` : int;
}

/** Group the integer part of a normalized string ("50,983", "50,983.5", "50,983."). */
export function groupAmount(normalized: string, opts: AmountFieldOptions): string {
  const dotIdx = normalized.indexOf('.');
  let int = dotIdx === -1 ? normalized : normalized.slice(0, dotIdx);
  const frac = dotIdx === -1 ? null : normalized.slice(dotIdx + 1);
  if (int === '') int = frac === null ? '' : '0';
  if (int) int = groupInteger(int, opts.group);
  if (frac === null) return int;
  return int + (opts.decimal || '.') + frac;
}

function stripSymbol(view: string, opts: AmountFieldOptions): string {
  return opts.symbol ? view.split(opts.symbol).join('') : view;
}

function wrapSymbol(grouped: string, opts: AmountFieldOptions): string {
  if (!grouped || !opts.symbol) return grouped;
  return opts.symbolBefore === false ? `${grouped} ${opts.symbol}` : `${opts.symbol} ${grouped}`;
}

/** Parse a typed string (with optional symbol) to a number, NaN if empty. */
export function parseAmount(view: string, opts: AmountFieldOptions): number {
  const n = normalizeAmount(stripSymbol(view, opts), opts).replace(/\.$/, '');
  return n === '' ? NaN : parseFloat(n);
}

/** Render a number as the full display view (grouped + currency symbol). */
export function formatView(n: number, opts: AmountFieldOptions): string {
  if (!Number.isFinite(n)) return '';
  // String(n) already uses '.' as the decimal — groupAmount's input contract.
  return wrapSymbol(groupAmount(String(n), opts), opts);
}

export class AmountField {
  readonly input: HTMLInputElement;
  private readonly opts: AmountFieldOptions;
  private changeCb: (() => void) | null = null;

  constructor(input: HTMLInputElement, opts: AmountFieldOptions) {
    this.input = input;
    this.opts = opts;
    input.addEventListener('input', () => this.reformat());
  }

  /** Model: the raw numeric value, or NaN when empty. */
  get value(): number {
    return parseAmount(this.input.value, this.opts);
  }

  set value(n: number) {
    this.input.value = formatView(n, this.opts);
    this.changeCb?.();
  }

  get empty(): boolean {
    return this.input.value.trim() === '';
  }

  onChange(cb: () => void): void {
    this.changeCb = cb;
  }

  private isSignificant(ch: string): boolean {
    return (ch >= '0' && ch <= '9') || ch === (this.opts.decimal || '.');
  }

  private reformat(): void {
    const el = this.input;
    const caret = el.selectionStart ?? el.value.length;
    let sigBefore = 0;
    for (let i = 0; i < caret; i += 1) if (this.isSignificant(el.value[i])) sigBefore += 1;

    // String pipeline (not parseAmount) so a trailing decimal being typed survives.
    const core = groupAmount(
      normalizeAmount(stripSymbol(el.value, this.opts), this.opts),
      this.opts,
    );
    el.value = wrapSymbol(core, this.opts);

    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < sigBefore) {
      if (this.isSignificant(el.value[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    this.changeCb?.();
  }
}
