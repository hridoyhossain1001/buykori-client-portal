import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { clonePrintMarkup } from './print';

test('sanitizes the printable root, descendants, URLs, and active document tags', () => {
  const originalDocument = globalThis.document;
  const { document } = parseHTML(`
    <html><body>
      <section id="invoice" onclick="alert('root')" srcdoc="<script>alert(1)</script>">
        <a id="unsafe-tab" href="java&#9;script:alert(1)" onmouseover="alert(1)">Unsafe</a>
        <a id="unsafe-data" href="data:text/html,<script>alert(1)</script>">Data</a>
        <a id="safe" href="https://buykori.app/invoice">Safe</a>
        <iframe src="https://attacker.example"></iframe>
        <form action="https://attacker.example"><button>Submit</button></form>
        <p data-order-id="BKP-123">Invoice body</p>
      </section>
    </body></html>
  `);
  globalThis.document = document as unknown as Document;

  try {
    const markup = clonePrintMarkup('#invoice');
    assert.ok(markup);
    assert.doesNotMatch(markup, /onclick|onmouseover|srcdoc/i);
    assert.doesNotMatch(markup, /javascript:|data:text\/html/i);
    assert.doesNotMatch(markup, /<(?:iframe|form)\b/i);
    assert.match(markup, /href="https:\/\/buykori\.app\/invoice"/);
    assert.match(markup, /data-order-id="BKP-123"/);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('returns null when the print selector does not exist', () => {
  const originalDocument = globalThis.document;
  const { document } = parseHTML('<html><body></body></html>');
  globalThis.document = document as unknown as Document;
  try {
    assert.equal(clonePrintMarkup('#missing'), null);
  } finally {
    globalThis.document = originalDocument;
  }
});
