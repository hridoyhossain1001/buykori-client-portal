/**
 * Tags that must never survive into printable markup.
 *
 * `script` and `style` were already removed. The rest are added because each is
 * an independent script-execution or navigation-hijack vector:
 *   iframe/object/embed - can load and run arbitrary documents
 *   base                - rewrites the resolution of every relative URL
 *   form                - can be submitted programmatically to an attacker origin
 */
const DANGEROUS_TAGS = 'script, style, iframe, object, embed, base, form';

/**
 * Strip event handlers and script-bearing URLs from a single element.
 *
 * Note on the value normalization: `.trim()` alone is not enough. It removes
 * leading and trailing whitespace, but browsers also ignore control characters
 * *inside* a URL scheme when resolving it. That means `java\tscript:alert(1)`
 * and `java\nscript:alert(1)` both execute, while both pass a naive
 * `.trim().toLowerCase().startsWith('javascript:')` check. Removing every
 * character in U+0000..U+0020 first closes that hole.
 */
function stripDangerousAttributes(node: Element): void {
  Array.from(node.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.replace(/[\u0000-\u0020]/g, '').toLowerCase();

    const isEventHandler = name.startsWith('on');
    const isInlineDocument = name === 'srcdoc';
    const isScriptUrl =
      value.startsWith('javascript:') ||
      value.startsWith('vbscript:') ||
      value.startsWith('data:text/html');

    if (isEventHandler || isInlineDocument || isScriptUrl) {
      node.removeAttribute(attribute.name);
    }
  });
}

export function clonePrintMarkup(selector: string): string | null {
  const source = document.querySelector(selector);
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(DANGEROUS_TAGS).forEach((node) => node.remove());

  // The root element first. querySelectorAll('*') below returns descendants
  // ONLY, so before this line an attribute on the element matched by `selector`
  // itself was copied through untouched.
  stripDangerousAttributes(clone);
  clone.querySelectorAll<HTMLElement>('*').forEach((node) => stripDangerousAttributes(node));

  return clone.outerHTML;
}
