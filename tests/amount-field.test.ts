import { describe, it, expect } from 'vitest';
import {
  AmountField,
  normalizeAmount,
  groupAmount,
  parseAmount,
  formatView,
} from '../src/lib/amount-field';

const KRW = { group: ',', decimal: '', decimals: 0 };
const USD = { group: ',', decimal: '.', decimals: 2 };
const EU = { group: '.', decimal: ',', decimals: 2 };
const KRW_SYM = { ...KRW, symbol: '₩', symbolBefore: true };
const EUR_SYM = { ...EU, symbol: '€', symbolBefore: false };
const INR_SYM = {
  ...USD,
  symbol: '₹',
  symbolBefore: true,
  grouping: { primary: 3, secondary: 2 },
};

describe('normalizeAmount', () => {
  it('removes valid grouping and the configured currency symbol', () => {
    expect(normalizeAmount('₩ 50,983', KRW_SYM)).toBe('50983');
  });

  it('retains zero fractional digits without magnifying whole-unit currencies', () => {
    expect(normalizeAmount('5,000.00', KRW)).toBe('5000.00');
    expect(parseAmount('5,000.00', KRW)).toBe(5000);
    expect(normalizeAmount('50.99', KRW)).toBe('NaN');
  });

  it('keeps a trailing decimal while typing (USD)', () => {
    expect(normalizeAmount('50.', USD)).toBe('50.');
  });

  it('rejects meaningful excess fractional digits instead of truncating them', () => {
    expect(normalizeAmount('12.3456', USD)).toBe('NaN');
    expect(normalizeAmount('12.3400', USD)).toBe('12.3400');
  });

  it('treats the locale decimal separator (EU comma)', () => {
    expect(normalizeAmount('1.234,56', EU)).toBe('1234.56');
  });

  it('does not confuse decimal metadata missing for a whole-unit currency with grouping', () => {
    const dotGrouped = { group: '.', decimal: '', decimals: 0 };
    expect(parseAmount('5.000', dotGrouped)).toBe(5000);
    expect(parseAmount('5.000,00', dotGrouped)).toBe(5000);
    expect(parseAmount('5.000,10', dotGrouped)).toBeNaN();
    expect(groupAmount('5000.00', dotGrouped)).toBe('5.000,00');
  });

  it('strips leading zeros', () => {
    expect(normalizeAmount('00050983', KRW)).toBe('50983');
  });

  it('accepts a fractional amount without a leading zero', () => {
    expect(normalizeAmount('.50', USD)).toBe('0.50');
  });

  it('accepts space and apostrophe locale grouping', () => {
    expect(parseAmount('1\u202f234,50', { group: '\u00a0', decimal: ',', decimals: 2 })).toBe(
      1234.5,
    );
    expect(parseAmount("1'234.50", { group: "'", decimal: '.', decimals: 2 })).toBe(1234.5);
  });

  it('accepts Indian grouping while rejecting misplaced or repeated separators', () => {
    expect(parseAmount('₹1,00,000.00', INR_SYM)).toBe(100000);
    expect(parseAmount('12,34,567.89', INR_SYM)).toBe(1234567.89);
    expect(parseAmount('1,000', INR_SYM)).toBe(1000);
    expect(parseAmount('100000.00', INR_SYM)).toBe(100000);
    expect(parseAmount('100,000.00', INR_SYM)).toBe(100000);
    expect(formatView(parseAmount('1,234,567.89', INR_SYM), INR_SYM)).toBe('₹ 12,34,567.89');
    for (const text of [
      '1,0,000',
      '1,000,00',
      '1,,00,000',
      '123,45,678',
      '1,0000',
      '1,,000',
      '12,34,56',
    ]) {
      expect(parseAmount(text, INR_SYM)).toBeNaN();
    }
    expect(parseAmount('1,00,000.00', USD)).toBeNaN();
  });

  it.each(['5,00', '1,,000', '1,000,', ',5000', '1,234.5.6', '1,234.5,6'])(
    'rejects malformed separators: %s',
    (value) => expect(parseAmount(value, USD)).toBeNaN(),
  );

  it.each(['-5000', '+5000', '5e3', '5000abc', '1 2', 'Infinity', 'NaN', '(5000)'])(
    'does not silently turn invalid text into a payable amount: %s',
    (value) => expect(parseAmount(value, KRW)).toBeNaN(),
  );

  it('rejects unsafe amounts and repeated or embedded currency symbols', () => {
    expect(parseAmount('9007199254740992', KRW)).toBeNaN();
    expect(parseAmount('9'.repeat(400), KRW)).toBeNaN();
    expect(parseAmount('₩₩5000', KRW_SYM)).toBeNaN();
    expect(parseAmount('5₩000', KRW_SYM)).toBeNaN();
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

describe('formatView (with currency symbol)', () => {
  it('prepends the symbol for KRW', () => {
    expect(formatView(50983, KRW_SYM)).toBe('₩ 50,983');
  });

  it('appends the symbol for EUR', () => {
    expect(formatView(1234.56, EUR_SYM)).toBe('1.234,56 €');
  });

  it('uses the same Indian grouping for display and parsing', () => {
    expect(formatView(1234567.89, INR_SYM)).toBe('₹ 12,34,567.89');
    expect(parseAmount(formatView(1234567.89, INR_SYM), INR_SYM)).toBe(1234567.89);
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

/** The input behavior only needs these DOM methods; keep unit tests DOM-free. */
function createField(opts = KRW_SYM) {
  let listener: (event: InputEvent) => void = () => {};
  const input = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    addEventListener(_type: string, callback: (event: InputEvent) => void) {
      listener = callback;
    },
    setSelectionRange(start: number, end: number) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
  const field = new AmountField(input as unknown as HTMLInputElement, opts);
  return {
    input,
    field,
    edit(
      value: string,
      inputType = 'insertFromPaste',
      data: string | null = null,
      caret = value.length,
    ) {
      input.value = value;
      input.selectionStart = caret;
      input.selectionEnd = caret;
      listener({ inputType, data } as InputEvent);
    },
  };
}

describe('AmountField editing', () => {
  it('synchronizes keyboard editing history after restoring a prefilled or saved view', () => {
    const { field, input, edit } = createField();
    let changes = 0;
    field.onChange(() => {
      changes += 1;
    });
    field.setView('₩ 5,000');
    expect(changes).toBe(0);
    edit('₩ 5,0000', 'insertText', '0');
    expect(input.value).toBe('₩ 50,000');
    expect(field.value).toBe(50000);
    expect(changes).toBe(1);
    field.setView('₩ 1,234');
    edit('₩ 1,34', 'deleteContentBackward', null, 4);
    expect(input.value).toBe('₩ 134');
    expect(field.value).toBe(134);
  });

  it('keeps rejected pasted text and the caret visible for correction', () => {
    const { field, input, edit } = createField();
    field.value = 5000;
    let changes = 0;
    field.onChange(() => {
      changes += 1;
    });
    edit('5,000.99', 'insertFromPaste', null, 4);
    expect(field.value).toBeNaN();
    expect(field.empty).toBe(false);
    expect(input.value).toBe('5,000.99');
    expect(input.selectionStart).toBe(4);
    expect(changes).toBe(1);
  });

  it('preserves zero decimals across keystrokes for a whole-unit currency', () => {
    const { field, input, edit } = createField();
    field.value = 5000;
    edit(`${input.value}.`, 'insertText', '.');
    edit(`${input.value}0`, 'insertText', '0');
    edit(`${input.value}0`, 'insertText', '0');
    expect(input.value).toBe('₩ 5,000.00');
    expect(field.value).toBe(5000);
  });

  it('regroups existing formatting when a user appends a digit', () => {
    const { field, input, edit } = createField();
    field.value = 1000;
    edit('₩ 1,0000', 'insertText', '0');
    expect(input.value).toBe('₩ 10,000');
    expect(input.selectionStart).toBe(input.value.length);
    expect(field.value).toBe(10000);
  });

  it('keeps Indian grouping and the caret correct when editing a restored amount', () => {
    const { field, input, edit } = createField(INR_SYM);
    field.setView('₹ 10,000');
    edit('₹ 10,0000', 'insertText', '0');
    expect(input.value).toBe('₹ 1,00,000');
    expect(input.selectionStart).toBe(input.value.length);
    expect(field.value).toBe(100000);
    edit('₹ 1,00,00', 'deleteContentBackward');
    expect(input.value).toBe('₹ 10,000');
    expect(field.value).toBe(10000);
  });

  it('preserves the caret while inserting and deleting interior digits', () => {
    const { field, input, edit } = createField();
    field.value = 12345;
    edit('₩ 192,345', 'insertText', '9', 4);
    expect(input.value).toBe('₩ 192,345');
    expect(input.selectionStart).toBe(4);
    edit('₩ 19,345', 'deleteContentBackward', null, 4);
    expect(field.value).toBe(19345);
    expect(input.selectionStart).toBe(4);
    field.value = 1234;
    edit('₩ 1,34', 'deleteContentBackward', null, 4);
    expect(input.value).toBe('₩ 134');
    expect(field.value).toBe(134);
    expect(input.selectionStart).toBe(3);
  });

  it('does not repair malformed pasted grouping or a typed grouping character', () => {
    const { field, input, edit } = createField();
    field.value = 1000;
    edit('₩ 1,0000');
    expect(input.value).toBe('₩ 1,0000');
    expect(field.value).toBeNaN();
    field.value = 1000;
    edit('₩ 1,,000', 'insertText', ',');
    expect(input.value).toBe('₩ 1,,000');
    expect(field.value).toBeNaN();
  });

  it('preserves trailing decimals while typing in comma-decimal locales', () => {
    const { field, input, edit } = createField(EUR_SYM);
    field.value = 1234;
    edit('1.234, €', 'insertText', ',', 6);
    expect(input.value).toBe('1.234, €');
    expect(input.selectionStart).toBe(6);
    expect(field.value).toBe(1234);
  });

  it('does not remove grouping-like punctuation from the currency symbol while editing', () => {
    const { field, input, edit } = createField({ ...EUR_SYM, symbol: 'kr.' });
    field.value = 1000;
    edit('1.0000 kr.', 'insertText', '0', 6);
    expect(input.value).toBe('10.000 kr.');
    expect(field.value).toBe(10000);
    expect(input.selectionStart).toBe(6);
  });
});
