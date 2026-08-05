/**
 * Centralized clipboard writes for the client portal.
 *
 * Call sites used to invoke `navigator.clipboard.writeText()` directly, usually
 * without awaiting it. That is unreliable for two reasons:
 *   1. `writeText()` returns a promise that rejects when the document is not
 *      focused, when the user denies the permission, or when the page is served
 *      over a non-secure origin. An unawaited rejection is swallowed, so the UI
 *      would report "copied" even though nothing reached the clipboard.
 *   2. `navigator.clipboard` is simply `undefined` outside a secure context,
 *      which throws a TypeError rather than rejecting.
 *
 * `copyText()` resolves to a boolean instead of throwing, so callers can only
 * report success after the write actually succeeded.
 */

/**
 * Legacy fallback for browsers/origins without the async clipboard API.
 *
 * The textarea is positioned off-screen rather than hidden: `display:none` and
 * `visibility:hidden` elements cannot be selected, so the copy would silently
 * fail. `readOnly` keeps the mobile keyboard from opening during the flash.
 */
function copyViaExecCommand(value: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Write `value` to the clipboard. Never throws.
 *
 * @returns `true` only when the text was actually written.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Permission denied, document not focused, or non-secure origin.
      // Fall through to the legacy path before giving up.
    }
  }

  return copyViaExecCommand(value);
}

type ToastFn = (msg: string, isErr?: boolean) => void;

interface CopyFeedbackOptions {
  /** Message shown only after a confirmed successful write. */
  success?: string;
  /** Message shown when the write failed. */
  error?: string;
}

/**
 * Copy `value` and report the real outcome through the caller's toast.
 *
 * The success message is deliberately emitted after the await, so a rejected
 * write can never present itself to the user as a successful copy.
 */
export async function copyTextWithFeedback(
  value: string,
  showToast: ToastFn,
  options: CopyFeedbackOptions = {},
): Promise<boolean> {
  const copied = await copyText(value);
  if (copied) {
    if (options.success) showToast(options.success, false);
  } else {
    showToast(options.error || 'Could not copy to clipboard.', true);
  }
  return copied;
}

export default copyText;
