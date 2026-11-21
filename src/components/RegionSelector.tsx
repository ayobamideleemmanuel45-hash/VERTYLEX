import {Check, ChevronDown, Globe} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import {useRegion} from '../context/RegionContext';
import {SUPPORTED_REGIONS} from '../data/vertylex';

interface RegionSelectorProps {
  compact?: boolean;
  showRateMeta?: boolean;
}

export function RegionSelector({compact = false, showRateMeta = false}: RegionSelectorProps) {
  const {region, suggestedRegionCode, setRegionCode, ratesState} = useRegion();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={compact ? 'relative inline-block' : 'relative space-y-1.5'}>
      <label
        id={labelId}
        htmlFor={buttonId}
        className={
          compact
            ? 'sr-only'
            : 'flex items-center gap-1.5 text-xs font-medium text-[#5A5A62]'
        }
      >
        <Globe className="h-3.5 w-3.5 text-[#5A5A62]" aria-hidden="true" />
        Region &amp; Currency
      </label>

      <div className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={compact ? undefined : labelId}
          aria-label={compact ? 'Select region and currency' : undefined}
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex h-9 items-center justify-between gap-2 rounded-md border border-[#E4E4E7] bg-white text-xs font-medium text-[#141416] transition-all duration-150 hover:border-[#A1A1AA] focus:border-[#1D4ED8] focus:outline-none ${
            compact ? 'px-3' : 'w-full px-3'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            {compact && <Globe className="h-3.5 w-3.5 shrink-0 text-[#5A5A62]" aria-hidden="true" />}
            <span className="truncate">
              {region.country} — {region.currency} ({region.symbol})
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#5A5A62] transition-transform duration-150 ${
              open ? 'rotate-180 text-[#1D4ED8]' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <ul
          role="listbox"
          aria-label="Supported regions and currencies"
          aria-hidden={!open}
          className={`absolute z-40 mt-1.5 max-h-64 w-full min-w-[230px] origin-top overflow-y-auto rounded-md border border-[#E4E4E7] bg-white p-1 shadow-lg transition-all duration-150 ease-out ${
            compact ? 'right-0' : 'left-0'
          } ${
            open
              ? 'scale-100 translate-y-0 opacity-100'
              : 'pointer-events-none scale-[0.98] -translate-y-1 opacity-0'
          }`}
        >
          {SUPPORTED_REGIONS.map((item) => {
            const selected = item.code === region.code;
            return (
              <li key={item.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    setRegionCode(item.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-xs transition-colors duration-100 ${
                    selected
                      ? 'bg-[#1D4ED8]/[0.06] font-medium text-[#1D4ED8]'
                      : 'text-[#141416] hover:bg-[#F3F3F5]'
                  }`}
                >
                  <span className="truncate">
                    {item.country} — {item.currency} ({item.symbol})
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {showRateMeta && (
        <p className="text-[11px] leading-relaxed text-[#5A5A62]">
          {suggestedRegionCode === region.code
            ? `Suggested for your region (${region.country}). `
            : ''}
          {ratesState.ratesAvailable
            ? `Live rates via ${ratesState.source}.`
            : 'Live conversion unavailable; quotations display in settlement currency.'}
        </p>
      )}
    </div>
  );
}
