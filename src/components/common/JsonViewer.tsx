import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface JsonViewerProps {
  value: unknown;
  search?: string;
  className?: string;
}

const primitiveTone = (value: unknown) => {
  if (value === null) return 'text-slate-400';
  if (typeof value === 'string') return 'text-emerald-300';
  if (typeof value === 'number') return 'text-amber-300';
  if (typeof value === 'boolean') return 'text-violet-300';
  return 'text-slate-300';
};

function PrimitiveValue({ value, search = '' }: { value: unknown; search?: string }) {
  const text = typeof value === 'string' ? `"${value}"` : String(value);
  const needle = search.trim().toLowerCase();
  if (!needle || !text.toLowerCase().includes(needle)) {
    return <span className={primitiveTone(value)}>{text}</span>;
  }

  const start = text.toLowerCase().indexOf(needle);
  return (
    <span className={primitiveTone(value)}>
      {text.slice(0, start)}
      <mark className="rounded bg-amber-300 px-0.5 text-slate-950">{text.slice(start, start + needle.length)}</mark>
      {text.slice(start + needle.length)}
    </span>
  );
}

function JsonNode({ name, value, depth, search }: { name?: string; value: unknown; depth: number; search: string }) {
  const [open, setOpen] = useState(depth < 2);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object';
  const entries = isObject ? Object.entries(value as Record<string, unknown>) : [];
  const label = name === undefined ? '' : `${name}: `;

  if (!isObject) {
    return (
      <div className="leading-5" style={{ paddingLeft: depth * 14 }}>
        {label && <span className="text-sky-300">{label}</span>}
        <PrimitiveValue value={value} search={search} />
      </div>
    );
  }

  const opening = isArray ? '[' : '{';
  const closing = isArray ? ']' : '}';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex w-full items-center text-left leading-5 hover:bg-white/5"
        style={{ paddingLeft: depth * 14 }}
      >
        {open ? <ChevronDown className="mr-1 h-3 w-3 text-slate-500" /> : <ChevronRight className="mr-1 h-3 w-3 text-slate-500" />}
        {label && <span className="text-sky-300">{label}</span>}
        <span className="text-slate-400">{opening}</span>
        {!open && <span className="ml-1 text-slate-500">{entries.length} {isArray ? 'items' : 'keys'} {closing}</span>}
      </button>
      {open && (
        <>
          {entries.map(([key, child]) => (
            <div key={key}>
              <JsonNode name={key} value={child} depth={depth + 1} search={search} />
            </div>
          ))}
          <div className="text-slate-400 leading-5" style={{ paddingLeft: depth * 14 }}>{closing}</div>
        </>
      )}
    </div>
  );
}

export function JsonViewer({ value, search = '', className = '' }: JsonViewerProps) {
  return (
    <div className={`overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs ${className}`}>
      <JsonNode value={value ?? null} depth={0} search={search} />
    </div>
  );
}
