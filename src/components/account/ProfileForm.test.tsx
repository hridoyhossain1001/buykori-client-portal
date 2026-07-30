import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileForm } from './ProfileForm';
import type { UserProfile } from '../../types';

/**
 * Regression guard for FE-14.
 *
 * A refactor once split AccountView into smaller components and dropped the
 * sign-in email input plus the verification-code panel from ProfileForm, while
 * leaving the props on the interface and the API helpers in place. TypeScript
 * and ESLint cannot see that kind of behavioural loss, so it is asserted here
 * against the rendered markup instead.
 *
 * No new dependency is used: react-dom is already a runtime dependency, and
 * renderToStaticMarkup needs no DOM implementation.
 */

const profile: UserProfile = {
  name: 'Rafi',
  email: 'rafi@example.com',
  emailVerified: true,
  notificationEmail: 'alerts@example.com',
  plan: 'Growth',
  eventsUsed: 10,
  eventsQuota: 100,
  renewalDate: '2026-08-01',
};

type ProfileFormProps = ComponentProps<typeof ProfileForm>;

const noop = () => {};

function render(overrides: Partial<ProfileFormProps> = {}): string {
  const props: ProfileFormProps = {
    profile,
    profName: profile.name,
    setProfName: noop,
    profEmail: profile.email,
    setProfEmail: noop,
    profEmailCodeRequested: false,
    profEmailCode: '',
    setProfEmailCode: noop,
    profEmailCurrentPassword: '',
    setProfEmailCurrentPassword: noop,
    profNotifEmail: profile.notificationEmail,
    setProfNotifEmail: noop,
    profUpdating: false,
    submitProfileSave: async () => true,
    ...overrides,
  };

  return renderToStaticMarkup(<ProfileForm {...props} />);
}

test('renders an editable sign-in email input bound to profEmail', () => {
  const html = render();

  assert.ok(
    html.includes('id="account-profile-email"'),
    'the sign-in email input must be rendered',
  );
  assert.ok(
    html.includes('value="rafi@example.com"'),
    'the sign-in email input must be bound to the profEmail value',
  );
  assert.ok(
    !html.includes('readonly'),
    'the sign-in email input must not be read-only',
  );
  assert.ok(
    !html.toLowerCase().includes('contact support to change'),
    'the read-only fallback copy must not come back',
  );
});

test('keeps the notification email as a separate field', () => {
  const html = render();

  assert.ok(html.includes('id="account-notification-email"'));
  assert.ok(html.includes('value="alerts@example.com"'));
});

test('hides the verification panel while the email is unchanged', () => {
  const html = render();

  assert.ok(!html.includes('id="account-email-code"'));
  assert.ok(!html.includes('id="account-email-current-password"'));
});

test('hides the verification panel until a code has been requested', () => {
  const html = render({ profEmail: 'new-address@example.com' });

  assert.ok(!html.includes('id="account-email-code"'));
});

test('shows the code and current-password inputs once a code is requested', () => {
  const html = render({
    profEmail: 'new-address@example.com',
    profEmailCodeRequested: true,
  });

  assert.ok(
    html.includes('id="account-email-code"'),
    'the verification code input must be rendered',
  );
  assert.ok(
    html.includes('id="account-email-current-password"'),
    'the current password input must be rendered',
  );
});

test('treats the email as unchanged when only case or padding differs', () => {
  const html = render({
    profEmail: '  RAFI@Example.com  ',
    profEmailCodeRequested: true,
  });

  assert.ok(
    !html.includes('id="account-email-code"'),
    'case and whitespace differences must not trigger re-verification',
  );
});

test('moves the submit label through the three states of the flow', () => {
  assert.ok(render().includes('Save changes'));

  assert.ok(
    render({ profEmail: 'new-address@example.com' }).includes('Send Code to New Email'),
  );

  assert.ok(
    render({
      profEmail: 'new-address@example.com',
      profEmailCodeRequested: true,
    }).includes('Verify Email'),
  );
});

test('disables the submit button while an update is in flight', () => {
  const html = render({ profUpdating: true });

  assert.ok(html.includes('disabled'));
  assert.ok(!html.includes('Save changes'));
});
