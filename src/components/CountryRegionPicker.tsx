import {Globe, MapPin} from 'lucide-react';
import {useId, useState} from 'react';
import {
  CONTINENT_ORDER,
  COUNTRY_OPTIONS,
  findCountryByCode,
  SUPPORTED_CURRENCIES,
} from '../data/countries';

export interface CountryRegionValue {
  countryCode: string;
  countryName: string;
  stateRegion: string;
  preferredCurrency: string;
}

interface CountryRegionPickerProps {
  value: CountryRegionValue;
  onChange: (next: CountryRegionValue) => void;
  autoSuggested?: boolean;
  onResetToSuggested?: () => void;
  showCurrencySelector?: boolean;
  compact?: boolean;
  requireStateRegion?: boolean;
}

const OTHER_REGION_VALUE = '__OTHER__';

export function CountryRegionPicker({
  value,
  onChange,
  autoSuggested = false,
  onResetToSuggested,
  showCurrencySelector = true,
  compact = false,
  requireStateRegion = false,
}: CountryRegionPickerProps) {
  const countryId = useId();
  const stateSelectId = useId();
  const stateInputId = useId();
  const currencyId = useId();

  const selectedCountry = findCountryByCode(value.countryCode) || COUNTRY_OPTIONS[0];
  const hasPresetRegions = selectedCountry.regions.length > 0;
  const isCustomRegionValue =
    Boolean(value.stateRegion) && !selectedCountry.regions.includes(value.stateRegion);

  const [manualStateMode, setManualStateMode] = useState(isCustomRegionValue);
  const [currencyManuallyChosen, setCurrencyManuallyChosen] = useState(false);

  const showManualInput = !hasPresetRegions || manualStateMode || isCustomRegionValue;

  function handleCountryChange(nextCode: string) {
    const nextCountry = findCountryByCode(nextCode);
    if (!nextCountry) return;

    const nextCurrency = currencyManuallyChosen
      ? value.preferredCurrency
      : nextCountry.suggestedCurrency;

    setManualStateMode(false);
    onChange({
      countryCode: nextCountry.code,
      countryName: nextCountry.name,
      stateRegion: '',
      preferredCurrency: nextCurrency,
    });
  }

  function handlePresetStateChange(selectedVal: string) {
    if (selectedVal === OTHER_REGION_VALUE) {
      setManualStateMode(true);
      onChange({
        ...value,
        stateRegion: '',
      });
      return;
    }
    setManualStateMode(false);
    onChange({
      ...value,
      stateRegion: selectedVal,
    });
  }

  const inputHeight = compact ? 'h-10' : 'h-11';

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={countryId}
            className="flex items-center gap-1.5 text-sm font-medium text-[#141416]"
          >
            <Globe className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
            Country
          </label>
          {autoSuggested ? (
            <span className="text-[11px] font-medium text-[#1D4ED8]">
              Suggested from your location
            </span>
          ) : (
            onResetToSuggested && (
              <button
                type="button"
                onClick={() => {
                  setCurrencyManuallyChosen(false);
                  setManualStateMode(false);
                  onResetToSuggested();
                }}
                className="text-[11px] font-medium text-[#1D4ED8] hover:underline"
              >
                Use detected location
              </button>
            )
          )}
        </div>

        <select
          id={countryId}
          value={selectedCountry.code}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={`mt-2 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none ${inputHeight}`}
        >
          {CONTINENT_ORDER.map((continent) => {
            const countriesInContinent = COUNTRY_OPTIONS.filter(
              (item) => item.continent === continent,
            );
            return (
              <optgroup key={continent} label={continent}>
                {countriesInContinent.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={showManualInput ? stateInputId : stateSelectId}
            className="flex items-center gap-1.5 text-sm font-medium text-[#141416]"
          >
            <MapPin className="h-3.5 w-3.5 text-[#5A5A62]" aria-hidden="true" />
            {selectedCountry.regionLabel}{' '}
            <span className="text-xs font-normal text-[#5A5A62]">
              {requireStateRegion ? '(Required)' : '(Optional)'}
            </span>
          </label>
          {hasPresetRegions && showManualInput && (
            <button
              type="button"
              onClick={() => {
                setManualStateMode(false);
                onChange({...value, stateRegion: ''});
              }}
              className="text-[11px] font-medium text-[#1D4ED8] hover:underline"
            >
              Choose from list
            </button>
          )}
        </div>

        {showManualInput ? (
          <input
            id={stateInputId}
            type="text"
            value={value.stateRegion}
            onChange={(e) => onChange({...value, stateRegion: e.target.value})}
            placeholder={`Enter your ${selectedCountry.regionLabel.toLowerCase()} or city`}
            className={`mt-2 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none ${inputHeight}`}
          />
        ) : (
          <select
            id={stateSelectId}
            value={value.stateRegion}
            onChange={(e) => handlePresetStateChange(e.target.value)}
            className={`mt-2 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none ${inputHeight}`}
          >
            <option value="">
              Select {selectedCountry.regionLabel.toLowerCase()} (optional)
            </option>
            {selectedCountry.regions.map((regionName) => (
              <option key={regionName} value={regionName}>
                {regionName}
              </option>
            ))}
            <option value={OTHER_REGION_VALUE}>Other / Enter manually...</option>
          </select>
        )}
      </div>

      {showCurrencySelector && (
        <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={currencyId} className="text-xs font-semibold text-[#141416]">
              Preferred Display Currency
            </label>
            <span className="text-[11px] text-[#5A5A62]">
              Suggested for {selectedCountry.name}:{' '}
              <strong className="text-[#141416]">{selectedCountry.suggestedCurrency}</strong>
            </span>
          </div>
          <select
            id={currencyId}
            value={value.preferredCurrency}
            onChange={(e) => {
              setCurrencyManuallyChosen(true);
              onChange({...value, preferredCurrency: e.target.value});
            }}
            className="mt-2 h-10 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-xs font-medium text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
          >
            {SUPPORTED_CURRENCIES.map((cur) => (
              <option key={cur.code} value={cur.code}>
                {cur.code} ({cur.symbol}) — {cur.name}
                {cur.code === selectedCountry.suggestedCurrency ? ' · Suggested' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#5A5A62]">
            Country/region sets your account location. Display currency converts project estimates
            and quotations independently.
          </p>
        </div>
      )}
    </div>
  );
}
