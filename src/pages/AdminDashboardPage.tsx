import {
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {NotificationBell} from '../components/NotificationBell';
import {useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {SUPPORTED_CURRENCIES} from '../data/countries';
import {getMailtoUrl, getServiceBudgetConfig, PROJECT_STATUS_LIST} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

interface AdminKpis {
  totalProjects: number;
  newRequests: number;
  underReview: number;
  moreInfoRequired: number;
  quotationsSent: number;
  awaitingPayments: number;
  paidProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  cancelledProjects: number;
  totalRevenueUsd: number;
  unreadNotificationsCount: number;
}

interface AdminQuotation {
  amountUsd: number;
  paymentOption: 'full' | 'deposit';
  depositPercent: number;
  dueNowUsd: number;
  amount: number;
  currency: string;
  customerDisplayCurrency?: string;
  customerEstimatedTotal?: number;
  customerEstimatedDueNow?: number;
  exchangeRateAtQuote?: number;
  summary: string;
  deliverables: string[];
  validUntil: string;
  quotedAt: string;
  quotedBy: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

interface InternalNote {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface ProjectUpdate {
  id: string;
  senderRole: 'admin' | 'customer';
  senderName: string;
  senderEmail: string;
  message: string;
  requiresAction?: boolean;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  actorEmail: string;
  actorRole: 'admin' | 'customer' | 'system';
  action: string;
  details: string;
  createdAt: string;
}

interface ProjectAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface AdminProject {
  id: string;
  referenceId: string;
  fullName: string;
  email: string;
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  businessName: string;
  selectedService: string;
  projectTitle: string;
  ideaDescription: string;
  budgetRange: string;
  budgetUsd?: number;
  recommendedBudgetUsd?: number;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetDisplayCurrency?: string;
  budgetEstimatedLocalAmount?: number;
  budgetExchangeRateAtSubmit?: number;
  additionalRequirements: string;
  serviceDetails?: Record<string, string | string[]>;
  attachments?: ProjectAttachment[];
  preferredRegion?: string;
  preferredCurrency?: string;
  deliveryTime?: string;
  deliveryTimeStatus?: 'Pending Review' | 'Achievable as Requested' | 'Adjusted by Administrator';
  confirmedDeliveryTime?: string;
  status: string;
  progressStage?: string;
  quotation: AdminQuotation | null;
  internalNotes?: InternalNote[];
  updates?: ProjectUpdate[];
  auditLog?: AuditEntry[];
  createdAt: string;
  updatedAt?: string;
}

interface AdminPayment {
  id: string;
  reference: string;
  projectId: string;
  projectReferenceId: string;
  projectTitle: string;
  customerEmail?: string;
  customerName?: string;
  provider: string;
  amountUsd?: number;
  amount: number;
  currency: string;
  paymentOption?: 'full' | 'deposit';
  depositPercent?: number;
  status: 'pending' | 'paid' | 'failed';
  channel?: string;
  webhookVerified?: boolean;
  createdAt: string;
  verifiedAt?: string;
}

const SETTLEMENT_CURRENCIES = SUPPORTED_CURRENCIES.map((c) => c.code);

function statusBadgeStyle(status: string): string {
  switch (status) {
    case 'New Request':
    case 'Received for Review':
      return 'border-[#1D4ED8]/30 bg-[#1D4ED8]/10 text-[#1D4ED8]';
    case 'More Information Required':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'Payment Confirmed':
    case 'Paid':
    case 'Completed':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'Cancelled':
      return 'border-red-200 bg-red-50 text-red-800';
    default:
      return 'border-[#E4E4E7] bg-[#F3F3F5] text-[#141416]';
  }
}

const SERVICE_DETAIL_LABELS: Record<string, string> = {
  websiteType: 'Website Type',
  websitePurpose: 'Website Purpose & Goals',
  desiredFeatures: 'Desired Features',
  customFeatures: 'Other Requested Features',
  preferredDesign: 'Preferred Design & Style',
  campaignGoal: 'Campaign Goal & Offer',
  targetAudience: 'Target Audience & Channels',
  keyMessage: 'Key Message & Call-to-Action',
  designFormat: 'Design Format / Item',
  designBrief: 'Design Brief & Copy',
  businessStage: 'Business Stage',
  supportArea: 'Focus Area',
  businessIdea: 'Business Idea & Objectives',
  targetPlatforms: 'Target Platforms',
  appPurpose: 'Application Purpose & Workflow',
  brandingFocus: 'Branding Focus',
  brandStory: 'Brand Story & Audience',
  projectOverview: 'Detailed Project Description',
  preferredTimeline: 'Preferred Timeline',
  deliveryTime: 'Requested Delivery Time',
};

export function AdminDashboardPage() {
  const {user} = useAuth();
  const {convertQuotationAmount, formatCurrencyAmount} = useRegion();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProjectId = searchParams.get('project') || '';

  const [activeTab, setActiveTab] = useState<'projects' | 'payments'>('projects');
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected project detail
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<AdminPayment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action feedback & forms
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Status update
  const [nextStatus, setNextStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [confirmedTimelineInput, setConfirmedTimelineInput] = useState('');

  // Decline confirmation inline
  const [showDeclineBox, setShowDeclineBox] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Quotation form
  const [quoteUsd, setQuoteUsd] = useState('');
  const [paymentOption, setPaymentOption] = useState<'full' | 'deposit'>('full');
  const [depositPercent, setDepositPercent] = useState('50');
  const [settlementCurrency, setSettlementCurrency] = useState('USD');
  const [quoteSummary, setQuoteSummary] = useState('');
  const [quoteDeliverables, setQuoteDeliverables] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState(() =>
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
  );

  // Customer message / info request
  const [customerMessage, setCustomerMessage] = useState('');
  const [requestMoreInfo, setRequestMoreInfo] = useState(false);

  // Private internal note
  const [internalNoteText, setInternalNoteText] = useState('');

  const loadOverviewAndLists = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setRefreshing(true);
    setBannerError('');
    try {
      const [ovRes, projRes, payRes] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch('/api/admin/projects'),
        apiFetch('/api/admin/payments'),
      ]);
      if (!ovRes.ok || !projRes.ok || !payRes.ok) {
        throw new Error('Unable to load administrator dashboard data.');
      }
      const ovData = (await ovRes.json()) as {kpis: AdminKpis};
      const projData = (await projRes.json()) as {projects: AdminProject[]};
      const payData = (await payRes.json()) as {payments: AdminPayment[]};
      setKpis(ovData.kpis);
      setProjects(projData.projects || []);
      setPayments(payData.payments || []);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadProjectDetail = useCallback(async (projectId: string) => {
    if (!projectId) {
      setSelectedProject(null);
      setSelectedPayments([]);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/admin/projects/${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        setSelectedProject(null);
        return;
      }
      const data = (await res.json()) as {project: AdminProject; payments: AdminPayment[]};
      setSelectedProject(data.project);
      setSelectedPayments(data.payments || []);
      setNextStatus(data.project.status);
      setConfirmedTimelineInput(
        data.project.confirmedDeliveryTime || data.project.deliveryTime || '',
      );
      setShowDeclineBox(false);
      setDeclineReason('');
      if (data.project.quotation) {
        setQuoteUsd(String(data.project.quotation.amountUsd ?? data.project.quotation.amount));
        setPaymentOption(data.project.quotation.paymentOption || 'full');
        setDepositPercent(String(data.project.quotation.depositPercent ?? 50));
        setSettlementCurrency(data.project.quotation.currency || 'USD');
        setQuoteSummary(data.project.quotation.summary || '');
        setQuoteDeliverables((data.project.quotation.deliverables || []).join('\n'));
        setQuoteValidUntil(data.project.quotation.validUntil || '');
      } else {
        setQuoteUsd('');
        setPaymentOption('full');
        setDepositPercent('50');
        setSettlementCurrency('USD');
        setQuoteSummary('');
        setQuoteDeliverables('');
        setQuoteValidUntil(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10));
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverviewAndLists(true);
  }, [loadOverviewAndLists]);

  useEffect(() => {
    if (selectedProjectId) {
      setActiveTab('projects');
      void loadProjectDetail(selectedProjectId);
    } else {
      setSelectedProject(null);
      setSelectedPayments([]);
    }
  }, [selectedProjectId, loadProjectDetail]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.referenceId.toLowerCase().includes(q) ||
        p.projectTitle.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.selectedService.toLowerCase().includes(q) ||
        (p.countryName || '').toLowerCase().includes(q)
      );
    });
  }, [projects, statusFilter, searchQuery]);

  function openProject(projectId: string) {
    setBannerMessage('');
    setBannerError('');
    setSearchParams({project: projectId});
  }

  function closeProject() {
    setSearchParams({});
  }

  async function refreshCurrent(projectId?: string) {
    await loadOverviewAndLists(false);
    const idToLoad = projectId || selectedProjectId;
    if (idToLoad) {
      await loadProjectDetail(idToLoad);
    }
  }

  async function handleDownloadAttachment(projectId: string, att: ProjectAttachment) {
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(att.id)}`,
      );
      if (!res.ok) throw new Error('Unable to download file.');
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
      setBannerError(err instanceof Error ? err.message : 'Unable to download attachment.');
    }
  }

  async function handleStatusUpdate(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject || !nextStatus) return;
    setBusyAction('status');
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/status`,
        {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({status: nextStatus, note: statusNote.trim()}),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to update status.');
      setStatusNote('');
      setBannerMessage(`Updated ${selectedProject.referenceId} status to "${nextStatus}". Customer notified.`);
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTimelineReview(
    decision: 'Achievable as Requested' | 'Adjusted by Administrator',
  ) {
    if (!selectedProject) return;
    if (decision === 'Adjusted by Administrator' && !confirmedTimelineInput.trim()) {
      setBannerError('Please enter the proposed delivery schedule before adjusting.');
      return;
    }
    setBusyAction('timeline');
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/timeline`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            deliveryTimeStatus: decision,
            confirmedDeliveryTime:
              decision === 'Achievable as Requested'
                ? selectedProject.deliveryTime || confirmedTimelineInput.trim()
                : confirmedTimelineInput.trim(),
          }),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to save schedule confirmation.');
      setBannerMessage(
        decision === 'Achievable as Requested'
          ? `Confirmed ${selectedProject.referenceId} delivery timeframe as achievable.`
          : `Updated ${selectedProject.referenceId} schedule and notified customer.`,
      );
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Schedule confirmation failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDecision(decision: 'accept' | 'decline') {
    if (!selectedProject) return;
    setBusyAction(decision);
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/decision`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            decision,
            reason: decision === 'decline' ? declineReason.trim() : '',
          }),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to save decision.');
      setShowDeclineBox(false);
      setDeclineReason('');
      setBannerMessage(
        decision === 'accept'
          ? `Project ${selectedProject.referenceId} accepted into Under Review.`
          : `Project ${selectedProject.referenceId} declined and customer notified.`,
      );
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendQuotation(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setBusyAction('quote');
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/quote`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            amountUsd: Number(quoteUsd),
            paymentOption,
            depositPercent: paymentOption === 'deposit' ? Number(depositPercent) : 100,
            settlementCurrency,
            summary: quoteSummary.trim(),
            deliverables: quoteDeliverables
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            validUntil: quoteValidUntil,
          }),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to send quotation.');
      setBannerMessage(
        `Quotation ($${Number(quoteUsd).toLocaleString()} USD) sent to ${selectedProject.fullName}.`,
      );
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Quotation delivery failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendCustomerMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject || !customerMessage.trim()) return;
    setBusyAction('message');
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/message`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            message: customerMessage.trim(),
            requestMoreInfo,
          }),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to send message.');
      setCustomerMessage('');
      setRequestMoreInfo(false);
      setBannerMessage('Message sent and customer notified.');
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveInternalNote(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject || !internalNoteText.trim()) return;
    setBusyAction('note');
    setBannerMessage('');
    setBannerError('');
    try {
      const res = await apiFetch(
        `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/notes`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text: internalNoteText.trim()}),
        },
      );
      const data = (await res.json()) as {error?: string};
      if (!res.ok) throw new Error(data.error || 'Unable to save note.');
      setInternalNoteText('');
      setBannerMessage('Private internal note saved.');
      await refreshCurrent(selectedProject.id);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to save internal note.');
    } finally {
      setBusyAction(null);
    }
  }

  const parsedQuoteUsd = Number(quoteUsd);
  const validQuoteUsd = Number.isFinite(parsedQuoteUsd) && parsedQuoteUsd > 0 ? parsedQuoteUsd : 0;
  const pct = paymentOption === 'deposit' ? Math.min(90, Math.max(10, Number(depositPercent) || 50)) : 100;
  const dueNowUsdPreview = Math.round(validQuoteUsd * (pct / 100) * 100) / 100;
  const customerPreviewCurrency = selectedProject?.preferredCurrency || 'USD';
  const customerConvertedTotal =
    validQuoteUsd > 0 ? convertQuotationAmount(validQuoteUsd, 'USD', customerPreviewCurrency) : null;
  const customerConvertedDue =
    dueNowUsdPreview > 0
      ? convertQuotationAmount(dueNowUsdPreview, 'USD', customerPreviewCurrency)
      : null;

  const revenueConversion =
    kpis && kpis.totalRevenueUsd > 0
      ? convertQuotationAmount(kpis.totalRevenueUsd, 'USD')
      : null;

  return (
    <div className="bg-[#FAFAFA] py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-[#E4E4E7] bg-white p-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#1D4ED8]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Private Owner Workspace · {user?.email}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#141416]">
              VERTYLEX Admin Dashboard
            </h1>
            <p className="mt-1 text-xs text-[#5A5A62]">
              Manage customer projects, review scope details, issue USD quotations, and monitor
              verified payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell
              mode="admin"
              onSelectNotification={(notif) => {
                if (notif.projectId) {
                  openProject(notif.projectId);
                }
              }}
            />
            <button
              type="button"
              onClick={() => void refreshCurrent()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-3.5 text-xs font-medium text-[#141416] hover:border-[#141416] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
            <Link
              to="/account"
              className="inline-flex h-9 items-center rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 text-xs font-medium text-[#141416] hover:border-[#141416]"
            >
              Customer View
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Total Received</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.totalProjects}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#1D4ED8]">New Requests</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.newRequests}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Under Review</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.underReview}
                {kpis.moreInfoRequired > 0 && (
                  <span className="ml-2 font-mono text-xs font-normal text-amber-700">
                    +{kpis.moreInfoRequired} info
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Quotations Sent</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.quotationsSent}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Awaiting Payment</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.awaitingPayments}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-emerald-700">Paid Projects</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.paidProjects}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">In Progress</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.inProgressProjects}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Completed</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.completedProjects}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-4">
              <p className="text-[11px] font-medium text-[#5A5A62]">Cancelled</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#141416] tabular-nums">
                {kpis.cancelledProjects}
              </p>
            </div>
            <div className="rounded-lg border border-[#141416] bg-[#141416] p-4 text-white">
              <p className="text-[11px] font-medium text-zinc-300">Confirmed Revenue (USD)</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                {formatCurrencyAmount(kpis.totalRevenueUsd, 'USD')}
              </p>
              {revenueConversion?.isConverted && (
                <p className="mt-0.5 font-mono text-[10px] text-zinc-300 tabular-nums">
                  ≈ {revenueConversion.displayFormatted}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`h-9 rounded-md px-4 text-xs font-medium transition-colors ${
              activeTab === 'projects'
                ? 'bg-[#141416] text-white'
                : 'border border-[#E4E4E7] bg-white text-[#5A5A62] hover:text-[#141416]'
            }`}
          >
            Projects &amp; Requests ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`h-9 rounded-md px-4 text-xs font-medium transition-colors ${
              activeTab === 'payments'
                ? 'bg-[#141416] text-white'
                : 'border border-[#E4E4E7] bg-white text-[#5A5A62] hover:text-[#141416]'
            }`}
          >
            Payment Ledger ({payments.length})
          </button>
        </div>

        {bannerError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
          >
            {bannerError}
          </div>
        )}
        {bannerMessage && (
          <div
            role="status"
            className="vtx-panel-enter mt-4 flex items-center gap-2 rounded-md border border-[#1D4ED8]/30 bg-white px-4 py-3 text-xs font-medium text-[#141416]"
          >
            <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <span>{bannerMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-[#E4E4E7] bg-white p-8 text-sm text-[#5A5A62]">
            <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
            <span>Loading admin workspace...</span>
          </div>
        ) : activeTab === 'payments' ? (
          <div className="vtx-panel-enter mt-6 rounded-lg border border-[#E4E4E7] bg-white p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#141416]">All Payment Records</h2>
            </div>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-[#5A5A62]">No payment transactions have been recorded yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[#5A5A62]">
                      <th className="py-3 pr-4 font-medium">Reference</th>
                      <th className="py-3 pr-4 font-medium">Project</th>
                      <th className="py-3 pr-4 font-medium">Customer</th>
                      <th className="py-3 pr-4 font-medium">Provider</th>
                      <th className="py-3 pr-4 font-medium">USD Equiv.</th>
                      <th className="py-3 pr-4 font-medium">Settled Amount</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {payments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 pr-4 font-mono font-medium text-[#141416]">
                          {pay.reference}
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => openProject(pay.projectId)}
                            className="font-medium text-[#1D4ED8] hover:underline"
                          >
                            {pay.projectReferenceId} · {pay.projectTitle}
                          </button>
                        </td>
                        <td className="py-3 pr-4 text-[#5A5A62]">
                          {pay.customerName || 'Client'} ({pay.customerEmail || '—'})
                        </td>
                        <td className="py-3 pr-4 capitalize text-[#141416]">{pay.provider}</td>
                        <td className="py-3 pr-4 font-mono text-[#141416] tabular-nums">
                          {typeof pay.amountUsd === 'number'
                            ? formatCurrencyAmount(pay.amountUsd, 'USD')
                            : '—'}
                        </td>
                        <td className="py-3 pr-4 font-mono font-medium text-[#141416] tabular-nums">
                          {formatCurrencyAmount(pay.amount, pay.currency)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium capitalize ${
                              pay.status === 'paid'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : pay.status === 'failed'
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-[#E4E4E7] bg-[#F3F3F5] text-[#5A5A62]'
                            }`}
                          >
                            {pay.status}
                            {pay.webhookVerified ? ' (webhook)' : ''}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[#5A5A62] tabular-nums">
                          {new Date(pay.verifiedAt || pay.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Search & Status Filter */}
            <div className="flex flex-col gap-3 rounded-lg border border-[#E4E4E7] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5A62]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by reference, title, customer name, email, country, or service..."
                  className="h-10 w-full rounded-md border border-[#D4D4D8] bg-[#FAFAFA] pl-9 pr-3 text-xs text-[#141416] focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="admin-status-filter" className="text-xs font-medium text-[#5A5A62]">
                  Status:
                </label>
                <select
                  id="admin-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-md border border-[#D4D4D8] bg-white px-3 text-xs font-medium text-[#141416]"
                >
                  <option value="ALL">All Statuses ({projects.length})</option>
                  {PROJECT_STATUS_LIST.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Project List */}
              <div className={selectedProject || detailLoading ? 'lg:col-span-5' : 'lg:col-span-12'}>
                <div className="overflow-hidden rounded-lg border border-[#E4E4E7] bg-white">
                  {filteredProjects.length === 0 ? (
                    <p className="p-8 text-center text-sm text-[#5A5A62]">
                      No project requests match your current filter.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E4E4E7]">
                      {filteredProjects.map((proj) => {
                        const isSelected = proj.id === selectedProjectId;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => openProject(proj.id)}
                            className={`block w-full p-4 text-left transition-colors hover:bg-[#FAFAFA] ${
                              isSelected ? 'bg-[#1D4ED8]/[0.04]' : 'bg-white'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs font-medium text-[#1D4ED8]">
                                {proj.referenceId}
                              </span>
                              <span
                                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusBadgeStyle(
                                  proj.status,
                                )}`}
                              >
                                {proj.status}
                              </span>
                            </div>
                            <p className="mt-1.5 font-display text-sm font-bold text-[#141416]">
                              {proj.projectTitle}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A5A62]">
                              <span>
                                {proj.fullName} ({proj.email})
                              </span>
                              <span>·</span>
                              <span>{proj.selectedService}</span>
                              {proj.countryName && (
                                <>
                                  <span>·</span>
                                  <span>{proj.countryName}</span>
                                </>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#5A5A62]">
                              <span>Submitted: {new Date(proj.createdAt).toLocaleString()}</span>
                              <span className="flex items-center gap-3 tabular-nums">
                                {typeof proj.budgetUsd === 'number' && (
                                  <span className="text-[#5A5A62]">
                                    Budget: ${proj.budgetUsd.toLocaleString()} USD
                                  </span>
                                )}
                                {proj.quotation && (
                                  <span className="font-semibold text-[#141416]">
                                    Quote: ${proj.quotation.amountUsd?.toLocaleString() ?? proj.quotation.amount} USD
                                  </span>
                                )}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Project Detail Management Drawer / Panel */}
              {(selectedProject || detailLoading) && (
                <div className="lg:col-span-7">
                  {detailLoading && !selectedProject ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-[#E4E4E7] bg-white p-8 text-sm text-[#5A5A62]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                      <span>Loading full project brief...</span>
                    </div>
                  ) : (
                    selectedProject && (
                      <div className="vtx-panel-enter space-y-6 rounded-lg border border-[#E4E4E7] bg-white p-6">
                        <div className="flex items-start justify-between gap-4 border-b border-[#E4E4E7] pb-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-medium text-[#1D4ED8]">
                                {selectedProject.referenceId}
                              </span>
                              <span
                                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusBadgeStyle(
                                  selectedProject.status,
                                )}`}
                              >
                                {selectedProject.status}
                              </span>
                            </div>
                            <h2 className="mt-1.5 font-display text-xl font-bold text-[#141416]">
                              {selectedProject.projectTitle}
                            </h2>
                            <p className="mt-0.5 text-xs text-[#5A5A62]">
                              {selectedProject.selectedService} · Submitted{' '}
                              {new Date(selectedProject.createdAt).toLocaleString()}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={closeProject}
                            aria-label="Close project detail panel"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E4E7] text-[#5A5A62] hover:text-[#141416]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Customer Profile Metadata */}
                        <dl className="grid grid-cols-1 gap-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-[#5A5A62]">Customer</dt>
                            <dd className="mt-0.5 font-medium text-[#141416]">
                              {selectedProject.fullName}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#5A5A62]">Customer Email</dt>
                            <dd className="mt-0.5">
                              <a
                                href={getMailtoUrl(
                                  `VERTYLEX Project ${selectedProject.referenceId}: ${selectedProject.projectTitle}`,
                                )}
                                className="inline-flex items-center gap-1 font-medium text-[#1D4ED8] hover:underline"
                              >
                                <Mail className="h-3 w-3" aria-hidden="true" />
                                {selectedProject.email}
                              </a>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#5A5A62]">Country &amp; Region</dt>
                            <dd className="mt-0.5 flex items-center gap-1 font-medium text-[#141416]">
                              <Globe className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                              <span>
                                {selectedProject.countryName || selectedProject.preferredRegion || 'Not specified'}
                                {selectedProject.stateRegion ? ` (${selectedProject.stateRegion})` : ''}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#5A5A62]">Display Currency &amp; Package</dt>
                            <dd className="mt-0.5 font-medium text-[#141416]">
                              {selectedProject.preferredCurrency || 'USD'} ·{' '}
                              {selectedProject.budgetRange || 'Flexible'}
                            </dd>
                          </div>
                          {selectedProject.businessName && (
                            <div className="sm:col-span-2">
                              <dt className="text-[#5A5A62]">Business / Organization</dt>
                              <dd className="mt-0.5 font-medium text-[#141416]">
                                {selectedProject.businessName}
                              </dd>
                            </div>
                          )}
                          {selectedProject.deliveryTime && (
                            <div className="sm:col-span-2 border-t border-[#E4E4E7] pt-2.5">
                              <dt className="text-[#5A5A62]">
                                Customer Requested Delivery Time (Subject to Admin Confirmation)
                              </dt>
                              <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[#141416]">
                                <span>{selectedProject.deliveryTime}</span>
                                <span className="text-[#1D4ED8]">
                                  · {selectedProject.deliveryTimeStatus || 'Pending Review'}
                                  {selectedProject.confirmedDeliveryTime &&
                                  selectedProject.deliveryTimeStatus === 'Adjusted by Administrator'
                                    ? ` (${selectedProject.confirmedDeliveryTime})`
                                    : ''}
                                </span>
                              </dd>
                            </div>
                          )}
                        </dl>

                        {/* Pricing & Customer Budget Overview (Mandatory Admin Control View) */}
                        {(() => {
                          const serviceCfg = getServiceBudgetConfig(selectedProject.selectedService);
                          const recUsd =
                            selectedProject.recommendedBudgetUsd ?? serviceCfg?.recommendedUsd;
                          const targetCurrency =
                            selectedProject.preferredCurrency ||
                            selectedProject.budgetDisplayCurrency ||
                            'USD';
                          const hasCustomerBudget = typeof selectedProject.budgetUsd === 'number';
                          const customerLocalLive = hasCustomerBudget
                            ? convertQuotationAmount(
                                selectedProject.budgetUsd!,
                                'USD',
                                targetCurrency,
                              )
                            : null;
                          const recLocalLive =
                            typeof recUsd === 'number'
                              ? convertQuotationAmount(recUsd, 'USD', targetCurrency)
                              : null;

                          return (
                            <div className="rounded-md border border-[#E4E4E7] bg-white p-4 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-2.5">
                                <h3 className="font-semibold text-[#141416]">
                                  Pricing &amp; Customer Budget Overview
                                </h3>
                                <span className="font-mono text-[11px] text-[#5A5A62]">
                                  Base: USD · Customer Currency: {targetCurrency}
                                </span>
                              </div>

                              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                  <dt className="text-[11px] text-[#5A5A62]">Selected Service</dt>
                                  <dd className="mt-0.5 font-semibold text-[#141416]">
                                    {selectedProject.selectedService}
                                  </dd>
                                </div>

                                <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                  <dt className="text-[11px] text-[#5A5A62]">
                                    Original Customer Budget (USD)
                                  </dt>
                                  <dd className="mt-0.5 font-mono text-sm font-bold text-[#141416] tabular-nums">
                                    {hasCustomerBudget
                                      ? `${formatCurrencyAmount(selectedProject.budgetUsd!, 'USD')} USD`
                                      : selectedProject.budgetRange || 'Not specified'}
                                  </dd>
                                </div>

                                <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                  <dt className="text-[11px] text-[#5A5A62]">
                                    Customer Local Equivalent ({targetCurrency})
                                  </dt>
                                  <dd className="mt-0.5 font-mono text-sm font-bold text-[#1D4ED8] tabular-nums">
                                    {hasCustomerBudget
                                      ? customerLocalLive?.isConverted
                                        ? customerLocalLive.displayFormatted
                                        : typeof selectedProject.budgetEstimatedLocalAmount ===
                                            'number'
                                          ? formatCurrencyAmount(
                                              selectedProject.budgetEstimatedLocalAmount,
                                              targetCurrency,
                                            )
                                          : `${formatCurrencyAmount(selectedProject.budgetUsd!, 'USD')} USD`
                                      : 'N/A'}
                                  </dd>
                                  {hasCustomerBudget &&
                                    typeof selectedProject.budgetEstimatedLocalAmount ===
                                      'number' &&
                                    targetCurrency !== 'USD' && (
                                      <p className="mt-0.5 font-mono text-[10px] text-[#5A5A62] tabular-nums">
                                        At submit:{' '}
                                        {formatCurrencyAmount(
                                          selectedProject.budgetEstimatedLocalAmount,
                                          targetCurrency,
                                        )}
                                      </p>
                                    )}
                                </div>

                                <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                  <dt className="text-[11px] text-[#5A5A62]">
                                    Recommended Budget
                                  </dt>
                                  <dd className="mt-0.5 font-mono font-semibold text-[#141416] tabular-nums">
                                    {typeof recUsd === 'number'
                                      ? `${formatCurrencyAmount(recUsd, 'USD')} USD`
                                      : 'Scope-based'}
                                    {recLocalLive?.isConverted && (
                                      <span className="block text-[11px] font-normal text-[#5A5A62]">
                                        ≈ {recLocalLive.displayFormatted}
                                      </span>
                                    )}
                                  </dd>
                                </div>

                                <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5 sm:col-span-2">
                                  <dt className="text-[11px] text-[#5A5A62]">
                                    Final Quotation Set by Administrator
                                  </dt>
                                  <dd className="mt-0.5 font-mono text-sm font-bold text-[#141416] tabular-nums">
                                    {selectedProject.quotation ? (
                                      <>
                                        {formatCurrencyAmount(
                                          selectedProject.quotation.amountUsd,
                                          'USD',
                                        )}{' '}
                                        USD
                                        {convertQuotationAmount(
                                          selectedProject.quotation.amountUsd,
                                          'USD',
                                          targetCurrency,
                                        ).isConverted && (
                                          <span className="ml-2 text-xs font-normal text-[#1D4ED8]">
                                            (≈{' '}
                                            {
                                              convertQuotationAmount(
                                                selectedProject.quotation.amountUsd,
                                                'USD',
                                                targetCurrency,
                                              ).displayFormatted
                                            }
                                            )
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="font-sans text-xs font-medium text-amber-800">
                                        Pending Admin Review — use Formal USD Quotation Builder
                                        below
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          );
                        })()}

                        {selectedProject.quotation && (
                          <div className="rounded-md border border-[#E4E4E7] bg-white p-4 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-[#141416]">
                                Issued Quotation (Base USD &amp; Customer Display)
                              </span>
                              <span className="font-mono text-[11px] text-[#5A5A62]">
                                {selectedProject.quotation.acceptedAt
                                  ? `Accepted ${new Date(selectedProject.quotation.acceptedAt).toLocaleDateString()}`
                                  : selectedProject.quotation.declinedAt
                                    ? `Declined ${new Date(selectedProject.quotation.declinedAt).toLocaleDateString()}`
                                    : 'Pending Customer Approval'}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                <p className="text-[11px] text-[#5A5A62]">Base Total (USD)</p>
                                <p className="mt-0.5 font-mono text-sm font-bold text-[#141416] tabular-nums">
                                  {formatCurrencyAmount(selectedProject.quotation.amountUsd, 'USD')}
                                </p>
                              </div>
                              <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                <p className="text-[11px] text-[#5A5A62]">
                                  Due Now ({selectedProject.quotation.paymentOption === 'deposit' ? `${selectedProject.quotation.depositPercent}% Deposit` : '100% Full'})
                                </p>
                                <p className="mt-0.5 font-mono text-sm font-bold text-[#1D4ED8] tabular-nums">
                                  {formatCurrencyAmount(selectedProject.quotation.dueNowUsd, 'USD')}
                                </p>
                              </div>
                              <div className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                                <p className="text-[11px] text-[#5A5A62]">
                                  Customer View ({selectedProject.preferredCurrency || selectedProject.quotation.customerDisplayCurrency || 'USD'})
                                </p>
                                <p className="mt-0.5 font-mono text-sm font-bold text-[#141416] tabular-nums">
                                  {
                                    convertQuotationAmount(
                                      selectedProject.quotation.dueNowUsd,
                                      'USD',
                                      selectedProject.preferredCurrency ||
                                        selectedProject.quotation.customerDisplayCurrency ||
                                        'USD',
                                    ).displayFormatted
                                  }
                                </p>
                              </div>
                            </div>
                            {selectedProject.quotation.declineReason && (
                              <p className="mt-2.5 text-red-700">
                                Decline note: {selectedProject.quotation.declineReason}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Full Description & Structured Fields */}
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5A5A62]">
                            Project Brief &amp; Requirements
                          </h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#141416]">
                            {selectedProject.ideaDescription}
                          </p>
                          {selectedProject.additionalRequirements && (
                            <div className="mt-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3 text-xs text-[#5A5A62]">
                              <strong className="text-[#141416]">Additional Requirements:</strong>{' '}
                              {selectedProject.additionalRequirements}
                            </div>
                          )}
                          {selectedProject.serviceDetails &&
                            Object.keys(selectedProject.serviceDetails).length > 0 && (
                              <dl className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-[#E4E4E7] p-3 text-xs sm:grid-cols-2">
                                {Object.entries(selectedProject.serviceDetails).map(([k, v]) => (
                                  <div key={k}>
                                    <dt className="font-medium text-[#5A5A62]">
                                      {SERVICE_DETAIL_LABELS[k] || k}
                                    </dt>
                                    <dd className="mt-0.5 text-[#141416]">
                                      {Array.isArray(v) ? v.join(', ') : v}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          {selectedProject.attachments && selectedProject.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-[#5A5A62]">Files:</span>
                              {selectedProject.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => void handleDownloadAttachment(selectedProject.id, att)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-1.5 text-xs font-medium text-[#141416] hover:border-[#141416]"
                                >
                                  <Download className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                                  {att.originalName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Status & Accept/Decline Controls */}
                        <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-xs font-semibold text-[#141416]">
                              Project Review &amp; Status Control
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => void handleDecision('accept')}
                                className="inline-flex h-8 items-center rounded-md border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#141416] hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                              >
                                Accept for Review
                              </button>
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => setShowDeclineBox((prev) => !prev)}
                                className="inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Decline Project
                              </button>
                            </div>
                          </div>

                          {showDeclineBox && (
                            <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-white p-3">
                              <label
                                htmlFor="admin-decline-reason"
                                className="block text-xs font-medium text-[#141416]"
                              >
                                Reason shown to customer (optional)
                              </label>
                              <textarea
                                id="admin-decline-reason"
                                rows={2}
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="Briefly explain why VERTYLEX cannot accept this project right now..."
                                className="w-full rounded-md border border-[#D4D4D8] p-2 text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={busyAction === 'decline'}
                                  onClick={() => void handleDecision('decline')}
                                  className="inline-flex h-8 items-center rounded-md bg-red-700 px-3 text-xs font-medium text-white hover:bg-red-800"
                                >
                                  Confirm Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowDeclineBox(false)}
                                  className="inline-flex h-8 items-center rounded-md border border-[#E4E4E7] px-3 text-xs font-medium text-[#5A5A62]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          <form onSubmit={handleStatusUpdate} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                            <select
                              aria-label="Select project status"
                              value={nextStatus}
                              onChange={(e) => setNextStatus(e.target.value)}
                              className="h-9 rounded-md border border-[#D4D4D8] bg-white px-3 text-xs font-medium text-[#141416] sm:col-span-5"
                            >
                              {PROJECT_STATUS_LIST.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={statusNote}
                              onChange={(e) => setStatusNote(e.target.value)}
                              placeholder="Optional customer note for this status update..."
                              className="h-9 rounded-md border border-[#D4D4D8] bg-white px-3 text-xs sm:col-span-5"
                            />
                            <button
                              type="submit"
                              disabled={busyAction === 'status'}
                              className="inline-flex h-9 items-center justify-center rounded-md bg-[#141416] px-3 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60 sm:col-span-2"
                            >
                              {busyAction === 'status' ? 'Saving...' : 'Update'}
                            </button>
                          </form>

                          {selectedProject.deliveryTime && (
                            <div className="mt-4 border-t border-[#E4E4E7] pt-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-[#141416]">
                                    Delivery Timeframe Review
                                  </p>
                                  <p className="text-[11px] text-[#5A5A62]">
                                    Requested: <strong>{selectedProject.deliveryTime}</strong> · Status:{' '}
                                    <span className="font-medium text-[#1D4ED8]">
                                      {selectedProject.deliveryTimeStatus || 'Pending Review'}
                                    </span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={busyAction !== null}
                                  onClick={() => void handleTimelineReview('Achievable as Requested')}
                                  className="inline-flex h-8 items-center rounded-md border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#141416] hover:border-[#1D4ED8] hover:text-[#1D4ED8] disabled:opacity-60"
                                >
                                  Confirm Achievable
                                </button>
                              </div>
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  value={confirmedTimelineInput}
                                  onChange={(e) => setConfirmedTimelineInput(e.target.value)}
                                  placeholder="Proposed realistic schedule (e.g., 5–7 days)"
                                  className="h-8 min-w-[200px] flex-1 rounded-md border border-[#D4D4D8] bg-white px-3 text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={busyAction !== null}
                                  onClick={() => void handleTimelineReview('Adjusted by Administrator')}
                                  className="inline-flex h-8 items-center rounded-md bg-[#141416] px-3 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                                >
                                  Adjust Schedule
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* USD Quotation Builder */}
                        <form
                          onSubmit={handleSendQuotation}
                          className="space-y-4 rounded-md border border-[#1D4ED8]/30 bg-[#FAFAFA] p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                              <h3 className="text-xs font-semibold text-[#141416]">
                                Formal USD Quotation Builder
                              </h3>
                            </div>
                            {selectedProject.quotation && (
                              <span className="font-mono text-[11px] text-[#5A5A62]">
                                Last sent {new Date(selectedProject.quotation.quotedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label htmlFor="adm-q-usd" className="block text-[11px] font-medium text-[#141416]">
                                Base Project Price (USD $)
                              </label>
                              <input
                                id="adm-q-usd"
                                type="number"
                                min="1"
                                step="any"
                                required
                                value={quoteUsd}
                                onChange={(e) => setQuoteUsd(e.target.value)}
                                placeholder="e.g. 1200"
                                className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] bg-white px-3 font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label htmlFor="adm-q-opt" className="block text-[11px] font-medium text-[#141416]">
                                Payment Structure
                              </label>
                              <select
                                id="adm-q-opt"
                                value={paymentOption}
                                onChange={(e) =>
                                  setPaymentOption(e.target.value === 'deposit' ? 'deposit' : 'full')
                                }
                                className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-xs"
                              >
                                <option value="full">Full Payment (100%)</option>
                                <option value="deposit">Deposit Payment</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor="adm-q-curr" className="block text-[11px] font-medium text-[#141416]">
                                Gateway Settlement Currency
                              </label>
                              <select
                                id="adm-q-curr"
                                value={settlementCurrency}
                                onChange={(e) => setSettlementCurrency(e.target.value)}
                                className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] bg-white px-3 text-xs"
                              >
                                {SETTLEMENT_CURRENCIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {paymentOption === 'deposit' && (
                            <div className="flex flex-wrap items-center gap-3">
                              <label
                                htmlFor="adm-q-pct"
                                className="text-[11px] font-medium text-[#141416]"
                              >
                                Deposit % (10–90%):
                              </label>
                              <input
                                id="adm-q-pct"
                                type="number"
                                min="10"
                                max="90"
                                value={depositPercent}
                                onChange={(e) => setDepositPercent(e.target.value)}
                                className="h-8 w-20 rounded-md border border-[#D4D4D8] bg-white px-2 font-mono text-xs"
                              />
                              <div className="flex gap-1.5">
                                {['30', '50', '70'].map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setDepositPercent(p)}
                                    className="rounded border border-[#E4E4E7] bg-white px-2 py-1 font-mono text-[11px] text-[#5A5A62] hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                                  >
                                    {p}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {validQuoteUsd > 0 && (
                            <div className="rounded-md border border-[#E4E4E7] bg-white p-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[#5A5A62]">
                                  Total Quote:{' '}
                                  <strong className="font-mono text-[#141416]">
                                    ${validQuoteUsd.toLocaleString()} USD
                                  </strong>
                                  {customerConvertedTotal?.isConverted && (
                                    <span className="ml-1.5 font-mono text-[#5A5A62]">
                                      (≈ {customerConvertedTotal.displayFormatted} for customer)
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono font-semibold text-[#1D4ED8]">
                                  Due Now: ${dueNowUsdPreview.toLocaleString()} USD
                                  {customerConvertedDue?.isConverted &&
                                    ` (≈ ${customerConvertedDue.displayFormatted})`}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                              <label
                                htmlFor="adm-q-summary"
                                className="block text-[11px] font-medium text-[#141416]"
                              >
                                Quotation Scope Summary
                              </label>
                              <textarea
                                id="adm-q-summary"
                                rows={2}
                                required
                                value={quoteSummary}
                                onChange={(e) => setQuoteSummary(e.target.value)}
                                placeholder="Describe scope, milestones, and payment terms..."
                                className="mt-1 w-full rounded-md border border-[#D4D4D8] bg-white p-2.5 text-xs"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="adm-q-valid"
                                className="block text-[11px] font-medium text-[#141416]"
                              >
                                Valid Until
                              </label>
                              <input
                                id="adm-q-valid"
                                type="date"
                                value={quoteValidUntil}
                                onChange={(e) => setQuoteValidUntil(e.target.value)}
                                className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] bg-white px-2.5 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="adm-q-deliv"
                              className="block text-[11px] font-medium text-[#141416]"
                            >
                              Included Deliverables (one per line)
                            </label>
                            <textarea
                              id="adm-q-deliv"
                              rows={3}
                              value={quoteDeliverables}
                              onChange={(e) => setQuoteDeliverables(e.target.value)}
                              placeholder="Custom UI/UX design&#10;Responsive frontend & backend setup&#10;Deployment & handover"
                              className="mt-1 w-full rounded-md border border-[#D4D4D8] bg-white p-2.5 text-xs"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={busyAction === 'quote'}
                            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1D4ED8] px-4 text-xs font-medium text-white hover:bg-[#141416] disabled:opacity-60"
                          >
                            {busyAction === 'quote' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {busyAction === 'quote'
                              ? 'Publishing Quotation...'
                              : selectedProject.quotation
                                ? 'Update & Send Quotation'
                                : 'Send Formal Quotation'}
                          </button>
                        </form>

                        {/* Customer Communication & Info Requests */}
                        <div className="space-y-3 rounded-md border border-[#E4E4E7] p-4">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                            <h3 className="text-xs font-semibold text-[#141416]">
                              Customer Updates &amp; Information Requests
                            </h3>
                          </div>

                          {selectedProject.updates && selectedProject.updates.length > 0 && (
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                              {selectedProject.updates.map((upd) => (
                                <div
                                  key={upd.id}
                                  className={`rounded-md border p-2.5 text-xs ${
                                    upd.senderRole === 'admin'
                                      ? 'border-[#1D4ED8]/25 bg-white'
                                      : 'border-[#E4E4E7] bg-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[#141416]">
                                      {upd.senderRole === 'admin' ? 'VERTYLEX Admin' : upd.senderName}
                                      {upd.requiresAction ? ' · Requested Info' : ''}
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
                          )}

                          <form onSubmit={handleSendCustomerMessage} className="space-y-2.5">
                            <textarea
                              rows={2}
                              value={customerMessage}
                              onChange={(e) => setCustomerMessage(e.target.value)}
                              placeholder="Send a project update or ask the customer for clarification..."
                              className="w-full rounded-md border border-[#D4D4D8] p-2.5 text-xs"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <label className="inline-flex items-center gap-2 text-xs text-[#141416]">
                                <input
                                  type="checkbox"
                                  checked={requestMoreInfo}
                                  onChange={(e) => setRequestMoreInfo(e.target.checked)}
                                  className="h-4 w-4 rounded border-[#D4D4D8] text-[#1D4ED8]"
                                />
                                Mark status as "More Information Required"
                              </label>
                              <button
                                type="submit"
                                disabled={busyAction === 'message' || !customerMessage.trim()}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#141416] px-3.5 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                              >
                                Send to Customer
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* Private Internal Notes (Hidden from Customer) */}
                        <div className="space-y-3 rounded-md border border-dashed border-[#D4D4D8] bg-[#FAFAFA] p-4">
                          <div className="flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 text-[#141416]" aria-hidden="true" />
                            <h3 className="text-xs font-semibold text-[#141416]">
                              Private Internal Notes (Admin-Only · Hidden from Customer)
                            </h3>
                          </div>

                          {selectedProject.internalNotes &&
                            selectedProject.internalNotes.length > 0 && (
                              <div className="space-y-2">
                                {selectedProject.internalNotes.map((note) => (
                                  <div
                                    key={note.id}
                                    className="rounded-md border border-[#E4E4E7] bg-white p-2.5 text-xs"
                                  >
                                    <p className="whitespace-pre-line text-[#141416]">{note.text}</p>
                                    <p className="mt-1 font-mono text-[10px] text-[#5A5A62]">
                                      {note.authorEmail} ·{' '}
                                      {new Date(note.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                          <form onSubmit={handleSaveInternalNote} className="flex gap-2">
                            <input
                              type="text"
                              value={internalNoteText}
                              onChange={(e) => setInternalNoteText(e.target.value)}
                              placeholder="Add a private note (pricing breakdown, vendor cost, review memo)..."
                              className="h-9 flex-1 rounded-md border border-[#D4D4D8] bg-white px-3 text-xs"
                            />
                            <button
                              type="submit"
                              disabled={busyAction === 'note' || !internalNoteText.trim()}
                              className="inline-flex h-9 items-center rounded-md border border-[#141416] bg-white px-3 text-xs font-medium text-[#141416] hover:bg-[#141416] hover:text-white disabled:opacity-50"
                            >
                              Save Note
                            </button>
                          </form>
                        </div>

                        {/* Project Payment History & Audit Log */}
                        {(selectedPayments.length > 0 ||
                          (selectedProject.auditLog && selectedProject.auditLog.length > 0)) && (
                          <div className="grid grid-cols-1 gap-4 border-t border-[#E4E4E7] pt-4 sm:grid-cols-2">
                            <div>
                              <h4 className="text-xs font-semibold text-[#141416]">
                                Payment Records ({selectedPayments.length})
                              </h4>
                              {selectedPayments.length === 0 ? (
                                <p className="mt-1.5 text-xs text-[#5A5A62]">No payments yet.</p>
                              ) : (
                                <ul className="mt-2 space-y-1.5 text-xs">
                                  {selectedPayments.map((pay) => (
                                    <li
                                      key={pay.id}
                                      className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2"
                                    >
                                      <p className="font-mono font-medium text-[#141416]">
                                        {pay.reference} · {pay.status.toUpperCase()}
                                      </p>
                                      <p className="text-[#5A5A62]">
                                        {formatCurrencyAmount(pay.amount, pay.currency)} via{' '}
                                        {pay.provider}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-[#141416]">
                                Audit Trail
                              </h4>
                              <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-[11px]">
                                {(selectedProject.auditLog || []).map((entry) => (
                                  <li
                                    key={entry.id}
                                    className="rounded border border-[#E4E4E7] bg-[#FAFAFA] p-2"
                                  >
                                    <p className="font-medium text-[#141416]">
                                      {entry.action}{' '}
                                      <span className="font-normal text-[#5A5A62]">
                                        ({entry.actorEmail})
                                      </span>
                                    </p>
                                    <p className="text-[#5A5A62]">{entry.details}</p>
                                    <p className="font-mono text-[10px] text-[#5A5A62]">
                                      {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
