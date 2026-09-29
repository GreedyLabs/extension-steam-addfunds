// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCartHref } from '../src/lib/cart-context';
import { deriveFormat } from '../src/lib/money';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing test element: ${id}`);
  return found as T;
}

function input(): HTMLInputElement {
  return element<HTMLInputElement>('shp-custom-input');
}

function submit(): HTMLButtonElement {
  return element<HTMLButtonElement>('shp-submit-btn');
}

function enter(value: string): void {
  input().value = value;
  input().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}

async function load() {
  const formSubmit = vi
    .spyOn(element<HTMLFormElement>('form_addfunds'), 'submit')
    .mockImplementation(() => undefined);
  await import('../src/content');
  return formSubmit;
}

function addNativePreset(amount: string, currency = 'KRW', price = '₩ 10,000'): HTMLElement {
  const card = document.createElement('div');
  card.className = 'addfunds_area_purchase_game';
  const label = document.createElement('div');
  label.className = 'price';
  label.textContent = price;
  const link = document.createElement('a');
  link.dataset.amount = amount;
  link.dataset.currency = currency;
  link.textContent = 'Add funds';
  card.append(label, link);
  element('prices_user').append(card);
  return card;
}

function preset(amount: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `.shp-presets button[data-shp-preset="${amount}"]`,
  );
  if (!button) throw new Error(`Missing preset button: ${amount}`);
  return button;
}

function presets(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.shp-presets button'));
}

function presetGroup(): HTMLElement {
  const group = document.querySelector<HTMLElement>('.shp-presets');
  if (!group) throw new Error('Missing preset group');
  return group;
}

let cleanupListeners: () => void;

beforeEach(() => {
  vi.resetModules();
  window.history.replaceState(null, '', '/steamaccount/addfunds/');
  document.body.innerHTML = `
    <a id="header_wallet_balance">₩ 90,393.20</a>
    <div id="prices_user">
      <div class="addfunds_area_purchase_game">
        <div class="price">₩ 5,000</div>
        <a data-amount="500000" data-currency="KRW">Add funds</a>
      </div>
    </div>
    <form id="form_addfunds">
      <input id="input_amount" name="amount" value="">
      <input id="input_currency" name="currency" value="">
    </form>
  `;
  vi.stubGlobal('chrome', {
    i18n: {
      getUILanguage: () => 'en-US',
      getMessage: (key: string, substitutions: string[] = []) => [key, ...substitutions].join(' '),
    },
  });
  const windowListeners = vi.spyOn(window, 'addEventListener');
  cleanupListeners = () => {
    for (const [type, listener, options] of windowListeners.mock.calls) {
      window.removeEventListener(type, listener, options);
    }
  };
});

afterEach(() => {
  cleanupListeners();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('add-funds page integration', () => {
  it('accepts amounts copied from an Indian-locale preview and submits the exact minor units', async () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getUILanguage: () => 'en-IN',
        getMessage: (key: string, substitutions: string[] = []) =>
          [key, ...substitutions].join(' '),
      },
    });
    element('header_wallet_balance').textContent = '₹1,00,000.00';
    element('prices_user').replaceChildren();
    addNativePreset('50000', 'INR', '₹500.00');
    const formSubmit = await load();
    enter('₹1,00,000.00');
    expect(input().value).toBe('₹ 1,00,000.00');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₹ 1,00,000.00');
    expect(element('shp-preview-after').textContent).toBe('₹ 2,00,000.00');
    submit().click();
    expect(formSubmit).toHaveBeenCalledOnce();
    expect(element<HTMLInputElement>('input_amount').value).toBe('10000000');
    expect(element<HTMLInputElement>('input_currency').value).toBe('INR');
  });

  it('handles currency display precision greater than the page payment precision', async () => {
    element('header_wallet_balance').textContent = '20.12 KD';
    const price = document.querySelector('.price');
    const reference = document.querySelector<HTMLElement>('[data-currency]');
    if (!price || !reference) throw new Error('Missing reference price');
    price.textContent = '5.00 KD';
    reference.dataset.currency = 'KWD';
    reference.dataset.amount = '500';
    const formSubmit = await load();
    enter('5.00');
    expect(submit().disabled).toBe(false);
    submit().click();
    expect(formSubmit).toHaveBeenCalledOnce();
    expect(element<HTMLInputElement>('input_amount').value).toBe('500');
    expect(element<HTMLInputElement>('input_currency').value).toBe('KWD');
  });

  it('starts disabled with a current-balance preview and a fixed cart return link', async () => {
    await load();
    expect(submit().disabled).toBe(true);
    expect(element('shp-preview-current').textContent).toBe('₩ 90,393.2');
    expect(element('shp-preview-topup').textContent).toBe('—');
    expect(element('shp-preview-after').textContent).toBe('—');
    expect(document.querySelector<HTMLAnchorElement>('.shp-back-link')?.href).toBe(
      'https://store.steampowered.com/cart/',
    );
    expect(document.querySelectorAll('.shp-breakdown .shp-row')).toHaveLength(3);
    expect(element('shp-mode-amount').getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves the intended value of 5,000.00 through preview and native form submission', async () => {
    const formSubmit = await load();
    enter('5,000.00');
    expect(input().value).toBe('₩ 5,000.00');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₩ 5,000');
    expect(element('shp-preview-after').textContent).toBe('₩ 95,393.2');
    submit().click();
    expect(formSubmit).toHaveBeenCalledOnce();
    expect(element<HTMLInputElement>('input_amount').value).toBe('500000');
    expect(element<HTMLInputElement>('input_currency').value).toBe('KRW');
  });

  it('keeps a nonzero fractional KRW amount visible and blocks every submission path', async () => {
    const formSubmit = await load();
    enter('5,000.01');
    expect(input().value).toBe('5,000.01');
    expect(submit().disabled).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(element('shp-helper-text').textContent).toBe('invalidAmountError');
    expect(element('shp-preview-topup').textContent).toBe('—');
    submit().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(formSubmit).not.toHaveBeenCalled();
    expect(element<HTMLInputElement>('input_amount').value).toBe('');
  });

  it('rounds target balance shortfall to whole won and submits the calculated amount', async () => {
    const formSubmit = await load();
    element('shp-mode-target').click();
    enter('100000');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₩ 9,607');
    expect(element('shp-preview-after').textContent).toBe('₩ 100,000.2');
    expect(element('shp-helper-text').textContent).toBe('targetRounded');
    submit().click();
    expect(element<HTMLInputElement>('input_amount').value).toBe('960700');
    expect(formSubmit).toHaveBeenCalledOnce();
  });

  it('explains the minimum adjustment when the target needs less than the minimum', async () => {
    await load();
    element('shp-mode-target').click();
    enter('91000');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₩ 5,000');
    expect(element('shp-preview-after').textContent).toBe('₩ 95,393.2');
    expect(element('shp-helper-text').textContent).toBe('addfundsClampedToMin');
  });

  it('does not offer a charge when the current wallet already covers the target', async () => {
    const formSubmit = await load();
    element('shp-mode-target').click();
    enter('90000');
    expect(submit().disabled).toBe(true);
    expect(element('shp-preview-topup').textContent).toBe('₩ 0');
    expect(element('shp-preview-after').textContent).toBe('₩ 90,393.2');
    expect(element('shp-helper-text').textContent).toBe('targetCovered');
    submit().dispatchEvent(new MouseEvent('click'));
    expect(formSubmit).not.toHaveBeenCalled();
  });

  it('disables unavailable targets while allowing direct top-ups with an unknown balance', async () => {
    element('header_wallet_balance').remove();
    await load();
    element('shp-mode-target').click();
    expect(input().value).toBe('');
    expect(submit().disabled).toBe(true);
    expect(element('shp-helper-text').textContent).toBe('balanceUnavailable');
    enter('100000');
    expect(submit().disabled).toBe(true);
    expect(element('shp-preview-current').textContent).toBe('unknownBalance');
    element('shp-mode-amount').click();
    enter('5000');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₩ 5,000');
    expect(element('shp-preview-after').textContent).toBe('—');
  });

  it('preserves separate amount and target drafts while switching modes', async () => {
    await load();
    enter('8000');
    element('shp-mode-target').click();
    expect(input().value).toBe('');
    enter('100000');
    element('shp-mode-amount').click();
    expect(input().value).toBe('₩ 8,000');
    expect(element('shp-preview-topup').textContent).toBe('₩ 8,000');
    element('shp-mode-target').click();
    expect(input().value).toBe('₩ 100,000');
    expect(element('shp-preview-topup').textContent).toBe('₩ 9,607');
  });

  it('continues formatting typed digits after restoring a previous mode draft', async () => {
    await load();
    enter('8000');
    element('shp-mode-target').click();
    enter('100000');
    element('shp-mode-amount').click();
    input().value += '0';
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }),
    );
    expect(input().value).toBe('₩ 80,000');
    expect(submit().disabled).toBe(false);
    expect(element('shp-preview-topup').textContent).toBe('₩ 80,000');
  });

  it('prefills a cart shortfall in the same funding view without cart-specific details', async () => {
    const href = createCartHref({
      amount: 9607,
      format: deriveFormat(500000, '₩ 5,000'),
    });
    window.history.replaceState(null, '', `${new URL(href).hash}&shp_cart=100000`);
    await load();
    expect(input().value).toBe('₩ 9,607');
    expect(document.getElementById('shp-preview-cart')).toBeNull();
    expect(document.getElementById('shp-preview-purchase')).toBeNull();
    expect(document.querySelectorAll('.shp-breakdown .shp-row')).toHaveLength(3);
    expect(element('shp-preview-topup').textContent).toBe('₩ 9,607');
    expect(element('shp-preview-after').textContent).toBe('₩ 100,000.2');
    expect(element('shp-helper-text').textContent).toBe('minAmountText ₩5,000');
    enter('5000');
    expect(element('shp-preview-after').textContent).toBe('₩ 95,393.2');
    expect(submit().disabled).toBe(false);
  });

  it('clamps a legacy cart request below the minimum and explains the adjustment', async () => {
    window.history.replaceState(null, '', '#shp=1000');
    await load();
    expect(input().value).toBe('₩ 5,000');
    expect(element('shp-helper-text').textContent).toBe('addfundsClampedToMin');
    expect(element('shp-preview-topup').textContent).toBe('₩ 5,000');
    expect(submit().disabled).toBe(false);
  });

  it('guards duplicate clicks and Enter presses until the page is shown again', async () => {
    const formSubmit = await load();
    enter('5000');
    submit().click();
    submit().dispatchEvent(new MouseEvent('click'));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(formSubmit).toHaveBeenCalledOnce();
    expect(submit().disabled).toBe(true);
    expect(submit().textContent).toBe('buttonBusy');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(submit().disabled).toBe(false);
    expect(submit().textContent).toBe('buttonText');
  });

  it('revalidates against the latest wallet balance immediately before submitting', async () => {
    const formSubmit = await load();
    element('shp-mode-target').click();
    enter('100000');
    element('header_wallet_balance').textContent = '₩ 100,000';
    submit().click();
    expect(formSubmit).not.toHaveBeenCalled();
    expect(submit().disabled).toBe(true);
    expect(element('shp-helper-text').textContent).toBe('targetCovered');
  });

  it('explains a missing native form without reporting successful submission', async () => {
    const formSubmit = await load();
    element('form_addfunds').remove();
    enter('5000');
    submit().click();
    expect(formSubmit).not.toHaveBeenCalled();
    expect(element('shp-helper-text').textContent).toBe('formNotFoundError');
  });
});

describe('native Steam amount presets', () => {
  it('uses unique valid account-currency amounts and hides only the replaced native cards', async () => {
    const minimumCard = document.querySelector<HTMLElement>('.addfunds_area_purchase_game');
    if (!minimumCard) throw new Error('Missing minimum native card');
    const tenThousand = addNativePreset('1000000');
    const twentyFiveThousand = addNativePreset('2500000', 'KRW', '₩ 25,000');
    const duplicate = addNativePreset('1000000');
    const invalidCards = [
      addNativePreset('1000', 'USD', '$10.00'),
      addNativePreset('not-an-amount'),
      addNativePreset('500000.5'),
      addNativePreset('0'),
      addNativePreset('-500000'),
      addNativePreset('9007199254740992'),
    ];
    await load();

    expect(presets().map((button) => button.dataset.shpPreset)).toEqual(['5000', '10000', '25000']);
    for (const card of [minimumCard, tenThousand, twentyFiveThousand, duplicate]) {
      expect(card.hidden).toBe(true);
      expect(card.hasAttribute('data-shp-native-preset')).toBe(true);
    }
    for (const card of invalidCards) {
      expect(card.hidden).toBe(false);
      expect(card.hasAttribute('data-shp-native-preset')).toBe(false);
    }
    expect(presetGroup().hidden).toBe(false);
    expect(presets().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(input().value).toBe('');
    expect(submit().disabled).toBe(true);
  });

  it('selects an editable amount and updates the preview without opening checkout', async () => {
    addNativePreset('1000000');
    const formSubmit = await load();
    preset('10000').click();

    expect(input().value).toBe('₩ 10,000');
    expect(element('shp-preview-topup').textContent).toBe('₩ 10,000');
    expect(element('shp-preview-after').textContent).toBe('₩ 100,393.2');
    expect(submit().disabled).toBe(false);
    expect(preset('10000').getAttribute('aria-pressed')).toBe('true');
    expect(preset('5000').getAttribute('aria-pressed')).toBe('false');
    expect(formSubmit).not.toHaveBeenCalled();
    expect(element<HTMLInputElement>('input_amount').value).toBe('');
    expect(element<HTMLInputElement>('input_currency').value).toBe('');

    input().value += '0';
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }),
    );
    expect(input().value).toBe('₩ 100,000');
    expect(element('shp-preview-topup').textContent).toBe('₩ 100,000');
    expect(preset('10000').getAttribute('aria-pressed')).toBe('false');

    enter('5,000.00');
    expect(preset('5000').getAttribute('aria-pressed')).toBe('true');
    enter('5,000.01');
    expect(preset('5000').getAttribute('aria-pressed')).toBe('false');
    expect(submit().disabled).toBe(true);
    expect(formSubmit).not.toHaveBeenCalled();
  });

  it('shows presets only in amount mode and preserves the selected amount draft', async () => {
    addNativePreset('1000000');
    const formSubmit = await load();
    preset('10000').click();
    element('shp-mode-target').click();
    expect(presetGroup().hidden).toBe(true);
    enter('100000');
    expect(element('shp-preview-topup').textContent).toBe('₩ 9,607');

    element('shp-mode-amount').click();
    expect(presetGroup().hidden).toBe(false);
    expect(input().value).toBe('₩ 10,000');
    expect(preset('10000').getAttribute('aria-pressed')).toBe('true');
    expect(element('shp-preview-topup').textContent).toBe('₩ 10,000');
    expect(formSubmit).not.toHaveBeenCalled();
  });

  it('disables preset changes while checkout is opening and restores them on pageshow', async () => {
    addNativePreset('1000000');
    const formSubmit = await load();
    preset('5000').click();
    submit().click();
    expect(formSubmit).toHaveBeenCalledOnce();
    expect(presets().every((button) => button.disabled)).toBe(true);

    preset('10000').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(input().value).toBe('₩ 5,000');
    expect(element<HTMLInputElement>('input_amount').value).toBe('500000');
    expect(formSubmit).toHaveBeenCalledOnce();

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(presets().every((button) => !button.disabled)).toBe(true);
    preset('10000').click();
    expect(input().value).toBe('₩ 10,000');
    expect(formSubmit).toHaveBeenCalledOnce();
  });

  it('preserves the cart shortfall prefill and marks a matching preset without submitting', async () => {
    addNativePreset('1000000');
    window.history.replaceState(null, '', '#shp=10000');
    const formSubmit = await load();
    expect(input().value).toBe('₩ 10,000');
    expect(preset('10000').getAttribute('aria-pressed')).toBe('true');
    expect(element('shp-preview-topup').textContent).toBe('₩ 10,000');
    expect(formSubmit).not.toHaveBeenCalled();
    preset('5000').click();
    expect(input().value).toBe('₩ 5,000');
    expect(preset('10000').getAttribute('aria-pressed')).toBe('false');
    expect(preset('5000').getAttribute('aria-pressed')).toBe('true');
  });

  it('retains decimal USD preset amounts through the preview and explicit submission', async () => {
    element('prices_user').replaceChildren();
    element('header_wallet_balance').textContent = '$12.34';
    addNativePreset('500', 'USD', '$5.00');
    addNativePreset('1025', 'USD', '$10.25');
    const formSubmit = await load();
    expect(presets().map((button) => button.dataset.shpPreset)).toEqual(['5', '10.25']);
    preset('10.25').click();
    expect(input().value).toBe('$ 10.25');
    expect(preset('10.25').getAttribute('aria-pressed')).toBe('true');
    expect(element('shp-preview-topup').textContent).toBe('$ 10.25');
    expect(element('shp-preview-after').textContent).toBe('$ 22.59');
    expect(formSubmit).not.toHaveBeenCalled();

    submit().click();
    expect(element<HTMLInputElement>('input_amount').value).toBe('1025');
    expect(element<HTMLInputElement>('input_currency').value).toBe('USD');
    expect(formSubmit).toHaveBeenCalledOnce();
  });
});
