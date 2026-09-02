import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

type ProductThumbSize = 'sm' | 'md';

interface ProductThumbProps {
  /** Absolute http(s) URL from the order payload. Anything else is ignored. */
  src?: string | null;
  /** Product name — used for the alt text so the row stays readable without the photo. */
  name?: string | null;
  size?: ProductThumbSize;
  className?: string;
}

const sizeClasses: Record<ProductThumbSize, string> = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-11 w-11 rounded-lg',
};

const iconClasses: Record<ProductThumbSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
};

/** Intrinsic pixel size, so the box is reserved before the photo arrives. */
const pixelSize: Record<ProductThumbSize, number> = {
  sm: 32,
  md: 44,
};

/**
 * Product photo next to the product name in Orders and COD review.
 *
 * The URL comes from the merchant's own WooCommerce media library, so three
 * things are deliberate here:
 *
 *  - **Only http(s) is rendered.** The value travels through the plugin payload
 *    and the API, so treating it as trusted markup would hand a store the
 *    ability to put a `javascript:`/`data:` URL into our dashboard. The backend
 *    filters too; this is the second gate.
 *  - **A missing or broken photo falls back to the box icon**, never to a broken
 *    image glyph — plenty of real products have no featured image, and the row
 *    must still read cleanly.
 *  - **`referrerPolicy="no-referrer"` + `loading="lazy"`** so a long order list
 *    does not fetch dozens of images up front, and the merchant's server does
 *    not see portal URLs in its access log.
 *
 * The photo always sits inside a fixed-size wrapper rather than being sized
 * itself: Tailwind's preflight puts `max-width: 100%` on every `img`, so an
 * `<img class="w-8">` dropped straight into a tight flex row collapses to its
 * border when the row runs out of space. The wrapper owns the box; the image
 * just fills it.
 */
export function ProductThumb({ src, name, size = 'sm', className = '' }: ProductThumbProps) {
  const url = typeof src === 'string' ? src.trim() : '';
  const usable = /^https?:\/\//i.test(url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const px = pixelSize[size];
  const frame = `${sizeClasses[size]} block shrink-0 grow-0 basis-auto overflow-hidden border border-slate-200 bg-slate-50 ${className}`;

  if (!usable || failed) {
    return (
      <span
        className={`${frame} grid place-items-center text-slate-300`}
        style={{ width: px, height: px }}
        aria-hidden="true"
      >
        <Package className={iconClasses[size]} />
      </span>
    );
  }

  return (
    <span className={frame} style={{ width: px, height: px }}>
      <img
        src={url}
        alt={name ? `${name} product photo` : 'Product photo'}
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full max-w-none object-cover"
      />
    </span>
  );
}

export default ProductThumb;
