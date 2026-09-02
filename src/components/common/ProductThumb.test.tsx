import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ProductThumb } from './ProductThumb';

/**
 * The photo URL in an order payload comes from the merchant's own WooCommerce
 * media library — data we do not control. The backend already filters it, but
 * this component is the last gate before it lands in an `<img src>`, so the
 * scheme check is pinned here too. The fallback matters as much: plenty of real
 * products have no featured image, and an order row must never show a browser's
 * broken-image glyph.
 */

const markupFor = (props: Parameters<typeof ProductThumb>[0]) =>
  renderToStaticMarkup(React.createElement(ProductThumb, props));

test('an http(s) photo renders as an image with the product name in the alt text', () => {
  const markup = markupFor({ src: 'https://shop.example.com/hoodie.jpg', name: 'Cotton Hoodie' });
  assert.match(markup, /<img/);
  assert.match(markup, /src="https:\/\/shop\.example\.com\/hoodie\.jpg"/);
  assert.match(markup, /alt="Cotton Hoodie product photo"/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /referrerpolicy="no-referrer"/i);
});

test('a non-http URL never reaches an img src', () => {
  for (const src of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', '//shop.example.com/x.jpg', '']) {
    const markup = markupFor({ src, name: 'Cotton Hoodie' });
    assert.ok(!markup.includes('<img'), `expected no <img> for ${JSON.stringify(src)}`);
    assert.ok(!markup.includes(src) || src === '', `expected ${JSON.stringify(src)} not to be rendered`);
  }
});

test('a missing photo falls back to a decorative placeholder, not a broken image', () => {
  const markup = markupFor({ name: 'Cotton Hoodie' });
  assert.ok(!markup.includes('<img'));
  assert.match(markup, /<svg/);
  assert.match(markup, /aria-hidden="true"/);
});
