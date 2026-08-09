import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ErrorState } from './ErrorState';

/**
 * UX-02. Panels used to swallow fetch failures, so a dead network rendered the
 * same "nothing here" placeholder as a genuinely empty account. This state has
 * to be visibly a failure, announce itself, and offer a way back.
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

test('announces the failure to assistive tech', () => {
  const html = render(<ErrorState description="We couldn't reach the server." />);
  assert.ok(html.includes('role="alert"'));
});

test('shows the actionable sentence it was given, not a raw error', () => {
  const html = render(<ErrorState description="You appear to be offline. Reconnect and try again." />);
  assert.ok(html.includes('You appear to be offline. Reconnect and try again.'));
  assert.ok(!html.includes('TypeError'));
  assert.ok(!html.includes('Failed to fetch'));
});

test('renders a retry affordance only when a handler is supplied', () => {
  const without = render(<ErrorState description="Broken." />);
  assert.ok(!without.includes('Try again'));

  const withRetry = render(<ErrorState description="Broken." onRetry={() => {}} />);
  assert.ok(withRetry.includes('Try again'));
  assert.ok(withRetry.includes('<button'));
});

test('disables the retry button while a retry is in flight', () => {
  const html = render(<ErrorState description="Broken." onRetry={() => {}} retrying />);
  assert.ok(html.includes('disabled'));
  assert.ok(html.includes('Retrying'));
  assert.ok(!html.includes('>Try again<'));
});

test('uses a default title but lets a panel override it', () => {
  assert.ok(render(<ErrorState description="x" />).includes("Couldn&#x27;t load this"));
  assert.ok(
    render(<ErrorState title="Couldn't load delivery health" description="x" />)
      .includes('Couldn&#x27;t load delivery health')
  );
});
