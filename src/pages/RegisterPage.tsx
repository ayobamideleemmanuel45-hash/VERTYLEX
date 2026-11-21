import {Eye, EyeOff, Loader2, Lock} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {Link, Navigate, useNavigate, useSearchParams} from 'react-router-dom';
import {
  CountryRegionPicker,
  type CountryRegionValue,
} from '../components/CountryRegionPicker';
import {useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {COUNTRY_OPTIONS, findCountryByCode} from '../data/countries';

function getSafeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return null;
}

export function RegisterPage() {
  const {user, loading: authLoading, register} = useAuth();
  const {suggestedCountryCode, suggestedStateRegion, setCurrencyCode} = useRegion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get('redirect');
  const reason = searchParams.get('reason');
  const parsedRedirect = getSafeRedirect(rawRedirect);
  const safeRedirect =
    parsedRedirect && parsedRedirect.startsWith('/admin') ? '/account' : parsedRedirect;

  const loginHref = (() => {
    const params = new URLSearchParams();
    if (safeRedirect) params.set('redirect', safeRedirect);
    if (reason) params.set('reason', reason);
    const qs = params.toString();
    return `/login${qs ? `?${qs}` : ''}`;
  })();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const initialCountry = findCountryByCode(suggestedCountryCode) || COUNTRY_OPTIONS[0];
  const [location, setLocation] = useState<CountryRegionValue>({
    countryCode: initialCountry.code,
    countryName: initialCountry.name,
    stateRegion:
      initialCountry.code === suggestedCountryCode ? suggestedStateRegion : '',
    preferredCurrency: initialCountry.suggestedCurrency,
  });
  const [hasManuallyChangedLocation, setHasManuallyChangedLocation] = useState(false);

  useEffect(() => {
    if (hasManuallyChangedLocation) return;
    const detected = findCountryByCode(suggestedCountryCode);
    if (!detected) return;
    setLocation({
      countryCode: detected.code,
      countryName: detected.name,
      stateRegion: suggestedStateRegion || '',
      preferredCurrency: detected.suggestedCurrency,
    });
  }, [suggestedCountryCode, suggestedStateRegion, hasManuallyChangedLocation]);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <div className="bg-[#FAFAFA] py-24">
        <div className="vtx-panel-enter mx-auto flex max-w-md items-center justify-center gap-2.5 px-4 text-sm text-[#5A5A62]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
          <span>Checking your session...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={safeRedirect || '/submit-project'} replace />;
  }

  function handleResetToSuggested() {
    const detected = findCountryByCode(suggestedCountryCode) || COUNTRY_OPTIONS[0];
    setHasManuallyChangedLocation(false);
    setLocation({
      countryCode: detected.code,
      countryName: detected.name,
      stateRegion: detected.code === suggestedCountryCode ? suggestedStateRegion : '',
      preferredCurrency: detected.suggestedCurrency,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!location.countryCode || !location.countryName) {
      setError('Please select your country to create your account.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password, rememberMe, {
        countryCode: location.countryCode,
        countryName: location.countryName,
        stateRegion: location.stateRegion.trim(),
        preferredCurrency: location.preferredCurrency,
      });
      setCurrencyCode(location.preferredCurrency);
      navigate(safeRedirect || '/submit-project', {replace: true});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA] py-16 sm:py-24">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        {(reason === 'project' || safeRedirect) && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-[#E4E4E7] bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
              <p className="text-sm font-medium text-[#141416]">
                Please sign in or create an account to continue with your project.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
          <p className="text-xs font-medium text-[#1D4ED8]">VERTYLEX Client Portal</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#141416]">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-[#5A5A62]">
            Register to access your project workspace, submit ideas, and track your VERTYLEX
            enquiries.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-[#141416]">
                Full name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-[#141416]">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-sm font-medium text-[#141416]"
              >
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 w-full rounded-md border border-[#D4D4D8] pr-10 pl-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#5A5A62] hover:text-[#141416]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[#5A5A62]">Minimum 8 characters.</p>
            </div>

            <div className="border-t border-[#E4E4E7] pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5A5A62]">
                Country, Region &amp; Currency
              </p>
              <CountryRegionPicker
                value={location}
                onChange={(next) => {
                  setHasManuallyChangedLocation(true);
                  setLocation(next);
                }}
                autoSuggested={
                  !hasManuallyChangedLocation && location.countryCode === suggestedCountryCode
                }
                onResetToSuggested={handleResetToSuggested}
              />
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="register-remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#D4D4D8] text-[#1D4ED8] focus:ring-[#1D4ED8]"
              />
              <label
                htmlFor="register-remember-me"
                className="cursor-pointer text-xs leading-relaxed text-[#5A5A62]"
              >
                <span className="block font-medium text-[#141416]">Remember Me</span>
                Keep me signed in on this browser across visits.
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 border-t border-[#E4E4E7] pt-6 text-center text-sm text-[#5A5A62]">
            Already have an account?{' '}
            <Link to={loginHref} className="font-medium text-[#1D4ED8] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
