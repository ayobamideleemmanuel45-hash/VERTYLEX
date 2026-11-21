import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {useState} from 'react';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {RegionSelector} from '../components/RegionSelector';
import {useAuth} from '../context/AuthContext';
import {
  type SubmittedProjectSummary,
  useProjectDraft,
} from '../context/ProjectDraftContext';
import {useRegion} from '../context/RegionContext';
import {getServiceBudgetConfig, isValidDeliveryTime} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

const DETAIL_LABELS: Record<string, string> = {
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProjectReviewPage() {
  const navigate = useNavigate();
  const {user, refreshUser} = useAuth();
  const {region, convertQuotationAmount, formatCurrencyAmount} = useRegion();
  const {draft, attachments, setLastSubmitted, resetDraft} = useProjectDraft();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!draft.selectedService) {
    return <Navigate to="/submit-project" replace />;
  }

  const budgetConfig = getServiceBudgetConfig(draft.selectedService);
  const resolvedBudgetUsd = budgetConfig
    ? typeof draft.budgetUsd === 'number' &&
      budgetConfig.options.some((opt) => opt.amountUsd === Math.round(draft.budgetUsd!))
      ? Math.round(draft.budgetUsd)
      : budgetConfig.recommendedUsd
    : undefined;
  const convertedBudget =
    resolvedBudgetUsd !== undefined ? convertQuotationAmount(resolvedBudgetUsd, 'USD') : null;
  const effectiveDeliveryTime =
    draft.deliveryTime ||
    (typeof draft.serviceDetails.deliveryTime === 'string' ? draft.serviceDetails.deliveryTime : '');
  const hasValidDeliveryTime = isValidDeliveryTime(effectiveDeliveryTime);

  const detailEntries = Object.entries(draft.serviceDetails).filter(([key, value]) => {
    if (key === 'deliveryTime') return false;
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;
  });

  const resolvedTitle =
    draft.projectTitle.trim() ||
    (draft.businessName.trim()
      ? `${draft.selectedService} for ${draft.businessName.trim()}`
      : `${draft.selectedService} Project`);

  function compileIdeaDescription(): string {
    const lines: string[] = [];
    if (draft.businessName.trim()) {
      lines.push(`Business / Brand Name: ${draft.businessName.trim()}`);
    }
    if (effectiveDeliveryTime) {
      lines.push(`Requested Delivery Time: ${effectiveDeliveryTime}`);
    }
    for (const [key, value] of detailEntries) {
      const label = DETAIL_LABELS[key] || key;
      const formatted = Array.isArray(value) ? value.join(', ') : value.trim();
      lines.push(`${label}: ${formatted}`);
    }
    return lines.join('\n\n') || resolvedTitle;
  }

  async function handleConfirmSubmission() {
    if (submitting) return;
    setSubmitError('');

    if (!hasValidDeliveryTime) {
      setSubmitError(
        'Please select your requested delivery time on the Project Requirements page before submitting.',
      );
      return;
    }

    const currentUser = user || (await refreshUser());
    if (!currentUser) {
      navigate('/login?redirect=%2Fsubmit-project%2Freview&reason=project');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fullName: currentUser.name,
          email: currentUser.email,
          businessName: draft.businessName.trim(),
          selectedService: draft.selectedService,
          projectTitle: resolvedTitle,
          ideaDescription: compileIdeaDescription(),
          budgetRange:
            budgetConfig && resolvedBudgetUsd !== undefined
              ? resolvedBudgetUsd === budgetConfig.recommendedUsd
                ? `$${resolvedBudgetUsd.toLocaleString()} USD (Recommended)`
                : `$${resolvedBudgetUsd.toLocaleString()} USD (Customer Budget Estimate)`
              : draft.budgetRange,
          ...(resolvedBudgetUsd !== undefined ? {budgetUsd: resolvedBudgetUsd} : {}),
          deliveryTime: effectiveDeliveryTime,
          additionalRequirements: draft.additionalRequirements.trim(),
          serviceDetails: draft.serviceDetails,
          attachments: attachments.map((file) => ({
            name: file.name,
            mimeType: file.mimeType,
            dataBase64: file.dataBase64,
          })),
          idempotencyKey: draft.idempotencyKey,
          countryCode: currentUser.countryCode,
          countryName: currentUser.countryName,
          stateRegion: currentUser.stateRegion,
          preferredRegion: currentUser.countryName
            ? currentUser.stateRegion
              ? `${currentUser.countryName} (${currentUser.stateRegion})`
              : currentUser.countryName
            : region.country,
          preferredCurrency: region.currency,
        }),
      });

      const data = (await res.json()) as {
        project?: SubmittedProjectSummary;
        emailDelivered?: boolean;
        error?: string;
      };

      if (res.status === 401) {
        await refreshUser();
        navigate('/login?redirect=%2Fsubmit-project%2Freview&reason=project');
        return;
      }

      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to submit your project right now.');
      }

      const confirmed: SubmittedProjectSummary = {
        ...data.project,
        emailDelivered: Boolean(data.emailDelivered),
      };
      setLastSubmitted(confirmed);
      resetDraft();
      navigate(`/submit-project/confirmation/${encodeURIComponent(confirmed.id)}`, {
        replace: true,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit project.');
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={3} />

      <section className="border-b border-[#E4E4E7] bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/submit-project/requirements"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Requirements
          </Link>
          <p className="mt-4 text-sm font-medium text-[#1D4ED8]">
            Step 3 · Review Your Project
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#141416] sm:text-4xl [text-wrap:balance]">
            Review your details before requesting a quotation.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
            Confirm your selected service, requirements, and any attached files. You can go back to
            edit any section without losing your entries.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="vtx-panel-enter space-y-6 rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-10">
            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {submitError}
              </div>
            )}

            {/* Selected Service Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E4E7] pb-6">
              <div>
                <p className="text-xs font-medium text-[#5A5A62]">Selected Service</p>
                <h2 className="mt-1 font-display text-xl font-bold text-[#141416]">
                  {draft.selectedService}
                </h2>
              </div>
              <Link
                to="/submit-project"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 text-xs font-medium text-[#141416] hover:border-[#141416]"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Change Service
              </Link>
            </div>

            {/* Project Title & Client Details */}
            <div className="grid grid-cols-1 gap-6 border-b border-[#E4E4E7] pb-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#5A5A62]">Project Title</p>
                <p className="mt-1 text-sm font-semibold text-[#141416]">{resolvedTitle}</p>
              </div>
              <div>
                <p className="text-xs text-[#5A5A62]">Business / Brand Name</p>
                <p className="mt-1 text-sm text-[#141416]">
                  {draft.businessName.trim() || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5A5A62]">Customer Account</p>
                <p className="mt-1 text-sm text-[#141416]">
                  {user?.name} ({user?.email})
                </p>
              </div>
              <div>
                <RegionSelector compact />
              </div>
            </div>

            {/* Entered Requirements */}
            <div className="border-b border-[#E4E4E7] pb-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-base font-semibold text-[#141416]">
                  Submitted Requirements
                </h3>
                <Link
                  to="/submit-project/requirements"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Requirements
                </Link>
              </div>

              <dl className="mt-5 space-y-4">
                {detailEntries.map(([key, value]) => (
                  <div key={key} className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                    <dt className="text-xs font-medium text-[#5A5A62]">
                      {DETAIL_LABELS[key] || key}
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-[#141416] whitespace-pre-line">
                      {Array.isArray(value) ? value.join(', ') : value}
                    </dd>
                  </div>
                ))}

                {budgetConfig && resolvedBudgetUsd !== undefined ? (
                  <div className="rounded-md border border-[#1D4ED8]/25 bg-[#1D4ED8]/[0.03] p-4">
                    <dt className="text-xs font-semibold text-[#1D4ED8]">
                      Customer Intended Budget Estimate (Not an Upfront Charge)
                    </dt>
                    <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-base font-bold text-[#141416] tabular-nums">
                        {formatCurrencyAmount(resolvedBudgetUsd, 'USD')} USD
                      </span>
                      {convertedBudget?.isConverted && (
                        <span className="font-mono text-sm font-medium text-[#1D4ED8] tabular-nums">
                          ≈ {convertedBudget.displayFormatted} ({convertedBudget.displayCurrency})
                        </span>
                      )}
                      {resolvedBudgetUsd === budgetConfig.recommendedUsd && (
                        <span className="text-xs font-medium text-[#1D4ED8]">
                          · Matches VERTYLEX Recommended Budget
                        </span>
                      )}
                    </dd>
                    <p className="mt-1 text-xs text-[#5A5A62]">
                      Official recommended budget for {budgetConfig.serviceTitle}:{' '}
                      {formatCurrencyAmount(budgetConfig.recommendedUsd, 'USD')} USD. VERTYLEX will
                      review your requirements and issue an official USD quotation before any
                      payment.
                    </p>
                  </div>
                ) : (
                  draft.budgetRange && (
                    <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                      <dt className="text-xs font-medium text-[#5A5A62]">Budget Preference</dt>
                      <dd className="mt-1 text-sm text-[#141416]">{draft.budgetRange}</dd>
                    </div>
                  )
                )}

                <div
                  className={`rounded-md border p-4 ${
                    hasValidDeliveryTime
                      ? 'border-[#E4E4E7] bg-[#FAFAFA]'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <dt className="text-xs font-medium text-[#5A5A62]">Requested Delivery Time</dt>
                  <dd className="mt-1 text-sm font-semibold text-[#141416]">
                    {hasValidDeliveryTime
                      ? effectiveDeliveryTime
                      : 'Not selected yet — please go back and choose a delivery timeframe.'}
                  </dd>
                  <p className="mt-1 text-xs text-[#5A5A62]">
                    Requested timeframe only, not a guaranteed completion date. A VERTYLEX
                    administrator will review your brief and confirm whether this schedule is
                    achievable.
                  </p>
                </div>

                {draft.additionalRequirements.trim() && (
                  <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                    <dt className="text-xs font-medium text-[#5A5A62]">Additional Requirements</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#141416] whitespace-pre-line">
                      {draft.additionalRequirements.trim()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Attached Files */}
            <div className="border-b border-[#E4E4E7] pb-6">
              <h3 className="font-display text-base font-semibold text-[#141416]">
                Attached Files ({attachments.length})
              </h3>
              {attachments.length === 0 ? (
                <p className="mt-2 text-xs text-[#5A5A62]">No files attached.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {attachments.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-xs"
                    >
                      <FileText className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                      <span className="font-medium text-[#141416]">{file.name}</span>
                      <span className="font-mono text-[#5A5A62] tabular-nums">
                        ({formatFileSize(file.size)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quotation Notice */}
            <div className="flex items-start gap-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-[#5A5A62]">
                <span className="font-semibold text-[#141416]">No upfront charge:</span> Submitting
                your brief sends it directly to the VERTYLEX review desk. Our team will evaluate your
                requirements and publish an official quotation in your Customer Dashboard for your
                approval before payment.
              </p>
            </div>

            {/* Navigation & Submit */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Link
                to="/submit-project/requirements"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Go Back &amp; Edit
              </Link>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmSubmission()}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? 'Submitting Project...' : 'Submit Project for Quotation'}
                {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
