import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { Drawer } from './Drawer';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Drawer and ConfirmDialog are thin wrappers over Modal, so the value here is in
 * checking the wiring rather than the styling: that both are real dialogs, that
 * their titles and bodies are actually linked by aria-labelledby /
 * aria-describedby (an id that points at nothing is worse than no attribute),
 * and that `open={false}` renders nothing at all.
 *
 * Focus trapping, Escape and scroll-locking are Modal's job and are not
 * re-tested here; these two deliberately delegate instead of reimplementing
 * them, which is the point of building on Modal.
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

/** The id referenced by an ARIA attribute, so the test can prove it resolves. */
const referencedId = (html: string, attribute: string) =>
  html.match(new RegExp(`${attribute}="([^"]+)"`))?.[1] ?? null;

// --- Drawer ----------------------------------------------------------------

test('Drawer is a modal dialog whose title is the thing that names it', () => {
  const html = render(
    <Drawer onClose={() => {}} eyebrow="Order" title="BKP-1042">
      <p>body</p>
    </Drawer>,
  );
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));

  const labelId = referencedId(html, 'aria-labelledby');
  assert.ok(labelId, 'drawer must name itself with aria-labelledby');
  // The id must exist in the markup, on the element holding the title.
  assert.ok(html.includes(`id="${labelId}"`));
  assert.match(html, new RegExp(`id="${labelId}"[^>]*>BKP-1042`));

  assert.ok(html.includes('Order')); // eyebrow
  assert.ok(html.includes('body'));
});

test('Drawer offers a labelled close control', () => {
  const html = render(
    <Drawer onClose={() => {}} title="T">
      x
    </Drawer>,
  );
  // Icon-only, so it needs an accessible name; the icon itself is decorative.
  assert.ok(html.includes('aria-label="Close panel"'));
  assert.ok(html.includes('aria-hidden="true"'));
});

test('Drawer renders nothing when closed', () => {
  assert.equal(
    render(
      <Drawer open={false} onClose={() => {}} title="T">
        secret
      </Drawer>,
    ),
    '',
  );
});

test('Drawer omits the eyebrow wrapper when it has none', () => {
  const withEyebrow = render(
    <Drawer onClose={() => {}} eyebrow="Order" title="T">
      x
    </Drawer>,
  );
  const without = render(
    <Drawer onClose={() => {}} title="T">
      x
    </Drawer>,
  );
  assert.ok(withEyebrow.includes('<span'));
  assert.ok(withEyebrow.includes('Order'));
  // No empty wrapper left behind, which would add stray space above the title.
  assert.ok(!without.includes('<span'));
});

// --- ConfirmDialog ---------------------------------------------------------

test('ConfirmDialog links both its title and its consequence text', () => {
  const html = render(
    <ConfirmDialog
      onClose={() => {}}
      title="Cancel this booking?"
      actions={<button>Cancel booking</button>}
    >
      The courier will be told to stop the delivery.
    </ConfirmDialog>,
  );
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));

  const labelId = referencedId(html, 'aria-labelledby');
  const describeId = referencedId(html, 'aria-describedby');
  assert.ok(labelId && describeId);
  assert.notEqual(labelId, describeId);
  // Both must resolve: the consequence is the part a screen reader user most
  // needs before confirming, so a dangling describedby is a real failure.
  assert.match(html, new RegExp(`id="${labelId}"[^>]*>Cancel this booking\\?`));
  assert.match(html, new RegExp(`id="${describeId}"[^>]*>The courier will be told`));
});

test('ConfirmDialog describes nothing when it has no body', () => {
  // Pointing aria-describedby at an element that was never rendered is worse
  // than leaving the attribute off.
  const html = render(
    <ConfirmDialog onClose={() => {}} title="Delete?" actions={<button>Delete</button>} />,
  );
  assert.ok(!html.includes('aria-describedby'));
  assert.ok(html.includes('aria-labelledby'));
});

test('ConfirmDialog renders the actions it was given, in order', () => {
  const html = render(
    <ConfirmDialog
      onClose={() => {}}
      title="Delete?"
      actions={
        <>
          <button>Keep</button>
          <button>Delete</button>
        </>
      }
    />,
  );
  assert.ok(html.indexOf('>Keep<') < html.indexOf('>Delete<'), 'action order must be preserved');
});

test('ConfirmDialog renders nothing when closed', () => {
  assert.equal(
    render(
      <ConfirmDialog open={false} onClose={() => {}} title="T" actions={<button>x</button>} />,
    ),
    '',
  );
});
