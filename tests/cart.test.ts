// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NativeMutationObserver = MutationObserver;
let observers: MutationObserver[];

function total(): HTMLElement {
  return document.getElementById('cart-total')!;
}

function topup(): HTMLAnchorElement | null {
  return document.querySelector('.shp-cart-btn');
}

beforeEach(() => {
  vi.resetModules();
  observers = [];
  vi.stubGlobal(
    'MutationObserver',
    class extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        observers.push(this);
      }
    },
  );
  vi.stubGlobal('chrome', {
    i18n: {
      getMessage: (key: string, substitutions: string[] = []) => [key, ...substitutions].join(' '),
    },
  });
  document.body.innerHTML = `
    <div id="application_config"></div>
    <a id="header_wallet_balance">₩ 10,000</a>
    <div id="page_root">
      <section>
        <span>예상 합계</span><span id="cart-total">₩ 50,000</span>
        <button class="DialogButton Primary">결제하기</button>
      </section>
    </div>
  `;
  document.getElementById('application_config')!.setAttribute(
    'data-store_user_config',
    JSON.stringify({
      accountcart: {
        cart: { subtotal: { amount_in_cents: '5000000', formatted_amount: '₩ 50,000' } },
      },
    }),
  );
});

afterEach(() => {
  observers.forEach((observer) => observer.disconnect());
  vi.unstubAllGlobals();
});

describe('live cart shortfall', () => {
  it.each(['₩ 0', '—'])(
    'removes a stale button when the total becomes %s and restores it with the new amount',
    async (unavailableTotal) => {
      await import('../src/cart');
      expect(topup()?.hash).toBe('#shp=40000');

      total().textContent = unavailableTotal;
      await vi.waitFor(() => expect(topup()).toBeNull());

      total().textContent = '₩ 25,000';
      await vi.waitFor(() => expect(topup()?.hash).toBe('#shp=15000'));
      expect(topup()?.textContent).toContain('₩ 15,000');
    },
  );
});
