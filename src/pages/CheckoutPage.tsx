import {ArrowLeft, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {RegionSelector} from '../components/RegionSelector';
import {useRegion} from '../context/RegionContext';
import {apiFetch} from '../lib/apiClient';
import {useSupport} from '../context/SupportContext';

interface ProjectDetail {
  id: string;
  referenceId: string;
  projectTitle: string;
  selectedService: string;
  status: string;
  progressStage?: string;
  quotation: {
    amountUsd?: number;
    paymentOption?: 'full' | 'deposit';
    depositPercent?: number;
    dueNowUsd?: number;
    amount: number;
    currency: string;
    summary: string;
    deliverables: string[];
    validUntil: string;
    quotedAt: string;
    acceptedAt?: string;
  } | null;
}

interface VerifiedReceipt {
  reference: string;
  provider: string;
  amountUsd?: number;
  amount: number;
  currency: string;
  paymentOption?: 'full' | 'deposit';
  depositPercent?: number;
  status: 'pending' | 'paid' | 'failed';
  channel?: string;
  verifiedAt?: string;
}

export function CheckoutPage() {
  const {projectId} = useParams<{projectId: string}>();
  const [searchParams] = useSearchParams();
  const {convertQuotationAmount, formatCurrencyAmount, ratesState, region} = useRegion();
  const {integrations, openAssistant} = useSupport();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'paystack' | 'flutterwave'>(
    integrations.payments.activeProvider || 'paystack',
  );
  const [checkoutCurrency, setCheckoutCurrency] = useState<string>('USD');
  const [initializing, setInitializing] = useState(false);
  const [receipt, setReceipt] = useState<VerifiedReceipt | null>(null);

  const callbackRef = searchParams.get('reference') || searchParams.get('tx_ref') || '';

  useEffect(() => {
    if (integrations.payments.activeProvider) {
      setSelectedProvider(integrations.payments.activeProvider);
    }
  }, [integrations.payments.activeProvider]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId || '')}`);
        const data = (await res.json()) as {project?: ProjectDetail; error?: string};
        if (!res.ok || !data.project) {
          throw new Error(data.error || 'Unable to load project checkout details.');
        }
        if (!cancelled) {
          setProject(data.project);
        }

        if (callbackRef && !cancelled) {
          const vRes = await apiFetch(
            `/api/payments/verify?reference=${encodeURIComponent(callbackRef)}`,
          );
          const vData = (await vRes.json()) as {payment?: VerifiedReceipt; error?: string};
          if (vRes.ok && vData.payment && !cancelled) {
            setReceipt(vData.payment);
            if (vData.payment.status === 'paid') {
              const refreshed = await apiFetch(
                `/api/projects/${encodeURIComponent(projectId || '')}`,
              );
              if (refreshed.ok) {
                const rData = (await refreshed.json()) as {project?: ProjectDetail};
                if (rData.project && !cancelled) {
                  setProject(rData.project);
                }
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load checkout.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, callbackRef]);

  const providerCurrencies = integrations.payments.providers[selectedProvider].supportedCurrencies;

  // Pick a clean default checkout currency supported by the chosen gateway
  useEffect(() => {
    if (providerCurrencies.includes(region.currency)) {
      setCheckoutCurrency(region.currency);
    } else if (project?.quotation && providerCurrencies.includes(project.quotation.currency)) {
      setCheckoutCurrency(project.quotation.currency);
    } else {
      setCheckoutCurrency('USD');
    }
  }, [selectedProvider, region.currency, project, providerCurrencies]);

  if (loading) {
    return (
      <div className="bg-[#FAFAFA]">
        <ProjectJourneyStepper activeStep={5} />
        <div className="vtx-panel-enter mx-auto flex max-w-4xl items-center gap-2.5 px-4 py-20 text-sm text-[#5A5A62] sm:px-6">
          <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
          <span>Loading checkout details...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-[#FAFAFA]">
        <ProjectJourneyStepper activeStep={5} />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <div className="rounded-lg border border-[#E4E4E7] bg-white p-8">
            <h1 className="font-display text-2xl font-bold text-[#141416]">Checkout unavailable</h1>
            <p className="mt-2 text-sm text-[#5A5A62]">{error || 'Project could not be found.'}</p>
            <Link
              to="/account"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-[#141416] px-4 text-xs font-medium text-white"
            >
              Return to Customer Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const quotation = project.quotation;
  const gatewayConfigured = Boolean(integrations.payments.activeProvider);
  const dueNowUsd = quotation
    ? quotation.dueNowUsd ?? (quotation.currency === 'USD' ? quotation.amount : quotation.amountUsd || quotation.amount)
    : 0;
  const totalUsd = quotation
    ? quotation.amountUsd ?? (quotation.currency === 'USD' ? quotation.amount : dueNowUsd)
    : 0;
  const displayConverted = quotation ? convertQuotationAmount(dueNowUsd, 'USD') : null;
  const settlementConverted = quotation
    ? convertQuotationAmount(dueNowUsd, 'USD', checkoutCurrency)
    : null;

  const isPaid =
    project.status === 'Payment Confirmed' ||
    project.status === 'Paid' ||
    project.status === 'In Progress' ||
    project.status === 'Completed';
  const isCancelled = project.status === 'Cancelled';

  const paymentStatusLabel = isPaid
    ? 'Payment Confirmed'
    : isCancelled
      ? 'Cancelled'
      : quotation
        ? 'Awaiting Payment'
        : 'Quotation Pending';

  async function handleStartPayment() {
    if (!project || !quotation) return;
    setError('');
    setInitializing(true);
    try {
      const res = await apiFetch('/api/payments/initialize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          projectId: project.id,
          provider: selectedProvider,
          checkoutCurrency: settlementConverted?.displayCurrency || 'USD',
        }),
      });
      const data = (await res.json()) as {authorizationUrl?: string; error?: string};
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error || 'Unable to start payment checkout.');
      }
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment checkout.');
      setInitializing(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={5} />

      <div className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Link
            to={`/account?project=${encodeURIComponent(project.id)}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Customer Dashboard
          </Link>

          <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs font-medium text-[#1D4ED8]">
                Step 5 · Secure Checkout · {project.referenceId}
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-[#141416]">
                {project.projectTitle}
              </h1>
              <p className="mt-1 text-sm text-[#5A5A62]">{project.selectedService}</p>
            </div>
            <div className="w-full sm:w-64">
              <RegionSelector showRateMeta />
            </div>
          </div>

          {receipt && receipt.status === 'paid' && (
            <div className="vtx-panel-enter mt-8 rounded-lg border border-emerald-200 bg-white p-8">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold">
                  Payment Receipt Verified · {receipt.reference}
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#141416]">
                Thank you. Your project payment has been confirmed.
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-[#5A5A62]">Amount Paid</dt>
                  <dd className="mt-1 font-mono font-semibold text-[#141416] tabular-nums">
                    {formatCurrencyAmount(receipt.amount, receipt.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#5A5A62]">Provider &amp; Channel</dt>
                  <dd className="mt-1 capitalize font-medium text-[#141416]">
                    {receipt.provider}
                    {receipt.channel ? ` (${receipt.channel})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#5A5A62]">Confirmed Timestamp</dt>
                  <dd className="mt-1 font-mono text-[#141416]">
                    {receipt.verifiedAt ? new Date(receipt.verifiedAt).toLocaleString() : 'Verified'}
                  </dd>
                </div>
              </dl>
              <Link
                to={`/account?project=${encodeURIComponent(project.id)}`}
                className="mt-6 inline-flex h-10 items-center rounded-md bg-[#141416] px-5 text-xs font-medium text-white hover:bg-[#1D4ED8]"
              >
                Open Customer Dashboard
              </Link>
            </div>
          )}

          {!quotation ? (
            <div className="mt-8 rounded-lg border border-[#E4E4E7] bg-white p-8">
              <h2 className="font-display text-xl font-semibold text-[#141416]">
                Quotation Pending Review
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                The VERTYLEX team reviews your submitted requirements before issuing a USD-based
                quotation. Once your quotation is ready and approved, checkout will unlock here.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
                  <h2 className="font-display text-lg font-semibold text-[#141416]">
                    Project &amp; USD Quotation Breakdown
                  </h2>

                  <dl className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[#5A5A62]">Project Reference</dt>
                      <dd className="mt-1 font-mono font-medium text-[#141416]">
                        {project.referenceId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">Selected Service</dt>
                      <dd className="mt-1 font-medium text-[#141416]">
                        {project.selectedService}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">Total Quotation (Base USD)</dt>
                      <dd className="mt-1 font-mono font-semibold text-[#141416] tabular-nums">
                        {formatCurrencyAmount(totalUsd, 'USD')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">Payment Option</dt>
                      <dd className="mt-1 font-semibold text-[#1D4ED8]">
                        {quotation.paymentOption === 'deposit'
                          ? `Deposit (${quotation.depositPercent ?? 50}% due now: ${formatCurrencyAmount(dueNowUsd, 'USD')})`
                          : `Full Payment (${formatCurrencyAmount(dueNowUsd, 'USD')})`}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 text-sm leading-relaxed text-[#5A5A62]">{quotation.summary}</p>
                  {quotation.deliverables.length > 0 && (
                    <ul className="mt-5 space-y-2 border-t border-[#E4E4E7] pt-4 text-sm text-[#5A5A62]">
                      {quotation.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#1D4ED8]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                    <h2 className="font-display text-lg font-semibold text-[#141416]">
                      PCI-Compliant Hosted Checkout
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-[#5A5A62]">
                    All online payments run strictly through verified Paystack or Flutterwave
                    hosted checkout sessions with instant payment verification. Card details are
                    never entered or stored on VERTYLEX servers.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(['paystack', 'flutterwave'] as const).map((key) => {
                      const provider = integrations.payments.providers[key];
                      const active = selectedProvider === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!provider.configured}
                          onClick={() => setSelectedProvider(key)}
                          className={`rounded-lg border p-4 text-left transition-colors ${
                            active && provider.configured
                              ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.03]'
                              : 'border-[#E4E4E7] bg-[#FAFAFA]'
                          } ${!provider.configured ? 'cursor-not-allowed opacity-65' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-display text-sm font-semibold text-[#141416]">
                              {provider.name}
                            </span>
                            <span className="text-[11px] font-medium text-[#5A5A62]">
                              {provider.configured ? 'Active' : 'Not configured'}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-[#5A5A62]">
                            Supported: {provider.supportedCurrencies.join(', ')}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="lg:col-span-5">
                <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
                  <h2 className="font-display text-lg font-semibold text-[#141416]">
                    Payment Summary
                  </h2>

                  <dl className="mt-5 space-y-4 border-b border-[#E4E4E7] pb-5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-xs text-[#5A5A62]">Authoritative Due (USD)</dt>
                      <dd className="font-mono text-sm font-semibold text-[#141416] tabular-nums">
                        {formatCurrencyAmount(dueNowUsd, 'USD')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-xs text-[#5A5A62]">Payment Status</dt>
                      <dd className="text-xs font-semibold text-[#1D4ED8]">{paymentStatusLabel}</dd>
                    </div>

                    <div>
                      <dt className="text-xs text-[#5A5A62]">
                        Local Display Estimate ({region.currency})
                      </dt>
                      <dd className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                        {displayConverted?.displayFormatted}
                      </dd>
                      {displayConverted?.isConverted && displayConverted.exchangeRate && (
                        <p className="mt-1 font-mono text-[11px] text-[#5A5A62] tabular-nums">
                          Live rate: 1 USD = {displayConverted.exchangeRate.toFixed(2)}{' '}
                          {displayConverted.displayCurrency}
                          {ratesState.source ? ` · ${ratesState.source}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="checkout-currency"
                          className="text-xs font-medium text-[#141416]"
                        >
                          Gateway Settlement Currency
                        </label>
                        <select
                          id="checkout-currency"
                          value={checkoutCurrency}
                          onChange={(e) => setCheckoutCurrency(e.target.value)}
                          className="h-8 rounded border border-[#D4D4D8] bg-white px-2 font-mono text-xs"
                        >
                          {providerCurrencies.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <dd className="mt-2 font-mono text-base font-semibold text-[#1D4ED8] tabular-nums">
                        {settlementConverted?.displayFormatted} ({settlementConverted?.displayCurrency})
                      </dd>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[#5A5A62]">
                        Final settlement total is recalculated server-side from live USD rates when
                        initializing checkout. Gateway processing fees are shown clearly on the
                        hosted checkout screen before authorization.
                      </p>
                    </div>
                  </dl>

                  {error && (
                    <div
                      role="alert"
                      className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  {isPaid ? (
                    <div className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      This quotation payment has already been confirmed.
                    </div>
                  ) : isCancelled ? (
                    <p className="mt-6 text-xs text-red-700">
                      This project was cancelled and is closed for payment.
                    </p>
                  ) : gatewayConfigured ? (
                    <button
                      type="button"
                      disabled={initializing}
                      onClick={() => void handleStartPayment()}
                      className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                    >
                      {initializing ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Lock className="h-4 w-4" aria-hidden="true" />
                      )}
                      {initializing
                        ? 'Redirecting to Hosted Checkout...'
                        : `Pay ${settlementConverted?.displayFormatted} via ${
                            selectedProvider === 'flutterwave' ? 'Flutterwave' : 'Paystack'
                          }`}
                    </button>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                        <p className="text-xs font-semibold text-[#141416]">
                          Payment Gateway Keys Required
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#5A5A62]">
                          Online hosted checkout activates automatically once Paystack or
                          Flutterwave secret keys are configured on the server.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openAssistant(
                            `I would like payment instructions for project ${project.referenceId} (${project.projectTitle}).`,
                          )
                        }
                        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                      >
                        Contact VERTYLEX Support for Payment Instructions
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
