import {ArrowRight, CheckCircle2, Headphones, Loader2, Mail} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {type SubmittedProjectSummary, useProjectDraft} from '../context/ProjectDraftContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {getMailtoUrl, VERTYLEX_EMAIL} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

export function ProjectConfirmationPage() {
  const {projectId} = useParams<{projectId: string}>();
  const {lastSubmitted} = useProjectDraft();
  const {convertQuotationAmount, formatCurrencyAmount} = useRegion();
  const {openAssistant} = useSupport();

  const [project, setProject] = useState<SubmittedProjectSummary | null>(
    lastSubmitted && lastSubmitted.id === projectId ? lastSubmitted : null,
  );
  const [loading, setLoading] = useState(!project);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project && project.id === projectId) {
      setLoading(false);
      return;
    }
    if (!projectId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId || '')}`);
        const data = (await res.json()) as {
          project?: SubmittedProjectSummary;
          error?: string;
        };
        if (!res.ok || !data.project) {
          throw new Error(data.error || 'Unable to load project confirmation.');
        }
        if (!cancelled) {
          setProject({...data.project, emailDelivered: false});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load confirmation.');
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
  }, [projectId, project]);

  if (loading) {
    return (
      <div className="bg-[#FAFAFA]">
        <ProjectJourneyStepper activeStep={4} />
        <div className="vtx-panel-enter mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-24 text-sm text-[#5A5A62] sm:px-6">
          <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
          <span>Loading submission confirmation...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-[#FAFAFA]">
        <ProjectJourneyStepper activeStep={4} />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <div className="rounded-lg border border-[#E4E4E7] bg-white p-8">
            <h1 className="font-display text-2xl font-bold text-[#141416]">
              Project confirmation unavailable
            </h1>
            <p className="mt-2 text-sm text-[#5A5A62]">
              {error || 'We could not find that project record.'}
            </p>
            <Link
              to="/account"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-[#141416] px-5 text-xs font-medium text-white"
            >
              Open Customer Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mailSubject = `Project Brief ${project.referenceId}: ${project.projectTitle}`;
  const mailBody = `Hello VERTYLEX,\n\nI submitted my project brief on the website:\nReference ID: ${project.referenceId}\nService: ${project.selectedService}\nTitle: ${project.projectTitle}`;

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={4} />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="vtx-panel-enter rounded-lg border border-[#E4E4E7] bg-white p-8 sm:p-10">
            <div className="flex items-center gap-2.5 text-[#1D4ED8]">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              <span className="font-mono text-xs font-medium">
                Step 4 · Brief Received for Quotation · {project.referenceId}
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold text-[#141416]">
              Your project has been submitted for quotation.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">
              Thank you, {project.fullName}. VERTYLEX has recorded your brief for{' '}
              <span className="font-medium text-[#141416]">{project.projectTitle}</span> under{' '}
              <span className="font-medium text-[#141416]">{project.selectedService}</span>.
              {project.emailDelivered
                ? ` A notification copy has also been sent to ${VERTYLEX_EMAIL}.`
                : ' Our team will review your requirements and publish an individual quotation directly inside your Customer Dashboard.'}
            </p>

            <dl className="mt-8 grid grid-cols-1 gap-4 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[#5A5A62]">Reference ID</dt>
                <dd className="mt-1 font-mono font-semibold text-[#141416]">
                  {project.referenceId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5A5A62]">Selected Service</dt>
                <dd className="mt-1 font-medium text-[#141416]">{project.selectedService}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5A5A62]">Quotation Status</dt>
                <dd className="mt-1 font-medium text-[#1D4ED8]">{project.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5A5A62]">Attached Files</dt>
                <dd className="mt-1 text-[#141416]">
                  {project.attachments && project.attachments.length > 0
                    ? `${project.attachments.length} file(s) uploaded`
                    : 'None'}
                </dd>
              </div>
              {project.deliveryTime && (
                <div className="sm:col-span-2 border-t border-[#E4E4E7] pt-3">
                  <dt className="text-xs text-[#5A5A62]">Requested Delivery Time</dt>
                  <dd className="mt-1 font-medium text-[#141416]">
                    {project.deliveryTime}{' '}
                    <span className="text-xs font-normal text-[#5A5A62]">
                      · Requested timeframe (pending administrator confirmation)
                    </span>
                  </dd>
                </div>
              )}
              {typeof project.budgetUsd === 'number' && (
                <div className="sm:col-span-2 border-t border-[#E4E4E7] pt-3">
                  <dt className="text-xs text-[#5A5A62]">
                    Intended Customer Budget Estimate (No charge until quotation approval)
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-[#141416] tabular-nums">
                    {formatCurrencyAmount(project.budgetUsd, 'USD')} USD
                    {convertQuotationAmount(
                      project.budgetUsd,
                      'USD',
                      project.preferredCurrency || project.budgetDisplayCurrency,
                    ).isConverted && (
                      <span className="ml-2 text-xs font-normal text-[#5A5A62]">
                        (≈{' '}
                        {
                          convertQuotationAmount(
                            project.budgetUsd,
                            'USD',
                            project.preferredCurrency || project.budgetDisplayCurrency,
                          ).displayFormatted
                        }
                        )
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-8 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-5">
              <h2 className="font-display text-sm font-semibold text-[#141416]">
                What Happens Next (Quotation &amp; Payment)
              </h2>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-[#5A5A62]">
                <li>
                  1. Our team reviews your requirements and prepares a tailored quotation based on
                  scope.
                </li>
                <li>
                  2. Once your quotation is published, review and approve it inside your Customer
                  Dashboard.
                </li>
                <li>
                  3. After accepting your quotation, proceed to secure checkout in your preferred
                  currency.
                </li>
              </ol>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={`/account?project=${encodeURIComponent(project.id)}`}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                Open Customer Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() =>
                  openAssistant(
                    `I just submitted project ${project.referenceId} (${project.projectTitle}) and would like to ask a question.`,
                  )
                }
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                Ask VERTYLEX Support
              </button>
              <a
                href={getMailtoUrl(mailSubject, mailBody)}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                <Mail className="h-4 w-4 text-[#5A5A62]" aria-hidden="true" />
                Email Copy
              </a>
            </div>

            <div className="mt-8 border-t border-[#E4E4E7] pt-6">
              <Link
                to="/submit-project"
                className="text-sm font-medium text-[#5A5A62] hover:text-[#141416]"
              >
                Start another project →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
