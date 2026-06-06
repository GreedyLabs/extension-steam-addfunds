/**
 * Steam Add Funds Helper — content script.
 *
 * Injects a custom-amount card into Steam's add-funds page and submits the
 * native form with the user's chosen amount. Currency parsing and validation
 * live in currency.ts; esbuild bundles everything into a single content.js.
 */
import { getCurrencyParts, parseCurrencyText, evaluateAmount } from './currency';

const ID = {
  root: 'steam-helper-custom',
  input: 'shp-custom-input',
  btn: 'shp-submit-btn',
  text: 'shp-helper-text',
} as const;

const warn = (msg: string): void => console.warn(`[steam-addfunds] ${msg}`);

/** Tiny element builder: createElement + assign props + append children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function main(): void {
  if (document.getElementById(ID.root)) return;

  const container = document.getElementById('prices_user');
  if (!container) return warn('price container (#prices_user) not found');

  const ref = container.querySelector<HTMLElement>('[data-amount][data-currency]');
  if (!ref) return warn('reference price element ([data-amount][data-currency]) not found');

  const priceEl = ref.closest('.addfunds_area_purchase_game')?.querySelector('.price');
  if (!priceEl) return warn('price text (.addfunds_area_purchase_game .price) not found');

  // --- Derive currency, locale, and the minimum amount from the page ---
  const currency = ref.dataset.currency as string;
  const t = chrome.i18n.getMessage;
  const locale = chrome.i18n.getUILanguage();
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const parts = getCurrencyParts(fmt);

  const minAmount = parseCurrencyText(priceEl.textContent ?? '', parts);
  // Steam's data-amount is the API value (e.g. cents) for the minimum price;
  // multiplier converts a display amount into that API unit.
  const multiplier = Number(ref.dataset.amount) / minAmount;
  const fmtMin = fmt.format(minAmount);

  // --- Build and insert the custom card (no innerHTML) ---
  const input = el('input', {
    id: ID.input,
    type: 'number',
    inputMode: 'decimal',
    placeholder: String(minAmount),
    min: String(minAmount),
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
  if (first) {
    container.insertBefore(card, first);
  } else {
    container.appendChild(card);
  }

  /** Single place that updates the helper text and the button's enabled state. */
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

  input.addEventListener('input', () => {
    const { status, amount } = evaluateAmount(input.value, minAmount);
    if (status === 'valid') {
      setState({ message: fmt.format(amount), enabled: true });
    } else if (status === 'below') {
      setState({ message: t('minAmountText', [fmtMin]), error: true });
    } else {
      setState({ message: t('minAmountText', [fmtMin]) });
    }
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btn.click();
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const { status, amount } = evaluateAmount(input.value, minAmount);
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
}

main();
