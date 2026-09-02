import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import WhatsAppConnectSection from './WhatsAppConnectSection';
import type { WhatsAppStatus } from '../../services/whatsappApi';

/**
 * The risky part of this section is the automatic-sending switch: it turns an
 * unofficial WhatsApp number into an automated sender, so it must be OFF unless
 * the store really asked for it, must be unclickable when the server or the plan
 * would refuse anyway, and must say in plain words when nothing gets sent.
 *
 * Rendered as static markup, so these check the contract a merchant actually
 * sees (state, disabled-ness, wording) rather than click plumbing.
 */

const status = (overrides: Partial<WhatsAppStatus> = {}): WhatsAppStatus => ({
  available: true,
  hasPlanAccess: true,
  connected: true,
  session: {
    status: 'connected',
    phoneNumber: '8801712345678',
    deviceLabel: null,
    connectedAt: '2026-08-27T10:00:00Z',
    disconnectedAt: null,
    lastSeenAt: null,
    lastError: null,
    consentAcceptedAt: null,
    dailySentCount: 3,
    dailyLimit: 100,
  },
  autoSend: false,
  autoSendQuietHours: { start: 22, end: 9 },
  qr: null,
  ...overrides,
});

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

/**
 * True when the rendered switch is really unclickable. Checked on the opening
 * tag only: the class list contains `disabled:opacity-60`, so searching the
 * whole markup for "disabled" would pass even on a live switch.
 */
const switchIsDisabled = (html: string): boolean => {
  const tag = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0];
  assert.ok(tag, 'expected an automatic-sending switch in the markup');
  return tag!.includes('disabled=""');
};

const section = (props: Partial<React.ComponentProps<typeof WhatsAppConnectSection>> = {}) =>
  render(
    <WhatsAppConnectSection
      status={status()}
      busy={false}
      connectWhatsApp={() => {}}
      disconnectWhatsApp={() => {}}
      refreshWhatsApp={() => {}}
      setAutoSend={() => {}}
      {...props}
    />,
  );

test('the automatic-sending switch reads off until the store turns it on', () => {
  const off = section();
  assert.ok(off.includes('role="switch"'));
  assert.ok(off.includes('aria-checked="false"'));
  assert.ok(off.includes('aria-label="Send WhatsApp confirmations automatically"'));

  const on = section({ status: status({ autoSend: true }) });
  assert.ok(on.includes('aria-checked="true"'));
});

test('the night window is spelled out on a clock a merchant reads', () => {
  const html = section();
  assert.ok(html.includes('nothing is sent between 10 PM and 9 AM'));

  const custom = section({ status: status({ autoSendQuietHours: { start: 23, end: 7 } }) });
  assert.ok(custom.includes('nothing is sent between 11 PM and 7 AM'));
});

test('the switch is dead when the server or the plan would refuse the change', () => {
  // A switch that looks live but always errors is worse than a disabled one.
  assert.ok(switchIsDisabled(section({ status: status({ hasPlanAccess: false }) })));
  assert.ok(switchIsDisabled(section({ status: status({ available: false }) })));
  assert.ok(switchIsDisabled(section({ autoSendBusy: true })));
  // A portal talking to a server that has no settings endpoint passes no handler.
  assert.ok(switchIsDisabled(section({ setAutoSend: undefined })));

  assert.equal(switchIsDisabled(section()), false);
});

test('the switch only exists once a number is linked', () => {
  // Nothing can be automated before pairing, so the whole block stays hidden.
  const notLinked = section({
    status: status({ connected: false, session: { ...status().session, status: 'disconnected' } }),
  });
  assert.ok(!notLinked.includes('role="switch"'));
  assert.ok(notLinked.includes('Connect WhatsApp'));
});

test('the merchant is told the manual button still works and each order is asked once', () => {
  const html = section();
  assert.ok(html.includes('Order Management'));
  assert.ok(html.includes('Each order is asked once only'));
  // The reply gets a thank-you back, which spends a second daily slot. The
  // merchant has to know that before the counter surprises them.
  assert.ok(html.includes('uses two of today'));
});

/**
 * Pressing Connect is the merchant's consent to run their own number as an
 * automated sender, so the ban warning and the liability line must be on screen
 * in every state — including before pairing and when the feature is switched off,
 * because that is exactly when someone decides which number to use.
 */
test('the ban warning and the liability disclaimer are always on screen', () => {
  for (const html of [
    section(),
    section({ status: status({ connected: false, session: { ...status().session, status: 'disconnected' } }) }),
    section({ status: status({ available: false }) }),
    section({ status: status({ hasPlanAccess: false }) }),
  ]) {
    assert.ok(html.includes('Read this before you link a number'));
    assert.ok(html.includes('Buykori takes no responsibility for a number that'));
    assert.ok(html.includes('We strongly recommend linking a separate number'));
    assert.ok(html.includes('for <b>every order</b>'));
  }
});
