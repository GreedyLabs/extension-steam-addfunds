/** Add-funds page: inject a custom-amount card and submit Steam's native form. */
import { getCurrencyParts, evaluateAmount } from './lib/currency';
import { parseMoney, deriveFactor } from './lib/money';
import { AmountField, formatView } from './lib/amount-field';
import { el, warn } from './lib/dom';

const ID = {
  root: 'steam-helper-custom',
  input: 'shp-custom-input',
  btn: 'shp-submit-btn',
  text: 'shp-helper-text',
} as const;

function main(): void {
  if (document.getElementById(ID.root)) return;

  const container = document.getElementById('prices_user');
  if (!container) return warn('price container (#prices_user) not found');

  const ref = container.querySelector<HTMLElement>('[data-amount][data-currency]');
  if (!ref) return warn('reference price element not found');

  const priceEl = ref.closest('.addfunds_area_purchase_game')?.querySelector('.price');
  if (!priceEl) return warn('price text (.addfunds_area_purchase_game .price) not found');

  const currency = ref.dataset.currency as string;
  const t = chrome.i18n.getMessage;
  const fmt = new Intl.NumberFormat(chrome.i18n.getUILanguage(), { style: 'currency', currency });
  const parts = getCurrencyParts(fmt);

  const priceText = priceEl.textContent ?? '';
  const minAmount = parseMoney(priceText).value;
  // data-amount is the minor-unit value of the minimum; learn the ×100 factor from it.
  const multiplier = deriveFactor(ref.dataset.amount ?? '', priceText);
  const fmtMin = fmt.format(minAmount);

  const ps = fmt.formatToParts(1);
  const ci = ps.findIndex((p) => p.type === 'currency');
  const ni = ps.findIndex((p) => p.type === 'integer');
  const fieldOpts = {
    group: parts.group,
    decimal: parts.decimal,
    decimals: fmt.resolvedOptions().maximumFractionDigits ?? 0,
    symbol: parts.symbol,
    symbolBefore: ci === -1 || ni === -1 ? true : ci < ni,
  };

  const input = el('input', {
    id: ID.input,
    type: 'text',
    inputMode: 'decimal',
    placeholder: formatView(minAmount, fieldOpts),
  });
  const btn = el(
    'a',
    { id: ID.btn, className: 'btnv6_green_white_innerfade btn_medium shp-btn-disabled', href: '#' },
    el('span', { textContent: t('buttonText') }),
  );
  const text = el('p', { id: ID.text, textContent: t('minAmountText', [fmtMin]) });

  const card = el(
    'div',
    { id: ID.root, className: 'addfunds_area_purchase_game game_area_purchase_game' },
    el(
      'div',
      { className: 'addfunds_purchase_action game_purchase_action shp-action' },
      el(
        'div',
        { className: 'game_purchase_action_bg' },
        el('div', { className: 'game_purchase_price price shp-price-input' }, input),
        btn,
      ),
    ),
    el('h1', { textContent: t('title') }),
    text,
  );

  const first = container.querySelector('.addfunds_area_purchase_game');
  if (first) container.insertBefore(card, first);
  else container.appendChild(card);

  function setState({
    message,
    error = false,
    enabled = false,
  }: {
    message: string;
    error?: boolean;
    enabled?: boolean;
  }): void {
    text.textContent = message;
    text.className = error ? 'shp-text-error' : '';
    btn.classList.toggle('shp-btn-disabled', !enabled);
    btn.classList.toggle('shp-btn-enabled', enabled);
  }

  // The field owns the view; field.value is the model used everywhere.
  const field = new AmountField(input, fieldOpts);
  const readState = () => evaluateAmount(field.empty ? '' : String(field.value), minAmount);

  function update(): void {
    const { status, amount } = readState();
    if (status === 'valid') setState({ message: fmt.format(amount), enabled: true });
    else if (status === 'below') setState({ message: t('minAmountText', [fmtMin]), error: true });
    else setState({ message: t('minAmountText', [fmtMin]) });
  }
  field.onChange(update);

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btn.click();
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const { status, amount } = readState();
    if (status !== 'valid') {
      setState({ message: t('inputError', [fmtMin]), error: true });
      return;
    }
    const form = document.getElementById('form_addfunds') as HTMLFormElement | null;
    const amountInput = document.getElementById('input_amount') as HTMLInputElement | null;
    const currencyInput = document.getElementById('input_currency') as HTMLInputElement | null;
    if (form && amountInput && currencyInput) {
      amountInput.value = String(Math.round(amount * multiplier));
      currencyInput.value = currency;
      form.submit();
    } else {
      setState({ message: t('formNotFoundError'), error: true });
    }
  });

  // Handoff from the cart's top-up button (#shp=<amount>): prefill + clamp to the
  // page minimum (the cart can't know it). Never auto-submit.
  const shp = new URLSearchParams(location.hash.slice(1)).get('shp');
  if (shp !== null) {
    const requested = parseFloat(shp);
    if (Number.isFinite(requested)) {
      const clamped = requested < minAmount;
      const amount = clamped ? minAmount : requested;
      input.value = formatView(amount, fieldOpts);
      setState({
        message: clamped ? t('addfundsClampedToMin') : t('addfundsFromCart'),
        enabled: true,
      });
      input.focus();
    }
  }
}

main();
