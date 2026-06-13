export function clonePrintMarkup(selector: string): string | null {
  const source = document.querySelector(selector);
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style').forEach((node) => node.remove());
  clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return clone.outerHTML;
}
