import { useRef, useState } from 'react';
import { Copy, Image as ImageIcon, Sparkles, Upload, Video, Wand2 } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { Input } from '../common/Input';
import {
  creativeStatusTone,
  toCreativeAnalysisView,
  validateCreativeFile,
  type CreativeAnalysisView,
} from './creativeView';
import {
  analyzeAiAdsCreative,
  generateAiAdsCreativePrompt,
  uploadAiAdsCreative,
  type CreativeUploadResult,
} from '../../services/aiAdsApi';

/**
 * Merchant-safe rendering of one normalized analysis. Only the fields on `CreativeAnalysisView`
 * are ever read — the mapper that produced it already dropped every provider internal — so this
 * presenter cannot leak a model name, cache key, or cost even by accident.
 */
function CreativeAnalysisPanel({ title, analysis }: { title: string; analysis: CreativeAnalysisView }) {
  return (
    <section className="space-y-3 rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{title}</h4>
        <Badge tone={creativeStatusTone(analysis.status)}>{analysis.status.replaceAll('_', ' ')}</Badge>
      </div>
      {analysis.observed?.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--bk-console-text-muted)]">Observed</p>
          <ul className="mt-1 space-y-1 text-sm text-[var(--bk-console-text)]">
            {analysis.observed.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {analysis.recommendations?.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--bk-console-text-muted)]">Recommendations</p>
          <ul className="mt-1 space-y-1 text-sm text-[var(--bk-console-text)]">
            {analysis.recommendations.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {analysis.limitations?.length ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{analysis.limitations.join(' ')}</p>
      ) : null}
      {analysis.readiness ? (
        <p className="text-sm font-medium text-[var(--bk-console-text)]">Readiness: {analysis.readiness.replaceAll('_', ' ')}</p>
      ) : null}
    </section>
  );
}

/** Copy-to-clipboard button that confirms briefly, so a merchant knows the prompt is on the clipboard. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission). The prompt is still on
      // screen to copy by hand, so this is a soft failure with no error surface.
    }
  };
  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()}>
      <Copy className="h-3.5 w-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * One generated prompt card. The endpoint hands over a *prompt for an external tool*
 * (`generation: "external_only"`) — the platform never generates the image or video itself — and
 * that is stated plainly so a merchant is not left waiting for a render that will not come. The
 * `NEEDS_MORE_INFORMATION` branch is handled explicitly rather than showing an empty card.
 */
function PromptCard({ kind, result }: { kind: 'image' | 'video'; result: Record<string, unknown> }) {
  const Icon = kind === 'image' ? ImageIcon : Video;
  const heading = kind === 'image' ? 'Image prompt' : 'Video prompt';

  if (result.state === 'NEEDS_MORE_INFORMATION') {
    const missing = asStringList(result.missing);
    return (
      <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--bk-console-text-muted)]" aria-hidden="true" />
          <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{heading}</h4>
        </div>
        <p className="mt-2 text-xs text-[var(--bk-console-text-muted)]">
          A product name is needed before a {kind} prompt can be written{missing.length ? ` (missing: ${missing.join(', ')})` : ''}.
        </p>
      </div>
    );
  }

  const prompt = asText(result.prompt);
  const purpose = asText(result.purpose);
  const format = asText(result.recommended_format);
  const ratio = asText(result.recommended_ratio);
  const limitations = asStringList(result.limitations);

  return (
    <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--bk-console-text-muted)]" aria-hidden="true" />
          <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{heading}</h4>
        </div>
        {prompt ? <CopyButton text={prompt} /> : null}
      </div>
      {(purpose || format || ratio) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {purpose ? <Badge tone="neutral">{purpose}</Badge> : null}
          {format ? <Badge tone="neutral">{format}</Badge> : null}
          {ratio ? <Badge tone="neutral">{ratio}</Badge> : null}
        </div>
      )}
      {prompt ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--bk-console-surface-muted)] px-3 py-2 text-sm leading-6 text-[var(--bk-console-text)]">
          {prompt}
        </p>
      ) : null}
      {limitations.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-700">
          {limitations.map(item => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-[var(--bk-console-text-subtle)]">
        This is a prompt for an external image or video tool. Buykori does not generate the media itself.
      </p>
    </div>
  );
}

/**
 * The Creative tab: upload a creative for validation + inline metadata analysis, optionally run the
 * deeper AI (vision) analysis, and generate copy-ready image/video prompts. Every capability here
 * already shipped server-side and had no UI. Multi-asset comparison (`POST /ai-ads/creatives/compare`)
 * is intentionally left out — it needs a selection UI — rather than being half-built.
 */
export function CreativePanel({ showToast }: { showToast: (message: string, isError?: boolean) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploaded, setUploaded] = useState<CreativeUploadResult | null>(null);
  const [metadataView, setMetadataView] = useState<CreativeAnalysisView | null>(null);
  const [semanticView, setSemanticView] = useState<CreativeAnalysisView | null>(null);

  const [productName, setProductName] = useState('');
  const [promptBusy, setPromptBusy] = useState<'image' | 'video' | ''>('');
  const [imagePrompt, setImagePrompt] = useState<Record<string, unknown> | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<Record<string, unknown> | null>(null);

  const handleFile = async (file: File) => {
    const check = validateCreativeFile(file);
    if (!check.ok) {
      showToast(check.reason, true);
      return;
    }
    setUploading(true);
    setSemanticView(null);
    try {
      const result = await uploadAiAdsCreative(file);
      setUploaded(result);
      setMetadataView(toCreativeAnalysisView(result.analysis));
      showToast('Creative uploaded and analysed.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The creative could not be uploaded.', true);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runSemanticAnalysis = async () => {
    if (!uploaded) return;
    setAnalyzing(true);
    try {
      const result = await analyzeAiAdsCreative(uploaded.id);
      // The endpoint returns findings (`analysis`) plus a sibling `recommendations` list; merge the
      // latter in so both reach the merchant. The mapper is an allowlist and de-dupes, so this stays
      // safe and tidy.
      const merged: Record<string, unknown> = { ...(result.analysis as Record<string, unknown>) };
      if (Array.isArray(result.recommendations) && result.recommendations.length) {
        const existing = Array.isArray(merged.recommendations) ? (merged.recommendations as unknown[]) : [];
        merged.recommendations = [...existing, ...result.recommendations];
      }
      setSemanticView(toCreativeAnalysisView(merged, result.status));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI analysis could not be completed.', true);
    } finally {
      setAnalyzing(false);
    }
  };

  const generatePrompt = async (kind: 'image' | 'video') => {
    setPromptBusy(kind);
    try {
      const result = await generateAiAdsCreativePrompt(kind, { product: productName.trim() });
      if (kind === 'image') setImagePrompt(result);
      else setVideoPrompt(result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The prompt could not be generated.', true);
    } finally {
      setPromptBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Creative studio</h3>
          <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
            Upload an image or video to check it, get an AI read on it, and draft prompts for an external
            image or video tool. Nothing here changes a live ad.
          </p>
        </div>

        <div
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? 'border-[var(--bk-console-blue)] bg-[var(--bk-console-blue-soft)]' : 'border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)]'
          }`}
        >
          <Upload className="h-6 w-6 text-[var(--bk-console-text-muted)]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--bk-console-text)]">Drag a creative here, or choose a file</p>
          <p className="text-xs text-[var(--bk-console-text-muted)]">JPG, PNG, WEBP, MP4, or WEBM · up to 25 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="hidden"
            onChange={event => { const file = event.target.files?.[0]; if (file) void handleFile(file); }}
          />
          <Button variant="primary" className="mt-1" onClick={() => fileInputRef.current?.click()} loading={uploading} disabled={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Choose file'}
          </Button>
        </div>

        {metadataView ? (
          <div className="space-y-3">
            <CreativeAnalysisPanel title="File analysis" analysis={metadataView} />
            {semanticView ? (
              <CreativeAnalysisPanel title="AI creative analysis" analysis={semanticView} />
            ) : (
              <Button variant="secondary" onClick={() => void runSemanticAnalysis()} loading={analyzing} disabled={analyzing}>
                <Sparkles className="h-4 w-4" />
                {analyzing ? 'Analysing…' : 'Analyse with AI'}
              </Button>
            )}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-[var(--bk-console-border)] pt-5">
        <div>
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Prompt generator</h3>
          <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
            Enter a product name to draft a safe, copy-ready prompt for an image or video tool.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Product name"
            wrapperClassName="flex-1"
            value={productName}
            onChange={event => setProductName(event.target.value)}
            placeholder="e.g. Handloom cotton saree"
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void generatePrompt('image')} loading={promptBusy === 'image'} disabled={promptBusy !== ''}>
              <Wand2 className="h-4 w-4" />
              Image prompt
            </Button>
            <Button variant="primary" onClick={() => void generatePrompt('video')} loading={promptBusy === 'video'} disabled={promptBusy !== ''}>
              <Wand2 className="h-4 w-4" />
              Video prompt
            </Button>
          </div>
        </div>
        {imagePrompt || videoPrompt ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {imagePrompt ? <PromptCard kind="image" result={imagePrompt} /> : null}
            {videoPrompt ? <PromptCard kind="video" result={videoPrompt} /> : null}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            compact
            title="No prompts yet"
            description="Add a product name and generate an image or video prompt to get started."
          />
        )}
      </section>
    </div>
  );
}

export default CreativePanel;
