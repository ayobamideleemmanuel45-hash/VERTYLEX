import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  detectBrowserLocationSuggestion,
  findCountryByCode,
  getRegionCodeForCurrency,
} from '../data/countries';
import {SUPPORTED_REGIONS, type RegionOption} from '../data/vertylex';
import {useAuth} from './AuthContext';

interface RatesResponse {
  ratesAvailable: boolean;
  base: string;
  rates: Record<string, number> | null;
  source?: string;
  fetchedAt?: string;
  error?: string;
}

export interface ConvertedPriceResult {
  isConverted: boolean;
  ratesAvailable: boolean;
  displayCurrency: string;
  displayAmount: number;
  displayFormatted: string;
  baseCurrency: string;
  baseAmount: number;
  baseFormatted: string;
  exchangeRate?: number;
  rateSource?: string;
  fetchedAt?: string;
}

interface RegionContextValue {
  region: RegionOption;
  suggestedRegionCode: string | null;
  suggestedCountryCode: string;
  suggestedStateRegion: string;
  setRegionCode: (code: string) => void;
  setCurrencyCode: (currencyCode: string) => void;
  ratesState: RatesResponse;
  formatCurrencyAmount: (amount: number, currencyCode: string) => string;
  convertQuotationAmount: (
    amount: number,
    baseCurrency: string,
    targetCurrency?: string,
  ) => ConvertedPriceResult;
}

const STORAGE_KEY = 'vertylex_selected_region';

const RegionContext = createContext<RegionContextValue | undefined>(undefined);

function detectBrowserRegionCode(): string {
  const suggestion = detectBrowserLocationSuggestion();
  const country = findCountryByCode(suggestion.countryCode);
  return country?.suggestedRegionCode || 'US';
}

const ZERO_DECIMAL_CURRENCIES = new Set(['NGN', 'KES', 'JPY', 'KRW', 'RWF']);

export function formatMoney(amount: number, currencyCode: string): string {
  const upper = currencyCode.toUpperCase();
  const regionMatch = SUPPORTED_REGIONS.find((r) => r.currency === upper);
  const locale = regionMatch?.locale || 'en-US';
  const decimals = ZERO_DECIMAL_CURRENCIES.has(upper) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: upper,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${upper} ${amount.toLocaleString()}`;
  }
}

export function RegionProvider({children}: {children: ReactNode}) {
  const {user} = useAuth();
  const initialBrowserSuggestion = useMemo(() => detectBrowserLocationSuggestion(), []);

  const [regionCode, setRegionCodeState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_REGIONS.some((r) => r.code === saved)) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return detectBrowserRegionCode();
  });

  const [suggestedRegionCode, setSuggestedRegionCode] = useState<string | null>(null);
  const [suggestedCountryCode, setSuggestedCountryCode] = useState<string>(
    initialBrowserSuggestion.countryCode,
  );
  const [suggestedStateRegion] = useState<string>(initialBrowserSuggestion.stateRegion);
  const [ratesState, setRatesState] = useState<RatesResponse>({
    ratesAvailable: false,
    base: 'USD',
    rates: null,
  });

  const syncedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initRegionAndRates() {
      try {
        const [ratesRes, suggestRes] = await Promise.all([
          fetch('/api/rates'),
          fetch('/api/region/suggest'),
        ]);
        if (!cancelled && ratesRes.ok) {
          const rData = (await ratesRes.json()) as RatesResponse;
          setRatesState(rData);
        }
        if (!cancelled && suggestRes.ok) {
          const sData = (await suggestRes.json()) as {
            suggestedCode?: string | null;
            suggestedCountryCode?: string | null;
          };
          const serverSuggestion = sData.suggestedCode || detectBrowserRegionCode();
          setSuggestedRegionCode(serverSuggestion);
          if (sData.suggestedCountryCode && findCountryByCode(sData.suggestedCountryCode)) {
            setSuggestedCountryCode(sData.suggestedCountryCode);
          }
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved && SUPPORTED_REGIONS.some((r) => r.code === serverSuggestion)) {
              setRegionCodeState(serverSuggestion);
            }
          } catch {
            // Ignore storage errors
          }
        }
      } catch {
        // Leave ratesAvailable false rather than fabricating rates
      }
    }
    void initRegionAndRates();
    return () => {
      cancelled = true;
    };
  }, []);

  const setRegionCode = useCallback((code: string) => {
    if (!SUPPORTED_REGIONS.some((r) => r.code === code)) return;
    setRegionCodeState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setCurrencyCode = useCallback(
    (currencyCode: string) => {
      const targetRegionCode = getRegionCodeForCurrency(currencyCode);
      setRegionCode(targetRegionCode);
    },
    [setRegionCode],
  );

  // Sync currency preference whenever an authenticated user signs in or updates account preferences
  useEffect(() => {
    if (!user) {
      syncedSignatureRef.current = null;
      return;
    }
    const targetCurrency =
      user.preferredCurrency || findCountryByCode(user.countryCode)?.suggestedCurrency;
    if (!targetCurrency) return;
    const signature = `${user.id}:${targetCurrency}:${user.countryCode || ''}:${user.stateRegion || ''}`;
    if (syncedSignatureRef.current === signature) {
      return;
    }
    syncedSignatureRef.current = signature;
    setCurrencyCode(targetCurrency);
  }, [user, setCurrencyCode]);

  const region = useMemo(
    () => SUPPORTED_REGIONS.find((r) => r.code === regionCode) || SUPPORTED_REGIONS[1],
    [regionCode],
  );

  const convertQuotationAmount = useCallback(
    (amount: number, baseCurrency: string, targetCurrency?: string): ConvertedPriceResult => {
      const target = (targetCurrency || region.currency).toUpperCase();
      const baseUpper = baseCurrency.toUpperCase();
      const baseFormatted = formatMoney(amount, baseUpper);
      if (baseUpper === target) {
        return {
          isConverted: false,
          ratesAvailable: ratesState.ratesAvailable,
          displayCurrency: baseUpper,
          displayAmount: amount,
          displayFormatted: baseFormatted,
          baseCurrency: baseUpper,
          baseAmount: amount,
          baseFormatted,
          exchangeRate: 1,
          rateSource: ratesState.source,
          fetchedAt: ratesState.fetchedAt,
        };
      }

      if (
        ratesState.ratesAvailable &&
        ratesState.rates &&
        typeof ratesState.rates[baseUpper] === 'number' &&
        typeof ratesState.rates[target] === 'number'
      ) {
        const rate = ratesState.rates[target] / ratesState.rates[baseUpper];
        const converted = amount * rate;
        return {
          isConverted: true,
          ratesAvailable: true,
          displayCurrency: target,
          displayAmount: converted,
          displayFormatted: formatMoney(converted, target),
          baseCurrency: baseUpper,
          baseAmount: amount,
          baseFormatted,
          exchangeRate: rate,
          rateSource: ratesState.source,
          fetchedAt: ratesState.fetchedAt,
        };
      }

      return {
        isConverted: false,
        ratesAvailable: false,
        displayCurrency: baseUpper,
        displayAmount: amount,
        displayFormatted: baseFormatted,
        baseCurrency: baseUpper,
        baseAmount: amount,
        baseFormatted,
      };
    },
    [region.currency, ratesState],
  );

  return (
    <RegionContext.Provider
      value={{
        region,
        suggestedRegionCode,
        suggestedCountryCode,
        suggestedStateRegion,
        setRegionCode,
        setCurrencyCode,
        ratesState,
        formatCurrencyAmount: formatMoney,
        convertQuotationAmount,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion(): RegionContextValue {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error('useRegion must be used inside a RegionProvider');
  }
  return ctx;
}
