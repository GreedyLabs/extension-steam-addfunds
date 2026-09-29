/** Add-funds page: custom top-ups, target balances, and a live calculation preview. */
import { getCurrencyParts, formatCurrencyWithSpacing } from './lib/currency';
import { parseMoney, deriveFormat } from './lib/money';
import { AmountField, formatView } from './lib/amount-field';
import { calculateTopUp, type TopUpMode } from './lib/topup';
import { readCartContext } from './lib/cart-context';
import { el, warn } from './lib/dom';

function main(): void {
  if (document.getElementById('steam-helper-custom')) return;
  const container = document.getElementById('prices_user');
  const ref = container?.querySelector<HTMLElement>('[data-amount][data-currency]');
  const priceEl = ref?.closest('.addfunds_area_purchase_game')?.querySelector('.price');
  if (!container || !ref || !priceEl) return warn('reference price elements not found');

  const currency = ref.dataset.currency ?? '';
  const t = chrome.i18n.getMessage;
  const locale = chrome.i18n.getUILanguage();
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    return warn('unsupported currency metadata');
  }
  const priceText = priceEl.textContent ?? '';
  const minimum = parseMoney(priceText).value;
  const steamFormat = deriveFormat(ref.dataset.amount ?? '', priceText);
  const factor = steamFormat.factor;
  if (!Number.isFinite(minimum) || minimum <= 0 || !Number.isSafeInteger(factor) || factor <= 0) {
    return warn('invalid minimum or currency factor');
  }
  const decimals = Math.min(fmt.resolvedOptions().maximumFractionDigits ?? 0, Math.log10(factor));
  // Steam balances can retain fractional minor units even for whole-unit currencies.
  const balanceFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.max(
      fmt.resolvedOptions().maximumFractionDigits ?? 0,
      Math.log10(factor),
    ),
  });
  const parts = getCurrencyParts(fmt);
  const ps = fmt.formatToParts(1);
  const fieldOpts = {
    ...parts,
    decimals,
    symbolBefore:
      ps.findIndex((p) => p.type === 'currency') < ps.findIndex((p) => p.type === 'integer'),
  };
  const context = readCartContext(location.hash, steamFormat);
  const fmtMin = fmt.format(minimum);
  const readBalance = (): number | null => {
    const value = parseMoney(
      document.getElementById('header_wallet_balance')?.textContent ?? '',
    ).value;
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const nativeCards = new Set<HTMLElement>();
  const presetAmounts = new Set<number>();
  for (const option of container.querySelectorAll<HTMLElement>('[data-amount][data-currency]')) {
    const nativeCard = option.closest<HTMLElement>('.addfunds_area_purchase_game');
    const rawAmount = option.dataset.amount ?? '';
    if (!nativeCard || option.dataset.currency !== currency || !/^\d+$/.test(rawAmount)) continue;
    const minor = Number(rawAmount);
    const amount = minor / factor;
    const result = calculateTopUp({
      mode: 'amount',
      value: amount,
      balance: null,
      minimum,
      factor,
      decimals,
    });
    if (!Number.isSafeInteger(minor) || result.status !== 'valid' || result.amountMinor !== minor) {
      continue;
    }
    presetAmounts.add(amount);
    nativeCards.add(nativeCard);
  }

  let mode: TopUpMode = 'amount';
  let busy = false;
  let minimumAdjusted = context.requested !== null && context.requested < minimum;
  const drafts: Record<TopUpMode, string> = { amount: '', target: '' };
  const input = el('input', {
    id: 'shp-custom-input',
    type: 'text',
    inputMode: 'decimal',
    autocomplete: 'off',
    spellcheck: false,
    placeholder: formatView(minimum, fieldOpts),
  });
  input.setAttribute('aria-describedby', 'shp-helper-text');
  const inputLabel = el('label', { htmlFor: input.id, textContent: t('amountLabel') });
  const amountMode = el('button', {
    id: 'shp-mode-amount',
    type: 'button',
    textContent: t('modeAmount'),
  });
  const targetMode = el('button', {
    id: 'shp-mode-target',
    type: 'button',
    textContent: t('modeTarget'),
  });
  const modes = el('div', { className: 'shp-modes' }, amountMode, targetMode);
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', t('modeLabel'));
  const presetButtons = [...presetAmounts].map((amount) => {
    const button = el('button', {
      type: 'button',
      textContent: formatCurrencyWithSpacing(fmt, amount),
    });
    button.dataset.shpPreset = String(amount);
    return { amount, button };
  });
  const presets = el(
    'div',
    { className: 'shp-presets' },
    ...presetButtons.map(({ button }) => button),
  );
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', t('presetAmountsLabel'));
  const submit = el('button', {
    id: 'shp-submit-btn',
    className: 'shp-submit',
    type: 'button',
    disabled: true,
    textContent: t('buttonText'),
  });
  const helper = el('p', { id: 'shp-helper-text', className: 'shp-helper' });
  helper.setAttribute('role', 'status');
  const rows = el('dl', { className: 'shp-breakdown' });
  function row(key: string, id: string, emphasis = false) {
    const label = el('dt', { textContent: t(key) });
    const value = el('dd', { id, textContent: '—' });
    const root = el(
      'div',
      { className: emphasis ? 'shp-row shp-row-total' : 'shp-row' },
      label,
      value,
    );
    rows.append(root);
    return { root, label, value };
  }
  const current = row('previewCurrent', 'shp-preview-current');
  const added = row('previewTopup', 'shp-preview-topup');
  const after = row('previewAfter', 'shp-preview-after', true);
  const previewEmpty = el('p', { className: 'shp-preview-empty', textContent: t('previewEmpty') });
  const preview = el(
    'details',
    { className: 'shp-preview', open: true },
    el('summary', { textContent: t('previewTitle') }),
    rows,
    previewEmpty,
  );
  const card = el(
    'div',
    {
      id: 'steam-helper-custom',
      className: 'addfunds_area_purchase_game game_area_purchase_game shp-card',
    },
    el('h1', { textContent: t('title') }),
    el('p', { className: 'shp-minimum', textContent: t('minAmountText', [fmtMin]) }),
    modes,
    inputLabel,
    el('div', { className: 'shp-input-row' }, input, submit),
    presets,
    helper,
    preview,
    el('a', {
      className: 'shp-back-link',
      href: 'https://store.steampowered.com/cart/',
      textContent: t('backToCart'),
    }),
  );
  container.prepend(card);
  const field = new AmountField(input, fieldOpts);
  const calculate = () =>
    calculateTopUp({
      mode,
      value: field.value,
      balance: readBalance(),
      minimum,
      factor,
      decimals,
    });

  function update(): void {
    const balance = readBalance();
    const result = calculate();
    const empty = field.empty;
    const valid = !empty && result.status === 'valid';
    const covered = !empty && result.status === 'covered';
    let message = mode === 'target' ? t('targetHint') : t('minAmountText', [fmtMin]);
    let error = false;
    if (mode === 'target' && balance === null) message = t('balanceUnavailable');
    else if (!empty) {
      if (result.status === 'invalid') {
        message = t('invalidAmountError');
        error = true;
      } else if (result.status === 'below') {
        message = t('inputError', [fmtMin]);
        error = true;
      } else if (covered) message = t('targetCovered');
      else if (result.adjustedToMinimum || minimumAdjusted) {
        message = t('addfundsClampedToMin');
      } else if (result.rounded) message = t('targetRounded');
    }
    helper.textContent = message;
    helper.classList.toggle('shp-text-error', error);
    input.setAttribute('aria-invalid', String(error));
    amountMode.setAttribute('aria-pressed', String(mode === 'amount'));
    targetMode.setAttribute('aria-pressed', String(mode === 'target'));
    presets.hidden = mode !== 'amount' || presetButtons.length === 0;
    for (const { amount, button } of presetButtons) {
      button.disabled = busy;
      button.setAttribute(
        'aria-pressed',
        String(mode === 'amount' && valid && field.value === amount),
      );
    }
    inputLabel.textContent = t(mode === 'amount' ? 'amountLabel' : 'targetLabel');
    submit.disabled = busy || !valid;
    submit.textContent = t(busy ? 'buttonBusy' : 'buttonText');
    current.value.textContent =
      balance === null ? t('unknownBalance') : formatCurrencyWithSpacing(balanceFmt, balance);
    added.value.textContent =
      valid || covered ? formatCurrencyWithSpacing(fmt, result.amount) : '—';
    after.value.textContent =
      (valid || covered) && result.balanceAfter !== null
        ? formatCurrencyWithSpacing(balanceFmt, result.balanceAfter)
        : '—';
    previewEmpty.hidden = !empty;
  }

  field.onChange(() => {
    minimumAdjusted = false;
    update();
  });
  for (const { amount, button } of presetButtons) {
    button.addEventListener('click', () => {
      if (busy || mode !== 'amount') return;
      field.value = amount;
      input.focus();
    });
  }
  function switchMode(next: TopUpMode): void {
    if (mode === next || busy) return;
    drafts[mode] = input.value;
    mode = next;
    field.setView(drafts[mode]);
    input.placeholder = formatView(
      mode === 'target' ? (readBalance() ?? 0) + minimum : minimum,
      fieldOpts,
    );
    minimumAdjusted = false;
    update();
    input.focus();
  }
  amountMode.addEventListener('click', () => switchMode('amount'));
  targetMode.addEventListener('click', () => switchMode('target'));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submit.click();
    }
  });
  submit.addEventListener('click', () => {
    if (busy) return;
    const result = calculate();
    if (field.empty || result.status !== 'valid') return update();
    const form = document.getElementById('form_addfunds') as HTMLFormElement | null;
    const amountInput = document.getElementById('input_amount') as HTMLInputElement | null;
    const currencyInput = document.getElementById('input_currency') as HTMLInputElement | null;
    if (!form || !amountInput || !currencyInput) {
      helper.textContent = t('formNotFoundError');
      helper.classList.add('shp-text-error');
      return;
    }
    amountInput.value = String(result.amountMinor);
    currencyInput.value = currency;
    busy = true;
    update();
    form.submit();
  });
  window.addEventListener('pageshow', () => {
    busy = false;
    update();
  });
  if (context.requested !== null) {
    field.setView(formatView(Math.max(context.requested, minimum), fieldOpts));
  }
  update();
  // Keep Steam's native payment elements intact; replace only the visible preset cards.
  for (const nativeCard of nativeCards) {
    nativeCard.dataset.shpNativePreset = '';
    nativeCard.hidden = true;
  }
}

main();
