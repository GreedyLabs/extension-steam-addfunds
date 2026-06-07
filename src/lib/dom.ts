/** Shared DOM helpers for the content scripts. */

export const warn = (msg: string): void => console.warn(`[steam-addfunds] ${msg}`);

/** createElement + assign props + append children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
