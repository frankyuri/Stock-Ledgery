import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { yahooSearch } from '@/services/yahoo';
import { cn } from '@/lib/cn';
import type { SearchResult } from '@/types/stock';

interface Props {
  value: string;
  onChange: (raw: string) => void;
  onSelect?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function SymbolSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = '輸入代號或公司名（AAPL / 台積電 / 2330）',
  className,
  autoFocus,
  disabled,
}: Props) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => yahooSearch(debounced),
    enabled: debounced.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  const showDropdown = open && debounced.length >= 1 && (isFetching || results.length > 0);

  function commit(r: SearchResult) {
    onChange(r.symbol);
    setQuery(r.symbol);
    setOpen(false);
    onSelect?.(r);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter') {
        const raw = query.trim().toUpperCase();
        if (raw && raw !== value) onChange(raw);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const help = useMemo(() => {
    if (!debounced) return null;
    if (isFetching) return '搜尋中…';
    if (results.length === 0) return `找不到 "${debounced}" 的結果`;
    return null;
  }, [debounced, isFetching, results.length]);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <input
        value={query}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setQuery(v);
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        className="input"
      />

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-auto rounded-xl border border-black/10 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
        >
          {help ? (
            <p className="px-4 py-3 text-sm text-ink-mute">{help}</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.symbol}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(r)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition',
                  i === activeIdx ? 'bg-brand-soft' : 'hover:bg-black/[0.03]',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {r.symbol}
                  </p>
                  <p className="truncate text-xs text-ink-mute">{r.name}</p>
                </div>
                <span className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] text-ink-mute">
                  {r.exchange}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
