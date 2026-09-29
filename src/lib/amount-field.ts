/**
 * Dependency-free formatted-number input. Separates the model (raw number, for
 * validation/submission) from the view (grouped, symbol-prefixed string). The
 * caret is preserved by counting significant chars (digits + decimal), so
 * inserted/removed grouping separators don't move it.
 */
import { groupInteger, type DigitGrouping } from './money';

export interface AmountFieldOptions {
  group: string;
  decimal: string;
  decimals: number;
  grouping?: DigitGrouping;
  symbol?: string;
  symbolBefore?: boolean;
}

function decimalSeparator(opts: AmountFieldOptions): string {
  return opts.decimal && opts.decimal !== opts.group
    ? opts.decimal
    : opts.group === '.'
      ? ','
      : '.';
}

/** Normalize a valid amount; keep typing precision and return "NaN" for invalid text. */
export function normalizeAmount(view: string, opts: AmountFieldOptions): string {
  const dec = decimalSeparator(opts);
  let text = stripSymbol(view, opts).trim();
  if (!text) return '';
  if (/^[ \u00a0\u202f]$/.test(opts.group)) {
    text = text.replace(/[ \u00a0\u202f]/g, opts.group);
  }
  // Accept a keyboard decimal point unless that character means grouping here.
  if (dec !== '.' && opts.group !== '.') text = text.replaceAll('.', dec);
  const parts = text.split(dec);
  if (parts.length > 2) return 'NaN';
  let int = parts[0];
  const frac = parts[1];
  if (opts.group && opts.group !== dec && int.includes(opts.group)) {
    const groups = int.split(opts.group);
    const { primary, secondary } = opts.grouping ?? { primary: 3, secondary: 3 };
    const localeGrouping =
      groups[0].length <= secondary &&
      groups.at(-1)?.length === primary &&
      groups.slice(1, -1).every((group) => group.length === secondary);
    // Steam or an older field may have used regular three-digit grouping.
    const regularGrouping =
      secondary !== 3 &&
      groups[0].length <= 3 &&
      groups.slice(1).every((group) => group.length === 3);
    if (groups.some((group) => !/^\d+$/.test(group)) || (!localeGrouping && !regularGrouping)) {
      return 'NaN';
    }
    int = groups.join('');
  }
  if (!/^\d*$/.test(int) || (frac !== undefined && !/^\d*$/.test(frac))) return 'NaN';
  if (!int && !frac) return 'NaN';
  // Never truncate meaningful decimals or turn them into integer digits.
  if (frac && /[1-9]/.test(frac.slice(opts.decimals))) return 'NaN';
  int = int.replace(/^0+(?=\d)/, '') || '0';
  const normalized = frac === undefined ? int : `${int}.${frac}`;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) return 'NaN';
  return normalized;
}

/** Group the integer part of a normalized string ("50,983", "50,983.5", "50,983."). */
export function groupAmount(normalized: string, opts: AmountFieldOptions): string {
  const dotIdx = normalized.indexOf('.');
  let int = dotIdx === -1 ? normalized : normalized.slice(0, dotIdx);
  const frac = dotIdx === -1 ? null : normalized.slice(dotIdx + 1);
  if (int === '') int = frac === null ? '' : '0';
  if (int) int = groupInteger(int, opts.group, opts.grouping);
  if (frac === null) return int;
  return int + decimalSeparator(opts) + frac;
}

function stripSymbol(view: string, opts: AmountFieldOptions): string {
  const text = view.trim();
  if (!opts.symbol) return text;
  if (text.startsWith(opts.symbol)) return text.slice(opts.symbol.length).trim();
  if (text.endsWith(opts.symbol)) return text.slice(0, -opts.symbol.length).trim();
  return text;
}

function wrapSymbol(grouped: string, opts: AmountFieldOptions): string {
  if (!grouped || !opts.symbol) return grouped;
  return opts.symbolBefore === false ? `${grouped} ${opts.symbol}` : `${opts.symbol} ${grouped}`;
}

/** Parse a typed string (with optional symbol), or NaN if blank or invalid. */
export function parseAmount(view: string, opts: AmountFieldOptions): number {
  const n = normalizeAmount(view, opts);
  return n === '' ? NaN : Number(n);
}

/** Render a number as the full display view (grouped + currency symbol). */
export function formatView(n: number, opts: AmountFieldOptions): string {
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) return '';
  // String(n) already uses '.' as the decimal — groupAmount's input contract.
  return wrapSymbol(groupAmount(String(n), opts), opts);
}

export class AmountField {
  readonly input: HTMLInputElement;
  private readonly opts: AmountFieldOptions;
  private changeCb: (() => void) | null = null;
  private previousView = '';

  constructor(input: HTMLInputElement, opts: AmountFieldOptions) {
    this.input = input;
    this.opts = opts;
    this.previousView = input.value;
    input.addEventListener('input', (event) => this.reformat(event as InputEvent));
  }

  /** Model: the raw numeric value, or NaN when empty or invalid. */
  get value(): number {
    return parseAmount(this.input.value, this.opts);
  }

  set value(n: number) {
    this.setView(formatView(n, this.opts));
    this.changeCb?.();
  }

  /** Restore a draft or prefill without firing an input change callback. */
  setView(view: string): void {
    this.input.value = view;
    this.previousView = view;
  }

  get empty(): boolean {
    return this.input.value.trim() === '';
  }

  onChange(cb: () => void): void {
    this.changeCb = cb;
  }

  private isSignificant(ch: string): boolean {
    return (
      (ch >= '0' && ch <= '9') ||
      ch === decimalSeparator(this.opts) ||
      (ch === '.' && this.opts.group !== '.')
    );
  }

  private normalizeEdit(event: InputEvent): string {
    const view = this.input.value;
    const normalized = normalizeAmount(view, this.opts);
    if (normalized !== 'NaN' || !this.opts.group) return normalized;
    // A direct edit can leave our own separators temporarily out of position:
    // appending a digit to "1,000" produces "1,0000" before we regroup it.
    // Pasted text and typed separators still undergo strict format validation.
    const insertingDigits = event.inputType === 'insertText' && /^\d+$/.test(event.data ?? '');
    const deleting = event.inputType?.startsWith('delete');
    if (
      (!insertingDigits && !deleting) ||
      !Number.isFinite(parseAmount(this.previousView, this.opts))
    ) {
      return normalized;
    }
    let start = 0;
    while (start < view.length && view[start] === this.previousView[start]) start += 1;
    let oldEnd = this.previousView.length;
    let newEnd = view.length;
    while (oldEnd > start && newEnd > start && this.previousView[oldEnd - 1] === view[newEnd - 1]) {
      oldEnd -= 1;
      newEnd -= 1;
    }
    const removed = this.previousView.slice(start, oldEnd);
    const inserted = view.slice(start, newEnd);
    const removable = removed.split(this.opts.group).join('');
    if (!/^\d*$/.test(removable) || (insertingDigits ? inserted !== event.data : inserted !== '')) {
      return normalized;
    }
    return normalizeAmount(stripSymbol(view, this.opts).split(this.opts.group).join(''), this.opts);
  }

  private reformat(event: InputEvent): void {
    const el = this.input;
    const normalized = this.normalizeEdit(event);
    if (normalized === 'NaN') {
      // Keep the original input visible so an invalid amount cannot look valid.
      this.previousView = el.value;
      this.changeCb?.();
      return;
    }
    const caret = el.selectionStart ?? el.value.length;
    let sigBefore = 0;
    for (let i = 0; i < caret; i += 1) if (this.isSignificant(el.value[i])) sigBefore += 1;

    // String pipeline (not parseAmount) so a trailing decimal being typed survives.
    const core = groupAmount(normalized, this.opts);
    el.value = wrapSymbol(core, this.opts);
    this.previousView = el.value;

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
