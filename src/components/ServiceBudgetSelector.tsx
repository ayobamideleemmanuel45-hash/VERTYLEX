import {Check, DollarSign, Info} from 'lucide-react';
import {useId} from 'react';
import {useRegion} from '../context/RegionContext';
import type {ServiceBudgetConfig} from '../data/vertylex';
import {RegionSelector} from './RegionSelector';

interface ServiceBudgetSelectorProps {
  config: ServiceBudgetConfig;
  valueUsd: number;
  onChangeUsd: (nextUsd: number) => void;
  showCurrencySwitcher?: boolean;
}

export function ServiceBudgetSelector({
  config,
  valueUsd,
  onChangeUsd,
  showCurrencySwitcher = true,
}: ServiceBudgetSelectorProps) {
  const groupLabelId = useId();
  const {region, convertQuotationAmount, formatCurrencyAmount} = useRegion();

  const matchingOption = config.options.find((opt) => opt.amountUsd === Math.round(valueUsd));
  const selectedUsd = matchingOption ? matchingOption.amountUsd : config.recommendedUsd;
  const selectedConverted = convertQuotationAmount(selectedUsd, 'USD');

  return (
    <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E4E4E7] pb-4 sm:flex-row sm:items-start">
        <div>
          <div id={groupLabelId} className="flex items-center gap-2 text-xs font-semibold text-[#1D4ED8]">
            <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Intended Project Budget · {config.serviceTitle}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5A5A62]">
            Select one budget option below. Base pricing is in USD and automatically shown in{' '}
            <strong className="font-semibold text-[#141416]">
              {region.currency} ({region.country})
            </strong>
            .
          </p>
        </div>
        {showCurrencySwitcher && (
          <div className="shrink-0">
            <RegionSelector compact />
          </div>
        )}
      </div>

      {/* Multiple-Choice Circular Radio Cards */}
      <div
        role="radiogroup"
        aria-labelledby={groupLabelId}
        className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {config.options.map((option) => {
          const isSelected = selectedUsd === option.amountUsd;
          const converted = convertQuotationAmount(option.amountUsd, 'USD');

          return (
            <button
              key={option.amountUsd}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChangeUsd(option.amountUsd)}
              className={`flex items-start gap-3.5 rounded-lg border p-4 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.05] ring-1 ring-[#1D4ED8]/20'
                  : option.isRecommended
                    ? 'border-[#1D4ED8]/35 bg-white hover:border-[#1D4ED8]'
                    : 'border-[#E4E4E7] bg-white hover:border-[#141416]'
              }`}
            >
              {/* Circular Radio Indicator */}
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
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="font-display text-base font-bold text-[#141416] tabular-nums">
                    {formatCurrencyAmount(option.amountUsd, 'USD')} USD
                  </span>
                  {option.isRecommended && (
                    <span className="text-[11px] font-semibold text-[#1D4ED8]">
                      Recommended
                    </span>
                  )}
                </div>

                {converted.isConverted && (
                  <p className="mt-0.5 font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
                    ≈ {converted.displayFormatted} ({converted.displayCurrency})
                  </p>
                )}

                <p className="mt-1.5 text-xs font-semibold text-[#141416]">{option.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#5A5A62]">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Summary Strip */}
      <div className="mt-4 flex flex-col justify-between gap-2 rounded-md border border-[#E4E4E7] bg-white px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-medium text-[#5A5A62]">Selected Budget Option: </span>
          <span className="font-mono text-sm font-bold text-[#141416] tabular-nums">
            {formatCurrencyAmount(selectedUsd, 'USD')} USD
          </span>
          {selectedConverted.isConverted && (
            <span className="ml-2 font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
              ≈ {selectedConverted.displayFormatted} ({selectedConverted.displayCurrency})
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-[#5A5A62]">
          {region.currency === 'USD'
            ? 'Base currency: USD ($)'
            : selectedConverted.ratesAvailable && selectedConverted.exchangeRate
              ? `Live rate: 1 USD = ${selectedConverted.exchangeRate.toFixed(2)} ${selectedConverted.displayCurrency}`
              : 'Showing authoritative USD budget'}
        </p>
      </div>

      {/* Estimate & Fee Transparency Notice */}
      <div className="mt-3 flex items-start gap-2.5 rounded-md border border-[#E4E4E7] bg-white p-3.5 text-xs leading-relaxed text-[#5A5A62]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
        <p>
          <strong className="font-semibold text-[#141416]">Budget Estimate Only:</strong> Your
          selected amount tells VERTYLEX what you plan to invest—it is not a final bill or upfront
          charge. After reviewing your project brief, our team issues an official USD quotation for
          your approval.
        </p>
      </div>
    </div>
  );
}
