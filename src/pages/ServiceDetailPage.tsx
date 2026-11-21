import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Headphones,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {DeliveryTimeSelector} from '../components/DeliveryTimeSelector';
import {MediaFrame} from '../components/MediaFrame';
import {RevealSection} from '../components/RevealSection';
import {ServiceBudgetSelector} from '../components/ServiceBudgetSelector';
import {useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {
  getMailtoUrl,
  getOfficialWhatsAppUrl,
  getServiceBudgetConfig,
  isValidDeliveryTime,
  SERVICE_CATEGORIES,
  VERTYLEX_EMAIL,
  WEBSITE_TYPES,
} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

interface WebsiteRequestConfirmation {
  projectId: string;
  referenceId: string;
  projectTitle: string;
  websiteType: string;
  emailDelivered: boolean;
}

export function ServiceDetailPage() {
  const {slug} = useParams<{slug: string}>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {user, loading: authLoading, refreshUser} = useAuth();
  const {region} = useRegion();
  const {integrations, openAssistant} = useSupport();

  const service = SERVICE_CATEGORIES.find((item) => item.slug === slug);
  const serviceBudgetConfig = getServiceBudgetConfig(service?.slug || service?.title);
  const websiteBudgetConfig = getServiceBudgetConfig('Website Development')!;

  const initialWebsiteType = searchParams.get('websiteType') || '';
  const validInitialType = WEBSITE_TYPES.some((item) => item.id === initialWebsiteType)
    ? initialWebsiteType
    : WEBSITE_TYPES[0].id;

  const [selectedWebsiteType, setSelectedWebsiteType] = useState<string>(validInitialType);
  const [websiteBudgetUsd, setWebsiteBudgetUsd] = useState<number>(
    websiteBudgetConfig.recommendedUsd,
  );
  const [detailBudgetUsd, setDetailBudgetUsd] = useState<number>(
    serviceBudgetConfig?.recommendedUsd ?? 0,
  );
  const [selectedDeliveryTime, setSelectedDeliveryTime] = useState<string>('');
  const [businessOrBrandName, setBusinessOrBrandName] = useState('');
  const [websiteDescription, setWebsiteDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [deliveryTimeError, setDeliveryTimeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<WebsiteRequestConfirmation | null>(null);
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem('vertylex_website_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as {
          selectedWebsiteType?: string;
          websiteBudgetUsd?: number;
          selectedDeliveryTime?: string;
          businessOrBrandName?: string;
          websiteDescription?: string;
        };
        if (
          !initialWebsiteType &&
          draft.selectedWebsiteType &&
          WEBSITE_TYPES.some((item) => item.id === draft.selectedWebsiteType)
        ) {
          setSelectedWebsiteType(draft.selectedWebsiteType);
        }
        if (
          typeof draft.websiteBudgetUsd === 'number' &&
          websiteBudgetConfig.options.some((opt) => opt.amountUsd === Math.round(draft.websiteBudgetUsd!))
        ) {
          setWebsiteBudgetUsd(Math.round(draft.websiteBudgetUsd));
        }
        if (draft.selectedDeliveryTime && isValidDeliveryTime(draft.selectedDeliveryTime)) {
          setSelectedDeliveryTime(draft.selectedDeliveryTime);
        }
        if (draft.businessOrBrandName) setBusinessOrBrandName(draft.businessOrBrandName);
        if (draft.websiteDescription) setWebsiteDescription(draft.websiteDescription);
      }
    } catch {
      // Ignore storage errors
    }
  }, [initialWebsiteType, websiteBudgetConfig]);

  useEffect(() => {
    if (initialWebsiteType && WEBSITE_TYPES.some((item) => item.id === initialWebsiteType)) {
      setSelectedWebsiteType(initialWebsiteType);
    }
  }, [initialWebsiteType]);

  useEffect(() => {
    if (serviceBudgetConfig) {
      setDetailBudgetUsd(serviceBudgetConfig.recommendedUsd);
    }
  }, [service?.slug, serviceBudgetConfig]);

  if (!service) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold text-[#141416]">Service not found</h1>
        <p className="mt-3 text-sm text-[#5A5A62]">
          The service page you requested is unavailable. Browse all VERTYLEX services below.
        </p>
        <Link
          to="/services"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#141416] px-5 text-sm font-medium text-white"
        >
          Back to All Services
        </Link>
      </div>
    );
  }

  const isWebsiteService = service.slug === 'website-development';
  const otherServices = SERVICE_CATEGORIES.filter((s) => s.slug !== service.slug);
  const officialWaUrl = integrations.whatsapp.configured
    ? getOfficialWhatsAppUrl(
        integrations.whatsapp.officialUrl,
        `Hello VERTYLEX, I'm interested in your ${service.title} service.`,
      )
    : null;

  function handleUnauthenticatedBuildClick() {
    try {
      sessionStorage.setItem(
        'vertylex_website_draft',
        JSON.stringify({
          selectedWebsiteType,
          websiteBudgetUsd,
          selectedDeliveryTime,
          businessOrBrandName: businessOrBrandName.trim(),
          websiteDescription: websiteDescription.trim(),
        }),
      );
    } catch {
      // Ignore storage errors
    }
    const returnParams = new URLSearchParams({websiteType: selectedWebsiteType});
    const target = `/services/website-development?${returnParams.toString()}#build-website`;
    const loginParams = new URLSearchParams({
      redirect: target,
      reason: 'project',
    });
    navigate(`/login?${loginParams.toString()}`);
  }

  async function handleWebsiteRequestSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setDeliveryTimeError('');

    if (!user) {
      handleUnauthenticatedBuildClick();
      return;
    }

    if (!selectedDeliveryTime || !isValidDeliveryTime(selectedDeliveryTime)) {
      setDeliveryTimeError(
        'Please select your requested delivery timeframe before submitting your request.',
      );
      setFormError('Please select a requested delivery timeframe above.');
      return;
    }

    if (websiteDescription.trim().length < 20) {
      setFormError(
        'Please describe your preferred website, its purpose, and the features you need (at least 20 characters).',
      );
      return;
    }

    setSubmitting(true);
    try {
      const cleanBrand = businessOrBrandName.trim();
      const projectTitle = cleanBrand
        ? `${selectedWebsiteType} for ${cleanBrand}`
        : `${selectedWebsiteType} Request`;
      const composedDescription = [
        `Website Type: ${selectedWebsiteType}`,
        cleanBrand ? `Business / Brand / Project: ${cleanBrand}` : '',
        `Requested Delivery Time: ${selectedDeliveryTime}`,
        '',
        'Preferred Website, Purpose & Required Features:',
        websiteDescription.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      const formattedBudgetLabel =
        websiteBudgetUsd === websiteBudgetConfig.recommendedUsd
          ? `$${websiteBudgetUsd.toLocaleString()} USD (Recommended)`
          : `$${websiteBudgetUsd.toLocaleString()} USD (Customer Budget Estimate)`;

      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fullName: user.name,
          email: user.email,
          countryCode: user.countryCode,
          countryName: user.countryName,
          stateRegion: user.stateRegion,
          businessName: cleanBrand,
          selectedService: 'Website Development',
          projectTitle,
          ideaDescription: composedDescription,
          budgetUsd: websiteBudgetUsd,
          budgetRange: formattedBudgetLabel,
          deliveryTime: selectedDeliveryTime,
          additionalRequirements: `Website category selected: ${selectedWebsiteType}`,
          serviceDetails: {
            websiteType: selectedWebsiteType,
            deliveryTime: selectedDeliveryTime,
            websitePurpose: websiteDescription.trim(),
          },
          idempotencyKey: idempotencyKeyRef.current,
          preferredRegion: user.countryName
            ? user.stateRegion
              ? `${user.countryName} (${user.stateRegion})`
              : user.countryName
            : region.country,
          preferredCurrency: region.currency,
        }),
      });

      const data = (await res.json()) as {
        project?: {id: string; referenceId: string; projectTitle: string};
        emailDelivered?: boolean;
        error?: string;
      };

      if (res.status === 401) {
        try {
          sessionStorage.setItem(
            'vertylex_website_draft',
            JSON.stringify({
              selectedWebsiteType,
              websiteBudgetUsd,
              selectedDeliveryTime,
              businessOrBrandName: businessOrBrandName.trim(),
              websiteDescription: websiteDescription.trim(),
            }),
          );
        } catch {
          // Ignore storage errors
        }
        await refreshUser();
        handleUnauthenticatedBuildClick();
        return;
      }

      if (!res.ok || !data.project) {
        throw new Error(data.error || 'Unable to submit your website development request.');
      }

      try {
        sessionStorage.removeItem('vertylex_website_draft');
      } catch {
        // Ignore storage errors
      }
      setConfirmation({
        projectId: data.project.id,
        referenceId: data.project.referenceId,
        projectTitle: data.project.projectTitle,
        websiteType: selectedWebsiteType,
        emailDelivered: Boolean(data.emailDelivered),
      });
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setWebsiteDescription('');
      setBusinessOrBrandName('');
      setSelectedDeliveryTime('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit your website request right now.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Services
          </Link>

          <div className="mt-8 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                Service Category {service.index}
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
                {service.title}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
                {service.overview}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={`/submit-project/requirements?service=${encodeURIComponent(service.title)}&budgetUsd=${isWebsiteService ? websiteBudgetUsd : detailBudgetUsd}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Request This Service
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    openAssistant(`I would like to know more about VERTYLEX ${service.title}.`)
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#D4D4D8] bg-white px-5 text-sm font-medium text-[#141416] transition-colors duration-150 hover:border-[#141416] whitespace-nowrap"
                >
                  <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  Ask VERTYLEX Assistant
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <MediaFrame
                src={service.image}
                alt={service.imageAlt}
                aspectClass="aspect-[4/3]"
                className="rounded-lg"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {isWebsiteService && (
        <section
          id="build-website"
          className="border-b border-[#E4E4E7] bg-[#FAFAFA] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-10">
              <div className="max-w-3xl">
                <p className="text-sm font-medium text-[#1D4ED8]">
                  Build a Website for Your Business
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#141416] sm:text-4xl [text-wrap:balance]">
                  Give Your Business a Website of Its Own.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[#5A5A62] sm:text-base">
                  VERTYLEX helps individuals, brands, organisations, and businesses develop
                  professional websites that clearly present who you are, showcase your products
                  and services, and establish a credible online presence built for real customers.
                </p>
              </div>

              {confirmation ? (
                <div className="mt-8 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-6 sm:p-8">
                  <div className="flex items-center gap-2.5 text-[#1D4ED8]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <span className="font-mono text-xs font-medium">
                      Website Request Recorded · {confirmation.referenceId}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold text-[#141416]">
                    Your website development request has been submitted.
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                    VERTYLEX has saved your{' '}
                    <span className="font-medium text-[#141416]">{confirmation.websiteType}</span>{' '}
                    brief under reference{' '}
                    <span className="font-mono font-medium text-[#141416]">
                      {confirmation.referenceId}
                    </span>
                    . Our team will review your requirements and prepare a quotation in your
                    Customer Dashboard.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      to={`/account?project=${encodeURIComponent(confirmation.projectId)}`}
                      className="inline-flex h-11 items-center justify-center rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
                    >
                      View in Customer Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        openAssistant(
                          `I just submitted website request ${confirmation.referenceId} (${confirmation.websiteType}).`,
                        )
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
                    >
                      <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                      Ask VERTYLEX Support
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmation(null)}
                      className="text-sm font-medium text-[#5A5A62] hover:text-[#141416]"
                    >
                      Submit another website request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWebsiteRequestSubmit} noValidate className="mt-8">
                  <div>
                    <p className="text-sm font-semibold text-[#141416]">
                      1. Select the type of website you want
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {WEBSITE_TYPES.map((option) => {
                        const isSelected = selectedWebsiteType === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedWebsiteType(option.id)}
                            aria-pressed={isSelected}
                            className={`flex flex-col justify-between rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99] ${
                              isSelected
                                ? 'scale-[1.01] border-[#1D4ED8] bg-[#1D4ED8]/[0.04] ring-1 ring-[#1D4ED8]/20 shadow-xs'
                                : 'border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#141416] hover:bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`font-display text-sm font-semibold transition-colors duration-150 ${
                                    isSelected ? 'text-[#1D4ED8]' : 'text-[#141416]'
                                  }`}
                                >
                                  {option.title}
                                </span>
                                {isSelected && (
                                  <Check
                                    className="vtx-pop-in h-4 w-4 shrink-0 text-[#1D4ED8]"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-[#5A5A62]">
                                {option.summary}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-[#E4E4E7] pt-8">
                    <p className="mb-4 text-sm font-semibold text-[#141416]">
                      2. Choose your intended website budget
                    </p>
                    <ServiceBudgetSelector
                      config={websiteBudgetConfig}
                      valueUsd={websiteBudgetUsd}
                      onChangeUsd={setWebsiteBudgetUsd}
                    />
                  </div>

                  <div className="mt-8 border-t border-[#E4E4E7] pt-8">
                    <DeliveryTimeSelector
                      stepPrefix="3."
                      value={selectedDeliveryTime}
                      onChange={(val) => {
                        setSelectedDeliveryTime(val);
                        setDeliveryTimeError('');
                      }}
                      error={deliveryTimeError}
                    />
                  </div>

                  <div className="mt-8 border-t border-[#E4E4E7] pt-8">
                    {authLoading ? (
                      <p className="text-sm text-[#5A5A62]">Checking your session...</p>
                    ) : !user ? (
                      <div className="flex flex-col justify-between gap-6 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-6 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-3">
                          <Lock
                            className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-sm font-semibold text-[#141416]">
                              Selected: {selectedWebsiteType}
                            </p>
                            <p className="mt-1 text-sm text-[#5A5A62]">
                              Sign in or create an account to describe your preferred website, its
                              purpose, and the features you need.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleUnauthenticatedBuildClick}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap shrink-0"
                        >
                          Build My Website
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {formError && (
                          <div
                            role="alert"
                            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                          >
                            {formError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="website-brand-name"
                              className="block text-sm font-medium text-[#141416]"
                            >
                              Business, brand, organisation, or project name{' '}
                              <span className="text-xs font-normal text-[#5A5A62]">(Optional)</span>
                            </label>
                            <input
                              id="website-brand-name"
                              type="text"
                              value={businessOrBrandName}
                              onChange={(e) => setBusinessOrBrandName(e.target.value)}
                              placeholder="e.g., Horizon Retail or Personal Portfolio"
                              className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] placeholder:text-[#A1A1AA] focus:border-[#1D4ED8] focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="block text-sm font-medium text-[#141416]">
                              Selected website type
                            </span>
                            <div className="mt-2 flex h-11 items-center rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 text-sm font-medium text-[#141416]">
                              {selectedWebsiteType}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="website-features-description"
                            className="block text-sm font-medium text-[#141416]"
                          >
                            4. Describe your preferred website, its purpose, and the features you
                            need <span className="text-red-600">*</span>
                          </label>
                          <p className="mt-1 text-xs text-[#5A5A62]">
                            Tell us what your website should communicate, pages you want (such as
                            About, Services, Store, Booking, or Contact), and any features or style
                            preferences.
                          </p>
                          <textarea
                            id="website-features-description"
                            rows={5}
                            value={websiteDescription}
                            onChange={(e) => setWebsiteDescription(e.target.value)}
                            placeholder="Explain what your website is for, what products or services it will showcase, and the features you need..."
                            className="mt-2 w-full rounded-md border border-[#D4D4D8] bg-white p-3.5 text-sm leading-relaxed text-[#141416] placeholder:text-[#A1A1AA] focus:border-[#1D4ED8] focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E4E4E7] pt-6">
                          <p className="text-xs text-[#5A5A62]">
                            Submitting as {user.name} · Preferred currency: {region.currency}
                          </p>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                          >
                            {submitting && (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            )}
                            {submitting ? 'Submitting Request...' : 'Build My Website'}
                            {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {!isWebsiteService && serviceBudgetConfig && (
        <section className="border-b border-[#E4E4E7] bg-[#FAFAFA] py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-[#1D4ED8]">
                    Service Budget Selection
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#141416] sm:text-3xl">
                    Select Your Intended {serviceBudgetConfig.serviceTitle} Budget
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5A5A62]">
                    Choose the budget option that best matches your intended scope. Live local
                    currency equivalents update automatically for your country, and your selection
                    carries straight into your project brief.
                  </p>
                </div>
                <Link
                  to={`/submit-project/requirements?service=${encodeURIComponent(service.title)}&budgetUsd=${detailBudgetUsd}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Continue With This Budget
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-6">
                <ServiceBudgetSelector
                  config={serviceBudgetConfig}
                  valueUsd={detailBudgetUsd}
                  onChangeUsd={setDetailBudgetUsd}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-16 sm:py-20">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <h2 className="font-display text-2xl font-bold text-[#141416]">
                What Is Included in {service.title}
              </h2>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {service.offerings.map((item, idx) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-[#E4E4E7] bg-white p-6"
                  >
                    <span className="font-mono text-xs text-[#5A5A62] tabular-nums">
                      0{idx + 1}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-semibold text-[#141416]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-lg border border-[#E4E4E7] bg-white p-8">
                <h3 className="font-display text-xl font-semibold text-[#141416]">
                  Who This Service Is Designed For
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">{service.idealFor}</p>
              </div>
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-lg border border-[#E4E4E7] bg-white p-6">
                <h3 className="font-display text-lg font-semibold text-[#141416]">
                  Typical Deliverables
                </h3>
                <ul className="mt-4 space-y-3">
                  {service.deliverables.map((deliverable) => (
                    <li
                      key={deliverable}
                      className="flex items-start gap-3 text-sm text-[#5A5A62]"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]"
                        aria-hidden="true"
                      />
                      <span>{deliverable}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[#E4E4E7] bg-white p-6">
                <h3 className="font-display text-lg font-semibold text-[#141416]">
                  Start With VERTYLEX
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                  Submit your requirements first, receive a tailored quotation, and pay only once
                  you approve the proposal.
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <Link
                    to={`/submit-project/requirements?service=${encodeURIComponent(service.title)}&budgetUsd=${isWebsiteService ? websiteBudgetUsd : detailBudgetUsd}`}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-[#141416] px-4 text-sm font-medium text-white hover:bg-[#1D4ED8]"
                  >
                    Submit Project Brief
                  </Link>
                  {officialWaUrl && (
                    <a
                      href={officialWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416] hover:border-[#141416]"
                    >
                      Official WhatsApp Business
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                  <a
                    href={getMailtoUrl(`Service Enquiry: ${service.title}`)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416] hover:border-[#141416]"
                  >
                    <Mail className="h-4 w-4 text-[#5A5A62]" aria-hidden="true" />
                    {VERTYLEX_EMAIL}
                  </a>
                </div>
              </div>
            </aside>
          </div>

          {/* Other Services Strip */}
          <div className="mt-16 border-t border-[#E4E4E7] pt-12">
            <h2 className="font-display text-xl font-bold text-[#141416]">
              Explore Other VERTYLEX Services
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {otherServices.map((other) => (
                <Link
                  key={other.slug}
                  to={`/services/${other.slug}`}
                  className="rounded-lg border border-[#E4E4E7] bg-white p-4 transition-colors duration-150 hover:border-[#141416]"
                >
                  <span className="font-mono text-xs text-[#5A5A62] tabular-nums">
                    {other.index}
                  </span>
                  <h3 className="mt-1 font-display text-sm font-semibold text-[#141416]">
                    {other.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
