import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOWED_CREATIVE_TYPES,
  MAX_CREATIVE_BYTES,
  creativeStatusTone,
  toCreativeAnalysisView,
  validateCreativeFile,
} from './creativeView';

test('validateCreativeFile accepts every allowed media type within the size limit', () => {
  for (const type of ALLOWED_CREATIVE_TYPES) {
    assert.deepEqual(validateCreativeFile({ type, size: 1024 }), { ok: true }, `expected ${type} to pass`);
  }
  // Casing from the OS/browser should not matter.
  assert.deepEqual(validateCreativeFile({ type: 'IMAGE/JPEG', size: 1024 }), { ok: true });
});

test('validateCreativeFile applies type → empty → too-big in that order', () => {
  // Unsupported type is rejected first, even when the file is also empty.
  const badType = validateCreativeFile({ type: 'application/pdf', size: 0 });
  assert.equal(badType.ok, false);
  assert.match((badType as { reason: string }).reason, /Unsupported file type/);

  // A supported but empty file is the empty message, not the size message.
  const empty = validateCreativeFile({ type: 'image/png', size: 0 });
  assert.equal(empty.ok, false);
  assert.match((empty as { reason: string }).reason, /empty/);

  // Just over the ceiling is refused with the actual size in the message.
  const tooBig = validateCreativeFile({ type: 'video/mp4', size: MAX_CREATIVE_BYTES + 1 });
  assert.equal(tooBig.ok, false);
  assert.match((tooBig as { reason: string }).reason, /maximum is 25 MB/);

  // Exactly at the ceiling is allowed (server uses a strict greater-than).
  assert.deepEqual(validateCreativeFile({ type: 'video/mp4', size: MAX_CREATIVE_BYTES }), { ok: true });
});

test('validateCreativeFile treats missing or non-string type/size defensively', () => {
  assert.equal(validateCreativeFile({}).ok, false);
  assert.equal(validateCreativeFile({ type: 42, size: 'big' }).ok, false);
  assert.equal(validateCreativeFile({ type: 'image/png', size: Number.NaN }).ok, false);
});

test('toCreativeAnalysisView maps semantic findings to merchant-safe fields', () => {
  const view = toCreativeAnalysisView(
    {
      observed_subjects: ['A red handbag on a plain background', 'UNKNOWN'],
      strengths: ['Sharp product focus'],
      recommendations: ['Add a lifestyle shot', 'Add a lifestyle shot'],
      weaknesses: ['Lighting is flat'],
      uncertainty_notes: ['Text legibility not assessed'],
      ad_readiness: 'READY_WITH_EDITS',
    },
    'NEEDS_REVIEW',
  );
  assert.equal(view.status, 'NEEDS_REVIEW');
  assert.deepEqual(view.observed, ['A red handbag on a plain background', 'Sharp product focus']);
  // Deduped across recommendations + weaknesses, order preserved.
  assert.deepEqual(view.recommendations, ['Add a lifestyle shot', 'Lighting is flat']);
  assert.deepEqual(view.limitations, ['Text legibility not assessed']);
  assert.equal(view.readiness, 'READY_WITH_EDITS');
});

test('toCreativeAnalysisView reads only safe members of the metadata observed object', () => {
  const view = toCreativeAnalysisView({
    status: 'COMPLETED',
    observed: { media_type: 'image/jpeg', width: 1080, height: 1080, aspect_ratio: 1 },
    recommended: ['Try a 4:5 crop for feed'],
    quality: 'good',
  });
  assert.equal(view.status, 'ANALYSIS_READY');
  assert.deepEqual(view.observed, ['Format: image/jpeg', 'Dimensions: 1080×1080', 'Aspect ratio: 1']);
  assert.deepEqual(view.recommendations, ['Try a 4:5 crop for feed']);
  assert.equal(view.readiness, 'good');
});

test('toCreativeAnalysisView normalises unknown/absent status to a review state, not "ready"', () => {
  assert.equal(toCreativeAnalysisView({}).status, 'NEEDS_REVIEW');
  assert.equal(toCreativeAnalysisView({ status: 'INSUFFICIENT' }).status, 'NEEDS_REVIEW');
  assert.equal(toCreativeAnalysisView({ status: 'analyzing' }).status, 'ANALYZING');
  assert.equal(toCreativeAnalysisView({ status: 'failed' }).status, 'FAILED');
  assert.equal(toCreativeAnalysisView({ status: 'ANALYSIS_LIMITED' }).status, 'ANALYSIS_LIMITED');
});

test('toCreativeAnalysisView NEVER leaks provider internals into the rendered view', () => {
  // A payload salted with every sensitive field the backend attaches, each with a unique sentinel.
  const SENTINELS = [
    'SECRET-model-gpt5-vision',
    'SECRET-cache-key-abc123',
    'SECRET-asset-hash-deadbeef',
    'SECRET-creative-id-99',
    'SECRET-analyzed-at-2026',
    'SECRET-content-hash-cafef00d',
    'SECRET-asset-id-4242',
    'SECRET-analysis-version-7',
    'SECRET-estimated-cost-0.0123',
  ];
  const view = toCreativeAnalysisView(
    {
      // Safe, merchant-facing content that MUST survive.
      observed_subjects: ['A product on a table'],
      recommendations: ['Brighten the shot'],
      ad_readiness: 'READY',
      // Sensitive siblings that MUST be dropped.
      model_identifier: 'SECRET-model-gpt5-vision',
      cache_key: 'SECRET-cache-key-abc123',
      asset_hash: 'SECRET-asset-hash-deadbeef',
      creative_id: 'SECRET-creative-id-99',
      analyzed_at: 'SECRET-analyzed-at-2026',
      analysis_version: 'SECRET-analysis-version-7',
      usage: { estimated_cost: 'SECRET-estimated-cost-0.0123', prompt_tokens: 123 },
      // Sensitive members hidden inside the metadata observed object.
      observed: {
        media_type: 'image/jpeg',
        width: 800,
        height: 600,
        aspect_ratio: 1.33,
        asset_id: 'SECRET-asset-id-4242',
        content_hash: 'SECRET-content-hash-cafef00d',
      },
    },
    'ANALYSIS_READY',
  );

  const serialized = JSON.stringify(view);
  for (const sentinel of SENTINELS) {
    assert.ok(!serialized.includes(sentinel), `sensitive value leaked into view: ${sentinel}`);
  }
  // And the safe content did make it through.
  assert.ok(serialized.includes('A product on a table'));
  assert.ok(serialized.includes('Brighten the shot'));
  assert.ok(view.observed?.includes('Format: image/jpeg'));
  assert.equal(view.readiness, 'READY');
});

test('creativeStatusTone maps each status to a console Badge tone', () => {
  assert.equal(creativeStatusTone('ANALYSIS_READY'), 'success');
  assert.equal(creativeStatusTone('ANALYZING'), 'info');
  assert.equal(creativeStatusTone('NEEDS_REVIEW'), 'warning');
  assert.equal(creativeStatusTone('ANALYSIS_LIMITED'), 'warning');
  assert.equal(creativeStatusTone('FAILED'), 'danger');
});
