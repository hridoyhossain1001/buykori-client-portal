/**
 * Pure presenters and validation for the Creative surface (Phase C3).
 *
 * Two jobs, both security-shaped:
 *
 * 1. `validateCreativeFile` mirrors the backend's intake rules (`creative_service.py:18-28`) so an
 *    obviously-bad file is refused before a 25 MB upload leaves the browser. The server's own 400
 *    stays the authority — this only spares a doomed round-trip and gives a precise message.
 *
 * 2. `toCreativeAnalysisView` maps the two very different analysis payloads (metadata intake and
 *    vision-semantic) into the one small shape the panel renders. It is an ALLOWLIST mapper: it reads
 *    only named, merchant-safe fields and never spreads a payload. The semantic findings deliberately
 *    embed provider internals — `model_identifier`, `cache_key`, `analysis_version`, `asset_hash`,
 *    `creative_id`, `analyzed_at`, and a `usage` block with `estimated_cost` (`creative_service.py:186-190`)
 *    — and the metadata `observed` object embeds `asset_id` and `content_hash` (`creative_service.py:94`).
 *    None of those are named here, so none can reach a merchant by construction. `creativeView.test.ts`
 *    asserts this with sentinel values.
 */
import type { BadgeTone } from './proposalReview';

/** Mirror of `ALLOWED_MEDIA_TYPES` (creative_service.py:18). */
export const ALLOWED_CREATIVE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'] as const;

/** Mirror of `MAX_CREATIVE_BYTES` default (creative_service.py:19): 25 MiB. */
export const MAX_CREATIVE_BYTES = 25 * 1024 * 1024;

// `reason` is declared (as `undefined`) on the success arm too so `check.reason` type-checks under
// this project's non-strict tsconfig, where `strictNullChecks` is off and control-flow narrowing does
// not drop the `{ ok: true }` member inside an `if (!check.ok)` guard. The success value never sets
// `reason` at runtime, so the shape a caller sees is unchanged.
export type CreativeFileCheck = { ok: true; reason?: undefined } | { ok: false; reason: string };

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Client-side gate matching the server's three intake failures, in the order the server applies them:
 * unsupported media type, empty file, and over the size ceiling. Anything this passes may still be
 * rejected by the server (it is the authority); nothing this rejects is worth uploading.
 */
export function validateCreativeFile(file: { type?: unknown; size?: unknown }): CreativeFileCheck {
  const type = typeof file?.type === 'string' ? file.type.toLowerCase() : '';
  const size = typeof file?.size === 'number' && Number.isFinite(file.size) ? file.size : 0;
  if (!(ALLOWED_CREATIVE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: 'Unsupported file type. Upload a JPG, PNG, WEBP, MP4, or WEBM.' };
  }
  if (size <= 0) {
    return { ok: false, reason: 'This file looks empty. Choose an image or video with content.' };
  }
  if (size > MAX_CREATIVE_BYTES) {
    return { ok: false, reason: `This file is ${formatMegabytes(size)}. The maximum is 25 MB.` };
  }
  return { ok: true };
}

/**
 * The normalized shape the creative analysis panel renders. Every field here is safe to show a
 * merchant; the mapper below is what guarantees that.
 */
export type CreativeAnalysisView = {
  status: 'ANALYZING' | 'ANALYSIS_READY' | 'NEEDS_REVIEW' | 'ANALYSIS_LIMITED' | 'FAILED';
  observed?: string[];
  recommendations?: string[];
  limitations?: string[];
  readiness?: string;
};

/** Coerce a value into a clean list of display strings, dropping empties and the model's `UNKNOWN` sentinel. */
function toStringList(value: unknown): string[] {
  const clean = (item: unknown): string => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      return trimmed.toUpperCase() === 'UNKNOWN' ? '' : trimmed;
    }
    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
    return '';
  };
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const single = clean(value);
  return single ? [single] : [];
}

/** First non-empty, non-`UNKNOWN` string from the candidates (arrays and other types are skipped). */
function firstString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && trimmed.toUpperCase() !== 'UNKNOWN') return trimmed;
    }
  }
  return '';
}

/** Order-preserving de-duplication so a recommendation echoed by two fields is shown once. */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) { seen.add(item); out.push(item); }
  }
  return out;
}

function normalizeStatus(raw: string): CreativeAnalysisView['status'] {
  switch (raw.trim().toUpperCase()) {
    case 'COMPLETED':
    case 'ANALYSIS_READY':
    case 'READY':
      return 'ANALYSIS_READY';
    case 'ANALYZING':
    case 'PENDING':
    case 'RESERVED':
      return 'ANALYZING';
    case 'ANALYSIS_LIMITED':
    case 'LIMITED':
      return 'ANALYSIS_LIMITED';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    default:
      // Anything else (NEEDS_REVIEW, NEEDS_REWORK, INSUFFICIENT, or an unrecognised word) resolves to
      // "look at this" rather than a false "ready".
      return 'NEEDS_REVIEW';
  }
}

/**
 * Map either analysis payload — the upload's inline metadata `analysis`, or the semantic
 * `analyze-semantic` `analysis` — into `CreativeAnalysisView`. `explicitStatus` is the row-level
 * `status` the semantic endpoint returns alongside its findings (`ai_ads.py:344`).
 *
 * ALLOWLIST ONLY: every read below names a specific, merchant-safe field. The metadata `observed`
 * object is never spread — only `media_type`, `width`, `height`, `aspect_ratio` are read from it, so
 * its `asset_id`/`content_hash` cannot leak. Provider internals on the semantic payload are never
 * named at all.
 */
export function toCreativeAnalysisView(findings: unknown, explicitStatus?: unknown): CreativeAnalysisView {
  const f = findings && typeof findings === 'object' ? (findings as Record<string, unknown>) : {};

  const statusSource = firstString([explicitStatus, f.status, f.state]);
  const status = normalizeStatus(statusSource);

  // Observed. Semantic payloads carry `observed_subjects` (+ `strengths`); metadata payloads carry an
  // `observed` OBJECT whose only safe, non-identifying members are read here.
  const observed: string[] = [...toStringList(f.observed_subjects), ...toStringList(f.strengths)];
  if (f.observed && typeof f.observed === 'object' && !Array.isArray(f.observed)) {
    const obj = f.observed as Record<string, unknown>;
    const mediaType = typeof obj.media_type === 'string' ? obj.media_type : '';
    const width = typeof obj.width === 'number' ? obj.width : undefined;
    const height = typeof obj.height === 'number' ? obj.height : undefined;
    const ratio = typeof obj.aspect_ratio === 'number' ? obj.aspect_ratio : undefined;
    if (mediaType) observed.push(`Format: ${mediaType}`);
    if (width && height) observed.push(`Dimensions: ${width}×${height}`);
    if (ratio) observed.push(`Aspect ratio: ${ratio}`);
  }

  const recommendations = dedupe([
    ...toStringList(f.recommendations),
    ...toStringList(f.recommended),
    ...toStringList(f.weaknesses),
  ]);

  const limitations = dedupe([...toStringList(f.uncertainty_notes), ...toStringList(f.reasons)]);

  const readiness = firstString([f.ad_readiness, f.quality, f.visual_quality, f.state]);

  const view: CreativeAnalysisView = { status };
  if (observed.length) view.observed = observed;
  if (recommendations.length) view.recommendations = recommendations;
  if (limitations.length) view.limitations = limitations;
  if (readiness) view.readiness = readiness;
  return view;
}

/** Analysis status → Badge tone, shared with the console's palette. */
export function creativeStatusTone(status: CreativeAnalysisView['status']): BadgeTone {
  switch (status) {
    case 'ANALYSIS_READY':
      return 'success';
    case 'ANALYZING':
      return 'info';
    case 'NEEDS_REVIEW':
    case 'ANALYSIS_LIMITED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}
