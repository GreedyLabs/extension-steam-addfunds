/**
 * Cart page: add a "top up the exact shortfall" button under Steam's checkout
 * button. Clicking jumps to the add-funds page with the amount in the URL hash.
 *
 * The summary is React-rendered with hashed class names, so we anchor on Steam's
 * stable `button.DialogButton.Primary` and treat the summary box as the one whose
 * checkout button is the only button in its parent (the bottom row has two). The
 * factor is learned once from #application_config; the total is read live so the
 * button tracks cart edits.
 */
import {
  deriveFormat,
  parseMoney,
  formatMoney,
  topUpFromCents,
  type MoneyFormat,
} from './lib/money';
import { el, warn } from './lib/dom';
import { createCartHref } from './lib/cart-context';

const BTN_CLASS = 'shp-cart-btn';
const t = chrome.i18n.getMessage;

function readFormat(): MoneyFormat | null {
  // Attribute name uses underscores, so dataset (hyphen-only camelCasing) won't see it.
  const raw = document.getElementById('application_config')?.getAttribute('data-store_user_config');
  if (!raw) return null;
  try {
    const sub = JSON.parse(raw)?.accountcart?.cart?.subtotal;
    if (!sub?.amount_in_cents || !sub?.formatted_amount) return null;
    return deriveFormat(String(sub.amount_in_cents), String(sub.formatted_amount));
  } catch {
    return null;
  }
}

/** The live total (display units) inside a summary box — its only money-bearing leaf. */
function readBoxTotal(box: Element): number | null {
  for (const node of box.querySelectorAll('*')) {
    if (node.closest(`.${BTN_CLASS}`)) continue;
    if (node.childElementCount !== 0) continue;
    const value = parseMoney(node.textContent ?? '').value;
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function makeButton(neededDisplay: number, label: string, href: string): HTMLAnchorElement {
  const btn = el('a', { className: BTN_CLASS, href, textContent: label });
  btn.dataset.shpAmount = String(neededDisplay);
  return btn;
}

function inject(format: MoneyFormat): void {
  const balance = parseMoney(document.getElementById('header_wallet_balance')?.textContent ?? '');
  if (!Number.isFinite(balance.value)) return;
  const balanceCents = Math.round(balance.value * format.factor);

  for (const checkout of document.querySelectorAll('button.DialogButton.Primary')) {
    const box = checkout.parentElement;
    if (!box || box.querySelectorAll('button').length !== 1) continue; // skip the 2-button row

    const existing = box.querySelector<HTMLAnchorElement>(`.${BTN_CLASS}`);
    const total = readBoxTotal(box);
    if (total == null) {
      existing?.remove(); // zero or temporarily unavailable totals must not keep an old shortfall
      continue;
    }

    const totalCents = Math.round(total * format.factor);
    const { neededCents, neededDisplay } = topUpFromCents(totalCents, balanceCents, format);

    if (neededCents <= 0) {
      existing?.remove(); // balance covers the cart
      continue;
    }

    const label = t('cartTopupButton', [formatMoney(neededDisplay, format)]);
    const href = createCartHref({ amount: neededDisplay, format });
    if (existing) {
      if (existing.dataset.shpAmount !== String(neededDisplay)) {
        existing.dataset.shpAmount = String(neededDisplay);
      }
      if (existing.href !== href) existing.href = href;
      if (existing.textContent !== label) existing.textContent = label;
      continue;
    }
    checkout.insertAdjacentElement('afterend', makeButton(neededDisplay, label, href));
  }
}

const format = readFormat();
if (!format) {
  warn('cart config (#application_config) not found');
} else {
  // The summary re-renders on cart changes; re-run on mutations (debounced).
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      inject(format);
    });
  };
  const root = document.getElementById('page_root') ?? document.body;
  new MutationObserver(schedule).observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  inject(format);
}
