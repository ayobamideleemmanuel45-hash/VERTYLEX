import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Globe,
  Headphones,
  Loader2,
  LogOut,
  MessageSquare,
  Receipt,
  ShieldCheck,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {
  CountryRegionPicker,
  type CountryRegionValue,
} from '../components/CountryRegionPicker';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {RegionSelector} from '../components/RegionSelector';
import {useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {COUNTRY_OPTIONS, findCountryByCode} from '../data/countries';
import {getProgressStepIndex, PROJECT_PROGRESS_MILESTONES} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

interface ProjectQuotation {
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
  declinedAt?: string;
  declineReason?: string;
}

interface ProjectAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface ProjectUpdateMessage {
  id: string;
  senderRole: 'admin' | 'customer';
  senderName: string;
  senderEmail: string;
  message: string;
  requiresAction?: boolean;
  createdAt: string;
}

interface ProjectRecord {
  id: string;
  referenceId: string;
  fullName: string;
  email: string;
  projectTitle: string;
  selectedService: string;
  businessName: string;
  ideaDescription: string;
  budgetRange: string;
  budgetUsd?: number;
  recommendedBudgetUsd?: number;
  budgetDisplayCurrency?: string;
  budgetEstimatedLocalAmount?: number;
  preferredCurrency?: string;
  deliveryTime?: string;
  deliveryTimeStatus?: 'Pending Review' | 'Achievable as Requested' | 'Adjusted by Administrator';
  confirmedDeliveryTime?: string;
  additionalRequirements?: string;
  attachments?: ProjectAttachment[];
  updates?: ProjectUpdateMessage[];
  progressStage?: string;
  status: string;
  quotation: ProjectQuotation | null;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  reference: string;
  projectId: string;
  projectReferenceId: string;
  projectTitle: string;
  provider: string;
  amountUsd?: number;
  amount: number;
  currency: string;
  paymentOption?: 'full' | 'deposit';
  depositPercent?: number;
  channel?: string;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
  verifiedAt?: string;
}

function getPaymentStatusLabel(project: ProjectRecord): string {
  switch (project.status) {
    case 'Payment Confirmed':
    case 'Paid':
    case 'In Progress':
    case 'Completed':
      return 'Payment Confirmed';
    case 'Cancelled':
      return 'Cancelled';
    case 'Awaiting Payment':
    case 'Quotation Accepted':
      return 'Awaiting Payment';
    case 'Quotation Sent':
    case 'Awaiting Customer Approval':
    case 'Quotation Ready':
      return 'Pending Quotation Approval';
    default:
      return project.quotation ? 'Pending Quotation Approval' : 'Not Due Yet';
  }
}

function isProjectPaid(status: string): boolean {
  return (
    status === 'Payment Confirmed' ||
    status === 'Paid' ||
    status === 'In Progress' ||
    status === 'Completed'
  );
}

export function AccountPage() {
  const {user, isAdmin, session, loading, logout, updatePreferences} = useAuth();
  const {
    convertQuotationAmount,
    formatCurrencyAmount,
    region,
    setCurrencyCode,
    suggestedCountryCode,
    suggestedStateRegion,
  } = useRegion();
  const {openAssistant} = useSupport();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusProjectId = searchParams.get('project') || '';

  const [activeTab, setActiveTab] = useState<'projects' | 'payments' | 'preferences'>('projects');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Per-project interactive inline states
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [declineOpenId, setDeclineOpenId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  // Account region & currency preferences state
  const [prefsValue, setPrefsValue] = useState<CountryRegionValue>(() => {
    const fallbackCountry =
      findCountryByCode(user?.countryCode || suggestedCountryCode) || COUNTRY_OPTIONS[0];
    return {
      countryCode: user?.countryCode || fallbackCountry.code,
      countryName: user?.countryName || fallbackCountry.name,
      stateRegion:
        user?.stateRegion ||
        (fallbackCountry.code === suggestedCountryCode ? suggestedStateRegion : ''),
      preferredCurrency: user?.preferredCurrency || region.currency,
    };
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    const matched =
      findCountryByCode(user.countryCode || suggestedCountryCode) || COUNTRY_OPTIONS[0];
    setPrefsValue({
      countryCode: user.countryCode || matched.code,
      countryName: user.countryName || matched.name,
      stateRegion: user.stateRegion || '',
      preferredCurrency: user.preferredCurrency || region.currency,
    });
  }, [user, suggestedCountryCode, region.currency]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError('');
    try {
      const [projRes, payRes] = await Promise.all([
        apiFetch('/api/projects'),
        apiFetch('/api/payments/history'),
      ]);
      if (projRes.ok) {
        const pData = (await projRes.json()) as {projects: ProjectRecord[]};
        setProjects(pData.projects || []);
      }
      if (payRes.ok) {
        const payData = (await payRes.json()) as {payments: PaymentRecord[]};
        setPayments(payData.payments || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!focusProjectId || projects.length === 0) return;
    setActiveTab('projects');
    const el = document.getElementById(`project-card-${focusProjectId}`);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  }, [focusProjectId, projects]);

  async function handleDownloadAttachment(projectId: string, att: ProjectAttachment) {
    setError('');
    try {
      const res = await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(att.id)}`,
      );
      if (!res.ok) {
        throw new Error('Unable to download file.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download attachment.');
    }
  }

  async function handleAcceptQuotation(projectId: string) {
    setActionBusyId(projectId);
    setError('');
    setStatusMessage('');
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/accept-quote`, {
        method: 'POST',
      });
      const data = (await res.json()) as {project?: ProjectRecord; error?: string};
      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to accept quotation.');
      }
      await loadDashboardData();
      navigate(`/checkout/${encodeURIComponent(projectId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept quotation.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDeclineQuotation(projectId: string) {
    setActionBusyId(projectId);
    setError('');
    setStatusMessage('');
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/decline-quote`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reason: declineReason.trim()}),
      });
      const data = (await res.json()) as {project?: ProjectRecord; error?: string};
      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to decline quotation.');
      }
      setDeclineOpenId(null);
      setDeclineReason('');
      setStatusMessage(
        'Your feedback has been sent to VERTYLEX. Our team will review and revise if needed.',
      );
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decline quotation.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelProject(projectId: string) {
    setActionBusyId(projectId);
    setError('');
    setStatusMessage('');
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/cancel`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reason: cancelReason.trim()}),
      });
      const data = (await res.json()) as {project?: ProjectRecord; error?: string};
      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to cancel project.');
      }
      setCancelOpenId(null);
      setCancelReason('');
      setStatusMessage('Project request cancelled.');
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel project.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleSendProjectReply(e: FormEvent, projectId: string) {
    e.preventDefault();
    const message = (replyTexts[projectId] || '').trim();
    if (message.length < 2) return;
    setActionBusyId(projectId);
    setError('');
    setStatusMessage('');
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/updates`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message}),
      });
      const data = (await res.json()) as {project?: ProjectRecord; error?: string};
      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to send project update.');
      }
      setReplyTexts((prev) => ({...prev, [projectId]: ''}));
      setStatusMessage('Your update has been sent to VERTYLEX.');
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send update.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleSavePreferences(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPrefsSuccess('');
    setPrefsSaving(true);
    try {
      const updated = await updatePreferences({
        countryCode: prefsValue.countryCode,
        countryName: prefsValue.countryName,
        stateRegion: prefsValue.stateRegion.trim(),
        preferredCurrency: prefsValue.preferredCurrency,
      });
      if (updated.preferredCurrency) {
        setCurrencyCode(updated.preferredCurrency);
      }
      setPrefsSuccess('Your country, region, and currency preferences have been saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save account preferences.');
    } finally {
      setPrefsSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="vtx-panel-enter mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-20 text-sm text-[#5A5A62] sm:px-6">
        <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
        <span>Loading your customer dashboard...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={6} />

      <div className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Top Workspace Card */}
          <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <p className="text-xs font-medium text-[#1D4ED8]">
                  Step 6 · Customer Dashboard
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold text-[#141416]">
                  {user.name}
                </h1>
                <p className="mt-1 text-sm text-[#5A5A62]">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A5A62]">
                  {user.countryName ? (
                    <span className="inline-flex items-center gap-1.5 text-[#141416]">
                      <Globe className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      <span>
                        {user.countryName}
                        {user.stateRegion ? ` · ${user.stateRegion}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPrefsSuccess('');
                          setActiveTab('preferences');
                        }}
                        className="ml-1 font-medium text-[#1D4ED8] hover:underline"
                      >
                        Update
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPrefsSuccess('');
                        setActiveTab('preferences');
                      }}
                      className="inline-flex items-center gap-1.5 font-medium text-[#1D4ED8] hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                      Set country &amp; region preferences
                    </button>
                  )}
                  {session && (
                    <>
                      <span className="text-[#D4D4D8]" aria-hidden="true">
                        |
                      </span>
                      <span>
                        {session.rememberMe
                          ? 'Persistent session active (Remember Me enabled)'
                          : 'Standard browser session active'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <RegionSelector compact />
                {isAdmin && user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1D4ED8]/30 bg-[#1D4ED8]/[0.06] px-3.5 text-xs font-medium text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white whitespace-nowrap"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Private Admin Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => openAssistant()}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-3.5 text-xs font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap"
                >
                  <Headphones className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                  Customer Support
                </button>
                <Link
                  to="/submit-project"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Start New Project
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-3.5 text-xs font-medium text-[#5A5A62] hover:border-[#141416] hover:text-[#141416] whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Dashboard Tabs */}
            <div
              role="tablist"
              aria-label="Customer dashboard sections"
              className="mt-8 flex flex-wrap items-center gap-1 border-t border-[#E4E4E7] pt-5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'projects'}
                onClick={() => setActiveTab('projects')}
                className={`h-9 rounded-md px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'projects'
                    ? 'bg-[#141416] text-white'
                    : 'bg-[#F3F3F5] text-[#5A5A62] hover:text-[#141416]'
                }`}
              >
                Submitted Projects &amp; Progress ({projects.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'payments'}
                onClick={() => setActiveTab('payments')}
                className={`h-9 rounded-md px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'payments'
                    ? 'bg-[#141416] text-white'
                    : 'bg-[#F3F3F5] text-[#5A5A62] hover:text-[#141416]'
                }`}
              >
                Payment History &amp; Receipts ({payments.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'preferences'}
                onClick={() => {
                  setPrefsSuccess('');
                  setActiveTab('preferences');
                }}
                className={`h-9 rounded-md px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'preferences'
                    ? 'bg-[#141416] text-white'
                    : 'bg-[#F3F3F5] text-[#5A5A62] hover:text-[#141416]'
                }`}
              >
                Account Preferences
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {statusMessage && (
            <div
              role="status"
              className="vtx-panel-enter mt-6 flex items-center gap-2 rounded-md border border-[#1D4ED8]/30 bg-white px-4 py-3 text-sm font-medium text-[#141416]"
            >
              <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Projects & Quotations View */}
          {activeTab === 'projects' && (
            <div key="tab-projects" className="vtx-panel-enter mt-8">
              {dataLoading ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-[#E4E4E7] bg-white p-8 text-sm text-[#5A5A62]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                  <span>Loading your submitted projects...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-lg border border-[#E4E4E7] bg-white p-10 text-center">
                  <h2 className="font-display text-lg font-semibold text-[#141416]">
                    No project briefs submitted yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#5A5A62]">
                    Select a service and submit your project requirements first—no upfront payment
                    required. VERTYLEX will review your brief and publish your quotation here.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link
                      to="/submit-project"
                      className="inline-flex h-10 items-center rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
                    >
                      Select Your Service
                    </Link>
                    <Link
                      to="/services/website-development#build-website"
                      className="inline-flex h-10 items-center rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
                    >
                      Build My Website
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {projects.map((project) => {
                    const paid = isProjectPaid(project.status);
                    const cancelled = project.status === 'Cancelled';
                    const stepIndex = getProgressStepIndex(project.status, project.progressStage);
                    const paymentLabel = getPaymentStatusLabel(project);
                    const dueNowUsd = project.quotation
                      ? project.quotation.dueNowUsd ??
                        (project.quotation.currency === 'USD'
                          ? project.quotation.amount
                          : project.quotation.amountUsd || project.quotation.amount)
                      : 0;
                    const totalUsd = project.quotation
                      ? project.quotation.amountUsd ??
                        (project.quotation.currency === 'USD'
                          ? project.quotation.amount
                          : dueNowUsd)
                      : 0;
                    const dueConversion = project.quotation
                      ? convertQuotationAmount(dueNowUsd, 'USD')
                      : null;
                    const totalConversion = project.quotation
                      ? convertQuotationAmount(totalUsd, 'USD')
                      : null;
                    const isFocused = focusProjectId === project.id;

                    return (
                      <article
                        key={project.id}
                        id={`project-card-${project.id}`}
                        className={`rounded-lg border bg-white p-6 sm:p-8 ${
                          isFocused ? 'border-[#1D4ED8]' : 'border-[#E4E4E7]'
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#E4E4E7] pb-4">
                          <div>
                            <span className="font-mono text-xs text-[#1D4ED8]">
                              {project.referenceId}
                            </span>
                            <span className="mx-2 text-xs text-[#A1A1AA]" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-medium text-[#141416]">
                              {project.selectedService}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            <span className="text-[#5A5A62]">
                              Status:{' '}
                              <strong
                                className={
                                  cancelled
                                    ? 'text-red-700'
                                    : project.status === 'More Information Required'
                                      ? 'text-amber-700'
                                      : 'text-[#141416]'
                                }
                              >
                                {project.status}
                              </strong>
                            </span>
                            <span className="text-[#A1A1AA]" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[#5A5A62]">
                              Payment: <strong className="text-[#1D4ED8]">{paymentLabel}</strong>
                            </span>
                          </div>
                        </div>

                        {project.status === 'More Information Required' && (
                          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <div>
                              <p className="font-semibold">
                                VERTYLEX requested additional details to prepare your quotation
                              </p>
                              <p className="mt-0.5">
                                Please check the project messages below and reply with the requested
                                information.
                              </p>
                            </div>
                          </div>
                        )}

                        <h2 className="mt-4 font-display text-xl font-bold text-[#141416]">
                          {project.projectTitle}
                        </h2>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#5A5A62]">
                          {project.ideaDescription}
                        </p>

                        {typeof project.budgetUsd === 'number' && (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-xs">
                            <div>
                              <span className="font-medium text-[#5A5A62]">
                                Customer Intended Budget Estimate:{' '}
                              </span>
                              <span className="font-mono font-bold text-[#141416] tabular-nums">
                                {formatCurrencyAmount(project.budgetUsd, 'USD')} USD
                              </span>
                              {convertQuotationAmount(project.budgetUsd, 'USD').isConverted && (
                                <span className="ml-2 font-mono text-[#1D4ED8] tabular-nums">
                                  (≈ {convertQuotationAmount(project.budgetUsd, 'USD').displayFormatted}{' '}
                                  in {region.currency})
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#5A5A62]">
                              Estimate only · Official quotation issued after review
                            </span>
                          </div>
                        )}

                        {project.deliveryTime && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-xs">
                            <div>
                              <span className="font-medium text-[#5A5A62]">
                                Requested Delivery Time:{' '}
                              </span>
                              <span className="font-semibold text-[#141416]">
                                {project.deliveryTime}
                              </span>
                              {project.confirmedDeliveryTime &&
                                project.deliveryTimeStatus === 'Adjusted by Administrator' && (
                                  <span className="ml-2 font-medium text-[#1D4ED8]">
                                    · Confirmed schedule: {project.confirmedDeliveryTime}
                                  </span>
                                )}
                            </div>
                            <span
                              className={`text-[11px] font-medium ${
                                project.deliveryTimeStatus === 'Achievable as Requested'
                                  ? 'text-emerald-700'
                                  : project.deliveryTimeStatus === 'Adjusted by Administrator'
                                    ? 'text-[#1D4ED8]'
                                    : 'text-[#5A5A62]'
                              }`}
                            >
                              {project.deliveryTimeStatus === 'Achievable as Requested'
                                ? 'Confirmed achievable by VERTYLEX'
                                : project.deliveryTimeStatus === 'Adjusted by Administrator'
                                  ? 'Schedule updated by administrator'
                                  : 'Requested timeframe · Awaiting administrator review'}
                            </span>
                          </div>
                        )}

                        {/* Attached Files */}
                        {project.attachments && project.attachments.length > 0 && (
                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E4E4E7] pt-4">
                            <span className="text-xs font-medium text-[#5A5A62]">
                              Attachments:
                            </span>
                            {project.attachments.map((att) => (
                              <button
                                key={att.id}
                                type="button"
                                onClick={() => void handleDownloadAttachment(project.id, att)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-1.5 text-xs font-medium text-[#141416] hover:border-[#141416]"
                              >
                                <Download className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                                {att.originalName}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Project Progress Milestones */}
                        {!cancelled && (
                          <div className="mt-6 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[#141416]">
                                Project Progress
                              </p>
                              <p className="text-xs font-medium text-[#1D4ED8]">
                                {project.status}
                              </p>
                            </div>
                            <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                              {PROJECT_PROGRESS_MILESTONES.map((label, idx) => {
                                const done = idx <= stepIndex;
                                const active = idx === stepIndex;
                                return (
                                  <li
                                    key={label}
                                    className={`flex items-center gap-2 rounded border px-2.5 py-2 text-[11px] ${
                                      active
                                        ? 'border-[#1D4ED8] bg-white font-semibold text-[#141416]'
                                        : done
                                          ? 'border-[#E4E4E7] bg-white text-[#141416]'
                                          : 'border-[#E4E4E7] bg-transparent text-[#5A5A62] opacity-65'
                                    }`}
                                  >
                                    <span
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                        done
                                          ? 'bg-[#1D4ED8] text-white'
                                          : 'border border-[#D4D4D8] bg-white text-transparent'
                                      }`}
                                    >
                                      <Check className="h-2.5 w-2.5" aria-hidden="true" />
                                    </span>
                                    <span className="truncate">{label}</span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}

                        {/* Quotation Block */}
                        {project.quotation && dueConversion && totalConversion ? (
                          <div className="mt-6 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-5">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                              <div>
                                <p className="text-xs font-semibold text-[#1D4ED8]">
                                  VERTYLEX Official Quotation
                                </p>
                                <p className="mt-1 text-sm text-[#141416]">
                                  {project.quotation.summary}
                                </p>
                                {project.quotation.deliverables.length > 0 && (
                                  <ul className="mt-3 space-y-1 text-xs text-[#5A5A62]">
                                    {project.quotation.deliverables.map((d) => (
                                      <li key={d}>• {d}</li>
                                    ))}
                                  </ul>
                                )}
                                <p className="mt-3 font-mono text-[11px] text-[#5A5A62]">
                                  Valid until {project.quotation.validUntil} ·{' '}
                                  {project.quotation.paymentOption === 'deposit'
                                    ? `Deposit required (${project.quotation.depositPercent ?? 50}% of ${formatCurrencyAmount(totalUsd, 'USD')})`
                                    : 'Full payment (100%)'}
                                </p>
                              </div>

                              <div className="shrink-0 sm:text-right">
                                <p className="text-xs text-[#5A5A62]">
                                  Amount Due ({region.currency})
                                </p>
                                <p className="mt-0.5 font-display text-2xl font-bold text-[#141416] tabular-nums">
                                  {dueConversion.displayFormatted}
                                </p>
                                <p className="mt-1 font-mono text-xs text-[#5A5A62] tabular-nums">
                                  Base Quote: {formatCurrencyAmount(dueNowUsd, 'USD')} USD
                                  {project.quotation.paymentOption === 'deposit' &&
                                    ` / ${formatCurrencyAmount(totalUsd, 'USD')} total`}
                                </p>
                                {dueConversion.isConverted && dueConversion.exchangeRate && (
                                  <p className="mt-0.5 font-mono text-[10px] text-[#5A5A62]">
                                    Live rate: 1 USD = {dueConversion.exchangeRate.toFixed(2)}{' '}
                                    {dueConversion.displayCurrency}
                                  </p>
                                )}
                              </div>
                            </div>

                            {!cancelled && (
                              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E4E4E7] pt-4">
                                {paid ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                    Payment Confirmed
                                  </span>
                                ) : project.status === 'Awaiting Payment' ||
                                  project.status === 'Quotation Accepted' ? (
                                  <Link
                                    to={`/checkout/${encodeURIComponent(project.id)}`}
                                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                                  >
                                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                                    Proceed to Payment &amp; Checkout
                                  </Link>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={actionBusyId === project.id}
                                      onClick={() => void handleAcceptQuotation(project.id)}
                                      className="inline-flex h-10 items-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                                    >
                                      {actionBusyId === project.id && (
                                        <Loader2
                                          className="h-3.5 w-3.5 animate-spin"
                                          aria-hidden="true"
                                        />
                                      )}
                                      {actionBusyId === project.id
                                        ? 'Accepting...'
                                        : 'Accept Quotation & Proceed to Payment'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeclineOpenId(
                                          declineOpenId === project.id ? null : project.id,
                                        );
                                        setDeclineReason('');
                                      }}
                                      className="inline-flex h-10 items-center rounded-md border border-[#E4E4E7] bg-white px-4 text-xs font-medium text-[#5A5A62] hover:border-red-300 hover:text-red-700"
                                    >
                                      Decline Quotation
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAssistant(
                                      `I have a question about the quotation for project ${project.referenceId} (${project.projectTitle}).`,
                                    )
                                  }
                                  className="inline-flex h-10 items-center rounded-md border border-[#E4E4E7] bg-white px-4 text-xs font-medium text-[#141416] hover:border-[#141416]"
                                >
                                  Discuss Quotation
                                </button>
                              </div>
                            )}

                            {declineOpenId === project.id && (
                              <div className="mt-4 space-y-2 rounded-md border border-red-200 bg-white p-3.5">
                                <label
                                  htmlFor={`decline-reason-${project.id}`}
                                  className="block text-xs font-medium text-[#141416]"
                                >
                                  Let VERTYLEX know what you would like adjusted (optional)
                                </label>
                                <textarea
                                  id={`decline-reason-${project.id}`}
                                  rows={2}
                                  value={declineReason}
                                  onChange={(e) => setDeclineReason(e.target.value)}
                                  placeholder="E.g. adjust deliverables, budget target, or timeline..."
                                  className="w-full rounded-md border border-[#D4D4D8] p-2 text-xs"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={actionBusyId === project.id}
                                    onClick={() => void handleDeclineQuotation(project.id)}
                                    className="inline-flex h-8 items-center rounded-md bg-red-700 px-3 text-xs font-medium text-white hover:bg-red-800"
                                  >
                                    Confirm Decline
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeclineOpenId(null)}
                                    className="inline-flex h-8 items-center rounded-md border border-[#E4E4E7] px-3 text-xs font-medium text-[#5A5A62]"
                                  >
                                    Keep Quotation
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          !cancelled && (
                            <p className="mt-5 text-xs text-[#5A5A62]">
                              Quotation pending: our team is reviewing your scope and will publish a
                              USD quotation here shortly.
                            </p>
                          )
                        )}

                        {/* Updates & Communication Feed */}
                        <div className="mt-6 rounded-md border border-[#E4E4E7] p-4">
                          <div className="flex items-center gap-2">
                            <MessageSquare
                              className="h-3.5 w-3.5 text-[#1D4ED8]"
                              aria-hidden="true"
                            />
                            <h3 className="text-xs font-semibold text-[#141416]">
                              Project Updates &amp; Messages
                            </h3>
                          </div>

                          {project.updates && project.updates.length > 0 ? (
                            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                              {project.updates.map((upd) => (
                                <div
                                  key={upd.id}
                                  className={`rounded-md border p-2.5 text-xs ${
                                    upd.senderRole === 'admin'
                                      ? 'border-[#1D4ED8]/25 bg-[#1D4ED8]/[0.03]'
                                      : 'border-[#E4E4E7] bg-[#FAFAFA]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[#141416]">
                                      {upd.senderRole === 'admin' ? 'VERTYLEX Team' : 'You'}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#5A5A62]">
                                      {new Date(upd.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-line text-[#5A5A62]">
                                    {upd.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[#5A5A62]">
                              No messages yet. Use the box below to send clarification or respond to
                              VERTYLEX.
                            </p>
                          )}

                          {!cancelled && (
                            <form
                              onSubmit={(e) => void handleSendProjectReply(e, project.id)}
                              className="mt-3 flex flex-col gap-2 sm:flex-row"
                            >
                              <input
                                type="text"
                                value={replyTexts[project.id] || ''}
                                onChange={(e) =>
                                  setReplyTexts((prev) => ({
                                    ...prev,
                                    [project.id]: e.target.value,
                                  }))
                                }
                                placeholder="Send an update or provide requested details to VERTYLEX..."
                                className="h-9 flex-1 rounded-md border border-[#D4D4D8] px-3 text-xs"
                              />
                              <button
                                type="submit"
                                disabled={
                                  actionBusyId === project.id ||
                                  !(replyTexts[project.id] || '').trim()
                                }
                                className="inline-flex h-9 items-center justify-center rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                              >
                                Send Update
                              </button>
                            </form>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#E4E4E7] pt-4 text-xs text-[#5A5A62]">
                          <span>
                            Submitted {new Date(project.createdAt).toLocaleString()}
                          </span>
                          <div className="flex flex-wrap items-center gap-4">
                            {!paid && !cancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelOpenId(cancelOpenId === project.id ? null : project.id);
                                  setCancelReason('');
                                }}
                                className="font-medium text-red-700 hover:underline"
                              >
                                Cancel Project
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openAssistant(
                                  `I would like an update on my project ${project.referenceId} (${project.projectTitle}).`,
                                )
                              }
                              className="font-medium text-[#141416] hover:text-[#1D4ED8]"
                            >
                              Ask VERTYLEX Support →
                            </button>
                          </div>
                        </div>

                        {cancelOpenId === project.id && (
                          <div className="mt-4 space-y-2 rounded-md border border-red-200 bg-red-50/40 p-3.5">
                            <p className="text-xs font-semibold text-[#141416]">
                              Cancel this unpaid project request?
                            </p>
                            <input
                              type="text"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Optional reason for cancellation..."
                              className="h-9 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionBusyId === project.id}
                                onClick={() => void handleCancelProject(project.id)}
                                className="inline-flex h-8 items-center rounded-md bg-red-700 px-3 text-xs font-medium text-white hover:bg-red-800"
                              >
                                Confirm Cancellation
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelOpenId(null)}
                                className="inline-flex h-8 items-center rounded-md border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#5A5A62]"
                              >
                                Keep Project
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Payment History & Receipts View */}
          {activeTab === 'payments' && (
            <div
              key="tab-payments"
              className="vtx-panel-enter mt-8 rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8"
            >
              <div className="flex items-center gap-2.5">
                <Receipt className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-[#141416]">
                  Order, Payment History &amp; Receipts
                </h2>
              </div>

              {selectedReceipt && (
                <div className="vtx-panel-enter mt-6 rounded-lg border border-emerald-200 bg-emerald-50/40 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-emerald-800">
                        OFFICIAL PAYMENT RECEIPT · {selectedReceipt.reference}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold text-[#141416]">
                        {selectedReceipt.projectReferenceId} — {selectedReceipt.projectTitle}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(null)}
                      aria-label="Close receipt"
                      className="rounded-md border border-[#E4E4E7] bg-white p-1.5 text-[#5A5A62] hover:text-[#141416]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-[#5A5A62]">Amount Paid</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-[#141416] tabular-nums">
                        {formatCurrencyAmount(selectedReceipt.amount, selectedReceipt.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">USD Value</dt>
                      <dd className="mt-0.5 font-mono text-[#141416] tabular-nums">
                        {typeof selectedReceipt.amountUsd === 'number'
                          ? formatCurrencyAmount(selectedReceipt.amountUsd, 'USD')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">Gateway &amp; Channel</dt>
                      <dd className="mt-0.5 capitalize text-[#141416]">
                        {selectedReceipt.provider}
                        {selectedReceipt.channel ? ` (${selectedReceipt.channel})` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5A5A62]">Verified Date</dt>
                      <dd className="mt-0.5 font-mono text-[#141416]">
                        {new Date(
                          selectedReceipt.verifiedAt || selectedReceipt.createdAt,
                        ).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {payments.length === 0 ? (
                <p className="mt-4 text-sm text-[#5A5A62]">
                  No payment transactions recorded yet. Once you accept a project quotation and
                  complete checkout, your transaction references and verified receipts will appear
                  here.
                </p>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E4E4E7] text-xs font-medium text-[#5A5A62]">
                        <th className="py-3 pr-4">Transaction Ref</th>
                        <th className="py-3 pr-4">Project</th>
                        <th className="py-3 pr-4">Provider</th>
                        <th className="py-3 pr-4">Amount</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Date</th>
                        <th className="py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7]">
                      {payments.map((pay) => (
                        <tr key={pay.id} className="text-xs">
                          <td className="py-3.5 pr-4 font-mono font-medium text-[#141416]">
                            {pay.reference}
                          </td>
                          <td className="py-3.5 pr-4 text-[#141416]">
                            {pay.projectReferenceId} · {pay.projectTitle}
                          </td>
                          <td className="py-3.5 pr-4 capitalize text-[#5A5A62]">{pay.provider}</td>
                          <td className="py-3.5 pr-4 font-mono text-[#141416] tabular-nums">
                            {formatCurrencyAmount(pay.amount, pay.currency)}
                            {typeof pay.amountUsd === 'number' &&
                              pay.currency !== 'USD' &&
                              ` ($${pay.amountUsd.toLocaleString()} USD)`}
                          </td>
                          <td className="py-3.5 pr-4 font-medium capitalize text-[#1D4ED8]">
                            {pay.status}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-[#5A5A62] tabular-nums">
                            {new Date(pay.verifiedAt || pay.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5">
                            {pay.status === 'paid' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt(pay)}
                                className="font-medium text-[#1D4ED8] hover:underline"
                              >
                                View Receipt
                              </button>
                            ) : (
                              <span className="text-[#5A5A62]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Account Preferences View */}
          {activeTab === 'preferences' && (
            <div
              key="tab-preferences"
              className="vtx-panel-enter mt-8 rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8"
            >
              <div className="max-w-xl">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold text-[#141416]">
                    Country, Region &amp; Currency Preferences
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                  Manage your saved location and default quotation display currency. Updating your
                  country suggests the matching currency, while letting you choose any supported
                  currency anytime.
                </p>

                {prefsSuccess && (
                  <div
                    role="status"
                    className="vtx-panel-enter mt-5 flex items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#F3F3F5] px-4 py-3 text-xs font-medium text-[#141416]"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                    <span>{prefsSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSavePreferences} className="mt-6 space-y-6">
                  <CountryRegionPicker
                    value={prefsValue}
                    onChange={(next) => {
                      setPrefsSuccess('');
                      setPrefsValue(next);
                    }}
                    onResetToSuggested={() => {
                      const detected =
                        findCountryByCode(suggestedCountryCode) || COUNTRY_OPTIONS[0];
                      setPrefsSuccess('');
                      setPrefsValue({
                        countryCode: detected.code,
                        countryName: detected.name,
                        stateRegion:
                          detected.code === suggestedCountryCode ? suggestedStateRegion : '',
                        preferredCurrency: detected.suggestedCurrency,
                      });
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={prefsSaving}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#141416] px-5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
                    >
                      {prefsSaving && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      )}
                      {prefsSaving ? 'Saving Preferences...' : 'Save Preferences'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
