/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative ml-1 inline-flex items-center z-10 group">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="btn-touch-expand inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:text-indigo-500 focus:outline-none"
        aria-label="More information"
        aria-describedby={visible ? tooltipId : undefined}
      >
        <HelpCircle className="w-3.5 h-3.5 cursor-pointer shrink-0" />
      </button>
      {visible && (
        <span id={tooltipId} role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 text-white text-xs leading-normal rounded-lg shadow-xl border border-slate-800 text-center animate-fade-in pointer-events-none">
          {content}
          <span aria-hidden="true" className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-800 rotate-45" />
        </span>
      )}
    </span>
  );
}
