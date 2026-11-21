import {Eye, EyeOff, Globe, Headphones, Loader2, Lock} from 'lucide-react';
import {useMemo, useState, type FormEvent} from 'react';
import {Link, Navigate, useNavigate, useSearchParams} from 'react-router-dom';
import {
  CountryRegionPicker,
  type CountryRegionValue,
} from '../components/CountryRegionPicker';
import {getDeviceLocationHint, useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {COUNTRY_OPTIONS, findCountryByCode} from '../data/countries';
import {VERTYLEX_EMAIL} from '../data/vertylex';

function getSafeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return null;
}

export function LoginPage() {
  const {user, isAdmin, loading: authLoading, login} = useAuth();
  const {suggestedCountryCode, suggestedStateRegion} = useRegion();
  const {openAssistant} = useSupport();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get('redirect');
  const reason = searchParams.get('reason');
  const safeRedirect = getSafeRedirect(rawRedirect);

  const registerHref = (() => {
    const params = new URLSearchParams();
    if (safeRedirect) params.set('redirect', safeRedirect);
    if (reason) params.set('reason', reason);
    const qs = params.toString();
    return `/register${qs ? `?${qs}` : ''}`;
  })();

  const rememberedLocation = useMemo(() => getDeviceLocationHint(), []);

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [showLocationOverride, setShowLocationOverride] = useState(false);
  const fallbackCountry =
    findCountryByCode(rememberedLocation?.countryCode || suggestedCountryCode) ||
    COUNTRY_OPTIONS[0];
  const [locationOverride, setLocationOverride] = useState<CountryRegionValue>({
    countryCode: fallbackCountry.code,
    countryName: fallbackCountry.name,
    stateRegion:
      rememberedLocation?.stateRegion ||
      (fallbackCountry.code === suggestedCountryCode ? suggestedStateRegion : ''),
    preferredCurrency:
      rememberedLocation?.preferredCurrency || fallbackCountry.suggestedCurrency,
  });

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
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
    const target =
      safeRedirect && safeRedirect.startsWith('/admin') && (!isAdmin || user.role !== 'admin')
        ? '/account'
        : safeRedirect || (isAdmin && user.role === 'admin' ? '/admin' : '/submit-project');
    return <Navigate to={target} replace />;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const signedInUser = await login(
        email.trim(),
        password,
        rememberMe,
        showLocationOverride
          ? {
              countryCode: locationOverride.countryCode,
              countryName: locationOverride.countryName,
              stateRegion: locationOverride.stateRegion.trim(),
              preferredCurrency: locationOverride.preferredCurrency,
            }
          : null,
      );
      const target =
        safeRedirect && safeRedirect.startsWith('/admin') && signedInUser.role !== 'admin'
          ? '/account'
          : safeRedirect || (signedInUser.role === 'admin' ? '/admin' : '/submit-project');
      navigate(target, {replace: true});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter the email address associated with your account.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email.trim()}),
      });
      const data = (await res.json()) as {message?: string; error?: string};
      if (!res.ok) {
        throw new Error(data.error || 'Unable to process password reset request.');
      }
      setInfoMessage(
        data.message ||
          'If an account exists for that email address, password reset instructions have been sent.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA] py-16 sm:py-24">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        {(reason === 'project' || safeRedirect) && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-[#E4E4E7] bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[#141416]">
                  Please sign in or create an account to continue with your project.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    to={registerHref}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#D4D4D8] bg-[#FAFAFA] px-3.5 text-xs font-medium text-[#141416] hover:border-[#141416]"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
          <p className="text-xs font-medium text-[#1D4ED8]">VERTYLEX Client Portal</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#141416]">
            {mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </h1>
          <p className="mt-2 text-sm text-[#5A5A62]">
            {mode === 'login'
              ? 'Access your personal project workspace, submit ideas, and track your enquiries.'
              : 'Enter your registered email address to request a password reset link.'}
          </p>

          {error && (
            <div
              role="alert"
              className="vtx-panel-enter mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800"
            >
              {error}
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="vtx-panel-enter mt-6 rounded-md border border-[#E4E4E7] bg-[#F3F3F5] px-4 py-3 text-xs leading-relaxed text-[#141416]"
            >
              {infoMessage}
            </div>
          )}

          {mode === 'login' ? (
            <form
              key="login-form"
              onSubmit={handleLogin}
              noValidate
              className="vtx-panel-enter mt-6 space-y-5"
            >
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#141416]">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-[#141416]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setInfoMessage('');
                    }}
                    className="text-xs font-medium text-[#1D4ED8] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-2">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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
              </div>

              {/* Optional Region Summary & Location Update */}
              <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#5A5A62]">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                    {rememberedLocation ? (
                      <span>
                        Saved region:{' '}
                        <strong className="text-[#141416]">
                          {rememberedLocation.countryName}
                          {rememberedLocation.stateRegion
                            ? ` · ${rememberedLocation.stateRegion}`
                            : ''}
                        </strong>
                        {rememberedLocation.preferredCurrency
                          ? ` (${rememberedLocation.preferredCurrency})`
                          : ''}
                      </span>
                    ) : (
                      <span>
                        Your saved account country &amp; region are preserved automatically.
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationOverride((prev) => !prev)}
                    className="text-xs font-medium text-[#1D4ED8] hover:underline"
                  >
                    {showLocationOverride ? 'Keep saved region' : 'Change region'}
                  </button>
                </div>

                {showLocationOverride && (
                  <div className="vtx-panel-enter mt-4 border-t border-[#E4E4E7] pt-4">
                    <p className="mb-3 text-[11px] leading-relaxed text-[#5A5A62]">
                      Moved or signing in from another location? Update the country and region saved
                      on your account upon sign-in.
                    </p>
                    <CountryRegionPicker
                      compact
                      value={locationOverride}
                      onChange={setLocationOverride}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2.5">
                <input
                  id="login-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D4D4D8] text-[#1D4ED8] focus:ring-[#1D4ED8]"
                />
                <label
                  htmlFor="login-remember-me"
                  className="cursor-pointer text-xs leading-relaxed text-[#5A5A62]"
                >
                  <span className="block font-medium text-[#141416]">Remember Me</span>
                  Keep me signed in on this browser across visits. Leave unchecked for a shorter
                  session.
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form
              key="forgot-form"
              onSubmit={handleForgotPassword}
              noValidate
              className="vtx-panel-enter mt-6 space-y-5"
            >
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-[#141416]">
                  Registered email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? 'Sending Reset Request...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfoMessage('');
                }}
                className="inline-flex h-10 w-full items-center justify-center text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
              >
                Return to Sign In
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-[#E4E4E7] pt-6 text-center text-sm text-[#5A5A62]">
            New to VERTYLEX?{' '}
            <Link to={registerHref} className="font-medium text-[#1D4ED8] hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white px-5 py-4 text-xs text-[#5A5A62]">
          <span>Need help accessing your account?</span>
          <button
            type="button"
            onClick={() => openAssistant('I need assistance with my client account.')}
            className="inline-flex items-center gap-1.5 font-medium text-[#141416] hover:text-[#1D4ED8]"
          >
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
            VERTYLEX Assistant
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-[#5A5A62]">
          Official email: {VERTYLEX_EMAIL}
        </p>
      </div>
    </div>
  );
}
