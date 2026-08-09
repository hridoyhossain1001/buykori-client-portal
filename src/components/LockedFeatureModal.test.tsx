import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LockedFeatureModal,
  LOCKED_FEATURE_MINIMUM_PLAN,
  resolveLockedFeature,
} from './LockedFeatureModal';

/**
 * Regression guard for UX-02.
 *
 * The locked-feature dialog once hard-coded the "Incomplete Orders" copy and a
 * "Growth feature locked" heading, so tapping "Courier Shipping" showed the
 * wrong feature and named a tier above the one that actually unlocks it. The
 * gate (has_growth_access) opens at Starter, so the dialog must be data-driven
 * and name Starter — never Growth.
 */

test('resolveLockedFeature names the clicked courier feature and the real minimum plan', () => {
  const feature = resolveLockedFeature('orders', 'Courier Shipping');

  assert.equal(feature.name, 'Courier Shipping');
  assert.equal(feature.minimumPlan, 'Starter');
  assert.equal(feature.minimumPlan, LOCKED_FEATURE_MINIMUM_PLAN);
  assert.match(feature.description, /courier/i);
});

test('resolveLockedFeature keeps incomplete-orders copy distinct from courier copy', () => {
  const courier = resolveLockedFeature('orders', 'Courier Shipping');
  const incomplete = resolveLockedFeature('incomplete-checkouts', 'Incomplete Orders');

  assert.equal(incomplete.name, 'Incomplete Orders');
  assert.equal(incomplete.minimumPlan, 'Starter');
  assert.notEqual(incomplete.description, courier.description);
  assert.match(incomplete.description, /checkout/i);
});

test('resolveLockedFeature falls back without inventing an entitlement rule', () => {
  const feature = resolveLockedFeature('mystery', 'Mystery Feature');

  assert.equal(feature.name, 'Mystery Feature');
  assert.equal(feature.minimumPlan, 'Starter');
  assert.ok(feature.description.includes('Mystery Feature'));
});

test('the dialog renders the courier feature with truthful, accessible copy', () => {
  const html = renderToStaticMarkup(
    <LockedFeatureModal
      feature={resolveLockedFeature('orders', 'Courier Shipping')}
      onClose={() => {}}
    />,
  );

  assert.ok(html.includes('Courier Shipping is locked'), 'heading must name the clicked feature');
  assert.ok(html.includes('id="locked-feature-title"'), 'the ARIA title target must be present');
  assert.ok(html.includes('aria-labelledby="locked-feature-title"'), 'dialog must be labelled');
  assert.ok(html.includes('Starter plan and above'), 'must name the real minimum plan');
  assert.ok(!html.includes('Growth feature locked'), 'must not name the wrong tier');
  assert.ok(!html.includes('href='), 'must not invent an upgrade link');
  assert.ok(!html.includes('<a '), 'must not render an upgrade anchor');
  assert.ok(!/upgrade now|start (a )?trial|free trial/i.test(html), 'must not invent a trial CTA');
  assert.ok(!html.toLowerCase().includes('incomplete orders'), 'must not show the other feature');
});

test('the dialog swaps to the incomplete-orders feature when that item is locked', () => {
  const html = renderToStaticMarkup(
    <LockedFeatureModal
      feature={resolveLockedFeature('incomplete-checkouts', 'Incomplete Orders')}
      onClose={() => {}}
    />,
  );

  assert.ok(html.includes('Incomplete Orders is locked'));
  assert.ok(html.includes('Starter plan and above'));
  assert.ok(!html.includes('Courier Shipping'));
});

test('the dialog renders nothing until a locked feature is chosen', () => {
  const html = renderToStaticMarkup(<LockedFeatureModal feature={null} onClose={() => {}} />);

  assert.equal(html, '');
});
