import {Check, Clock} from 'lucide-react';
import {useId} from 'react';
import {DELIVERY_TIME_OPTIONS} from '../data/vertylex';

interface DeliveryTimeSelectorProps {
  value: string;
  onChange: (nextValue: string) => void;
  error?: string;
  stepPrefix?: string;
}

export function DeliveryTimeSelector({
  value,
  onChange,
  error,
  stepPrefix,
}: DeliveryTimeSelectorProps) {
  const groupLabelId = useId();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
        <span id={groupLabelId} className="text-sm font-semibold text-[#141416]">
          {stepPrefix ? `${stepPrefix} ` : ''}Requested delivery time{' '}
          <span className="text-red-600">*</span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#5A5A62]">
        Choose your preferred timeframe below. This reflects your requested schedule, not a
        guaranteed completion date—our team will review your requirements and confirm whether the
        requested timeframe is achievable.
      </p>

      <div
        role="radiogroup"
        aria-labelledby={groupLabelId}
        aria-required="true"
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {DELIVERY_TIME_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.id)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.05] ring-1 ring-[#1D4ED8]/20'
                  : 'border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#141416] hover:bg-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                    : 'border-[#D4D4D8] bg-white'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-[#141416]">
                    {option.title}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
                    {option.timeframe}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#5A5A62]">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
