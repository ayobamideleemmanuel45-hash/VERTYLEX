import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Headphones,
  Paperclip,
  Trash2,
} from 'lucide-react';
import {useEffect, useRef, useState, type ChangeEvent, type FormEvent} from 'react';
import {Link, Navigate, useNavigate, useSearchParams} from 'react-router-dom';
import {DeliveryTimeSelector} from '../components/DeliveryTimeSelector';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {RegionSelector} from '../components/RegionSelector';
import {ServiceBudgetSelector} from '../components/ServiceBudgetSelector';
import {useAuth} from '../context/AuthContext';
import {type DraftAttachment, useProjectDraft} from '../context/ProjectDraftContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {
  BUDGET_RANGES,
  getServiceBudgetConfig,
  isValidDeliveryTime,
  MOBILE_FEATURE_OPTIONS,
  normalizeToOrderService,
  WEBSITE_FEATURE_OPTIONS,
  WEBSITE_TYPES,
} from '../data/vertylex';

const MAX_FILES = 4;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export function ProjectRequirementsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {user} = useAuth();
  const {region, convertQuotationAmount, formatCurrencyAmount} = useRegion();
  const {openAssistant} = useSupport();
  const {
    draft,
    attachments,
    setSelectedService,
    updateField,
    setDetail,
    toggleMultiDetail,
    addAttachments,
    removeAttachment,
  } = useProjectDraft();

  const paramService = normalizeToOrderService(searchParams.get('service'));
  const paramBudgetRaw = searchParams.get('budgetUsd');
  const activeService = paramService || draft.selectedService;
  const budgetConfig = getServiceBudgetConfig(activeService);
  const appliedBudgetQueryRef = useRef<string>('');

  useEffect(() => {
    if (paramService && paramService !== draft.selectedService) {
      setSelectedService(paramService);
    }
  }, [paramService, draft.selectedService, setSelectedService]);

  useEffect(() => {
    if (!budgetConfig || !paramBudgetRaw || !activeService) return;
    if (draft.selectedService !== activeService) return;
    const queryKey = `${activeService}::${paramBudgetRaw}`;
    if (appliedBudgetQueryRef.current === queryKey) return;
    appliedBudgetQueryRef.current = queryKey;

    const parsed = Number(paramBudgetRaw);
    if (!Number.isFinite(parsed)) return;
    const rounded = Math.round(parsed);
    if (budgetConfig.options.some((opt) => opt.amountUsd === rounded)) {
      updateField('budgetUsd', rounded);
      updateField(
        'budgetRange',
        rounded === budgetConfig.recommendedUsd
          ? `$${rounded.toLocaleString()} USD (Recommended)`
          : `$${rounded.toLocaleString()} USD (Customer Budget Estimate)`,
      );
    }
  }, [activeService, budgetConfig, draft.selectedService, paramBudgetRaw, updateField]);

  const effectiveBudgetUsd = budgetConfig
    ? typeof draft.budgetUsd === 'number' &&
      budgetConfig.options.some((opt) => opt.amountUsd === Math.round(draft.budgetUsd!))
      ? Math.round(draft.budgetUsd)
      : budgetConfig.recommendedUsd
    : undefined;

  useEffect(() => {
    if (!budgetConfig || effectiveBudgetUsd === undefined) return;
    if (draft.selectedService !== activeService) return;
    if (draft.budgetUsd !== effectiveBudgetUsd) {
      updateField('budgetUsd', effectiveBudgetUsd);
      updateField(
        'budgetRange',
        effectiveBudgetUsd === budgetConfig.recommendedUsd
          ? `$${effectiveBudgetUsd.toLocaleString()} USD (Recommended)`
          : `$${effectiveBudgetUsd.toLocaleString()} USD (Customer Budget Estimate)`,
      );
    }
  }, [activeService, budgetConfig, draft.budgetUsd, draft.selectedService, effectiveBudgetUsd, updateField]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState('');

  if (!activeService) {
    return <Navigate to="/submit-project" replace />;
  }

  const getDetailStr = (key: string): string => {
    const val = draft.serviceDetails[key];
    return typeof val === 'string' ? val : '';
  };

  const getDetailList = (key: string): string[] => {
    const val = draft.serviceDetails[key];
    return Array.isArray(val) ? val : [];
  };

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError('');
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_FILES) {
      setFileError(`You can attach up to ${MAX_FILES} files per project.`);
      return;
    }

    const prepared: DraftAttachment[] = [];
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setFileError(
          `"${file.name}" is not a supported format. Allowed: PNG, JPG, WEBP, PDF, DOC, DOCX, TXT.`,
        );
        return;
      }
      if (file.size === 0 || file.size > MAX_FILE_BYTES) {
        setFileError(`"${file.name}" must be under 2 MB.`);
        return;
      }
      const dataBase64 = await readFileAsBase64(file);
      prepared.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataBase64,
      });
    }

    addAttachments(prepared);
  }

  function validateStep2(): Record<string, string> {
    const next: Record<string, string> = {};

    if (activeService === 'Website Development') {
      if (!getDetailStr('websiteType')) {
        next.websiteType = 'Please choose the type of website you want.';
      }
      if (getDetailStr('websitePurpose').trim().length < 20) {
        next.websitePurpose =
          'Please describe your website purpose in at least 20 characters.';
      }
    } else if (activeService === 'Advertising and Marketing') {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please enter a campaign or project title.';
      }
      if (getDetailStr('campaignGoal').trim().length < 20) {
        next.campaignGoal =
          'Please describe what you are promoting and your campaign goal (at least 20 characters).';
      }
    } else if (activeService === 'Flyer and Graphic Design') {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please enter a title for this design project.';
      }
      if (getDetailStr('designBrief').trim().length < 20) {
        next.designBrief =
          'Please describe the design brief and text/content to appear (at least 20 characters).';
      }
    } else if (activeService === 'Business Development') {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please provide a title for your business project.';
      }
      if (getDetailStr('businessIdea').trim().length < 20) {
        next.businessIdea =
          'Please explain your business idea and goals in at least 20 characters.';
      }
    } else if (activeService === 'Mobile Application Development') {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please enter a title or working name for your application.';
      }
      if (getDetailStr('appPurpose').trim().length < 20) {
        next.appPurpose =
          'Please describe what the application should do (at least 20 characters).';
      }
    } else if (activeService === 'Branding and Business Promotion') {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please enter a project title.';
      }
      if (getDetailStr('brandStory').trim().length < 20) {
        next.brandStory =
          'Please describe your brand vision and audience (at least 20 characters).';
      }
    } else {
      if (draft.projectTitle.trim().length < 3) {
        next.projectTitle = 'Please enter a clear project title.';
      }
      if (getDetailStr('projectOverview').trim().length < 20) {
        next.projectOverview =
          'Please describe your project requirements in at least 20 characters.';
      }
    }

    if (!isValidDeliveryTime(draft.deliveryTime)) {
      next.deliveryTime = 'Please select your requested delivery time before continuing.';
    }

    return next;
  }

  function handleContinueToReview(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateStep2();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (activeService === 'Website Development' && !draft.projectTitle.trim()) {
      const websiteType = getDetailStr('websiteType') || 'Website Project';
      const cleanBrand = draft.businessName.trim();
      updateField('projectTitle', cleanBrand ? `${websiteType} for ${cleanBrand}` : websiteType);
    }

    navigate('/submit-project/review');
  }

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={2} />

      <section className="border-b border-[#E4E4E7] bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Link
                to="/submit-project"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Change Service
              </Link>
              <p className="mt-4 text-sm font-medium text-[#1D4ED8]">
                Step 2 · Project Requirements
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#141416] sm:text-4xl [text-wrap:balance]">
                {activeService}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5A5A62]">
                Provide your project requirements below so our team can review your scope accurately
                and prepare your quotation.
              </p>
            </div>

            <Link
              to="/submit-project"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-xs font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap shrink-0"
            >
              Switch Service Category
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <form
                onSubmit={handleContinueToReview}
                noValidate
                className="vtx-panel-enter space-y-8 rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-10"
              >
                {/* WEBSITE DEVELOPMENT TAILORED FIELDS */}
                {activeService === 'Website Development' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-[#141416]">
                        1. Website type <span className="text-red-600">*</span>
                      </label>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {WEBSITE_TYPES.map((item) => {
                          const selected = getDetailStr('websiteType') === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setDetail('websiteType', item.id)}
                              aria-pressed={selected}
                              className={`flex items-start justify-between gap-2 rounded-md border p-3.5 text-left transition-all duration-150 ${
                                selected
                                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.04] ring-1 ring-[#1D4ED8]/20'
                                  : 'border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#141416] hover:bg-white'
                              }`}
                            >
                              <div>
                                <p
                                  className={`text-sm font-semibold ${
                                    selected ? 'text-[#1D4ED8]' : 'text-[#141416]'
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-[#5A5A62]">
                                  {item.summary}
                                </p>
                              </div>
                              {selected && (
                                <Check
                                  className="vtx-pop-in mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {errors.websiteType && (
                        <p className="mt-2 text-xs text-red-700">{errors.websiteType}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or brand name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="e.g., Horizon Retail Ltd"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Project title{' '}
                          <span className="text-xs font-normal text-[#5A5A62]">(Optional)</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="Auto-filled from website type if blank"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-website-purpose"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Website purpose &amp; goals <span className="text-red-600">*</span>
                      </label>
                      <p className="mt-1 text-xs text-[#5A5A62]">
                        Explain what your website should communicate, who your audience is, and what
                        actions visitors should take.
                      </p>
                      <textarea
                        id="req-website-purpose"
                        rows={4}
                        value={getDetailStr('websitePurpose')}
                        onChange={(e) => setDetail('websitePurpose', e.target.value)}
                        placeholder="Describe what your business offers and what you want this website to accomplish..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.websitePurpose && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.websitePurpose}</p>
                      )}
                    </div>

                    <div>
                      <span className="block text-sm font-medium text-[#141416]">
                        Desired features
                      </span>
                      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {WEBSITE_FEATURE_OPTIONS.map((feature) => {
                          const checked = getDetailList('desiredFeatures').includes(feature);
                          return (
                            <label
                              key={feature}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-xs transition-colors ${
                                checked
                                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.04] font-medium text-[#141416]'
                                  : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#5A5A62] hover:border-[#141416]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMultiDetail('desiredFeatures', feature)}
                                className="h-4 w-4 rounded border-[#D4D4D8] text-[#1D4ED8]"
                              />
                              <span>{feature}</span>
                            </label>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={getDetailStr('customFeatures')}
                        onChange={(e) => setDetail('customFeatures', e.target.value)}
                        placeholder="Any other specific pages or features (e.g., Careers, Client Login, Inventory)..."
                        className="mt-3 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="req-preferred-design"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Preferred design &amp; visual direction
                      </label>
                      <textarea
                        id="req-preferred-design"
                        rows={3}
                        value={getDetailStr('preferredDesign')}
                        onChange={(e) => setDetail('preferredDesign', e.target.value)}
                        placeholder="Share preferred colors, mood (minimalist, corporate, bold), or reference websites..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {/* ADVERTISING AND MARKETING */}
                {activeService === 'Advertising and Marketing' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Campaign title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., Product Launch Campaign"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or brand name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Your business name"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-campaign-goal"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Campaign goal &amp; what you are promoting{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-campaign-goal"
                        rows={4}
                        value={getDetailStr('campaignGoal')}
                        onChange={(e) => setDetail('campaignGoal', e.target.value)}
                        placeholder="Describe the product, service, or offer you want to advertise and the outcome you want..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.campaignGoal && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.campaignGoal}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-audience"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Target audience &amp; channels
                        </label>
                        <input
                          id="req-audience"
                          type="text"
                          value={getDetailStr('targetAudience')}
                          onChange={(e) => setDetail('targetAudience', e.target.value)}
                          placeholder="e.g., Instagram, LinkedIn, Local customers"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="req-cta"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Key message or call-to-action
                        </label>
                        <input
                          id="req-cta"
                          type="text"
                          value={getDetailStr('keyMessage')}
                          onChange={(e) => setDetail('keyMessage', e.target.value)}
                          placeholder="e.g., Book a consultation, Order online"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* FLYER AND GRAPHIC DESIGN */}
                {activeService === 'Flyer and Graphic Design' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Design project title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., Grand Opening Promotional Flyer"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or brand name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Your business or event name"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-design-type"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Design format / item
                        </label>
                        <select
                          id="req-design-type"
                          value={getDetailStr('designFormat')}
                          onChange={(e) => setDetail('designFormat', e.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        >
                          <option value="">Select format</option>
                          <option value="Digital & Print Flyer">Digital &amp; Print Flyer</option>
                          <option value="Poster / Banner">Poster / Banner</option>
                          <option value="Social Media Post & Carousel Kit">
                            Social Media Post &amp; Carousel Kit
                          </option>
                          <option value="Product & Packaging Graphics">
                            Product &amp; Packaging Graphics
                          </option>
                          <option value="Company Profile / Brochure">
                            Company Profile / Brochure
                          </option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="req-colors"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Preferred colors &amp; style
                        </label>
                        <input
                          id="req-colors"
                          type="text"
                          value={getDetailStr('preferredDesign')}
                          onChange={(e) => setDetail('preferredDesign', e.target.value)}
                          placeholder="e.g., Clean editorial black & white, warm gold accents"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-design-brief"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Design brief &amp; exact wording to include{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-design-brief"
                        rows={4}
                        value={getDetailStr('designBrief')}
                        onChange={(e) => setDetail('designBrief', e.target.value)}
                        placeholder="Describe what the graphic is for, dimensions if known, and the exact headline, pricing, dates, or contact details to include..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.designBrief && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.designBrief}</p>
                      )}
                    </div>
                  </>
                )}

                {/* BUSINESS DEVELOPMENT */}
                {activeService === 'Business Development' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Project title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., New Retail Venture Launch Plan"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or venture name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Name or working title"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-biz-stage"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Current business stage
                        </label>
                        <select
                          id="req-biz-stage"
                          value={getDetailStr('businessStage')}
                          onChange={(e) => setDetail('businessStage', e.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        >
                          <option value="">Select current stage</option>
                          <option value="Early Concept / Idea">Early Concept / Idea</option>
                          <option value="Preparing to Launch">Preparing to Launch</option>
                          <option value="Existing Business Expanding">
                            Existing Business Expanding
                          </option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="req-biz-focus"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Primary focus area
                        </label>
                        <input
                          id="req-biz-focus"
                          type="text"
                          value={getDetailStr('supportArea')}
                          onChange={(e) => setDetail('supportArea', e.target.value)}
                          placeholder="e.g., Business Plan, Positioning, Launch Setup"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-biz-idea"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Describe your business idea &amp; goals{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-biz-idea"
                        rows={4}
                        value={getDetailStr('businessIdea')}
                        onChange={(e) => setDetail('businessIdea', e.target.value)}
                        placeholder="Explain your business concept, who your customers are, and what structured help you need..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.businessIdea && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.businessIdea}</p>
                      )}
                    </div>
                  </>
                )}

                {/* MOBILE APPLICATION DEVELOPMENT */}
                {activeService === 'Mobile Application Development' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Application name / project title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., Customer Delivery & Booking App"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-platforms"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Target platforms
                        </label>
                        <select
                          id="req-platforms"
                          value={getDetailStr('targetPlatforms')}
                          onChange={(e) => setDetail('targetPlatforms', e.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        >
                          <option value="">Select target platforms</option>
                          <option value="Android & iOS">Both Android &amp; iOS</option>
                          <option value="Android Only">Android Only</option>
                          <option value="iOS Only">iOS Only</option>
                          <option value="Mobile App + Web Admin Portal">
                            Mobile App + Web Admin Portal
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-app-purpose"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Application purpose &amp; core workflow{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-app-purpose"
                        rows={4}
                        value={getDetailStr('appPurpose')}
                        onChange={(e) => setDetail('appPurpose', e.target.value)}
                        placeholder="Describe how users will use the app, what problems it solves, and the main user journey..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.appPurpose && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.appPurpose}</p>
                      )}
                    </div>

                    <div>
                      <span className="block text-sm font-medium text-[#141416]">
                        Core features needed
                      </span>
                      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {MOBILE_FEATURE_OPTIONS.map((feature) => {
                          const checked = getDetailList('desiredFeatures').includes(feature);
                          return (
                            <label
                              key={feature}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-xs transition-colors ${
                                checked
                                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.04] font-medium text-[#141416]'
                                  : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#5A5A62] hover:border-[#141416]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMultiDetail('desiredFeatures', feature)}
                                className="h-4 w-4 rounded border-[#D4D4D8] text-[#1D4ED8]"
                              />
                              <span>{feature}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* BRANDING AND BUSINESS PROMOTION */}
                {activeService === 'Branding and Business Promotion' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Project title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., Full Brand Identity & Visibility Refresh"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or brand name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Company or brand name"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-brand-focus"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Branding focus
                      </label>
                      <select
                        id="req-brand-focus"
                        value={getDetailStr('brandingFocus')}
                        onChange={(e) => setDetail('brandingFocus', e.target.value)}
                        className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] bg-white px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      >
                        <option value="">Select primary focus</option>
                        <option value="New Brand Identity & Logo System">
                          New Brand Identity &amp; Logo System
                        </option>
                        <option value="Brand Refresh & Visual Guidelines">
                          Brand Refresh &amp; Visual Guidelines
                        </option>
                        <option value="Online Visibility & Promotional Outreach">
                          Online Visibility &amp; Promotional Outreach
                        </option>
                        <option value="Complete Branding & Growth Package">
                          Complete Branding &amp; Growth Package
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="req-brand-story"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Brand story, audience &amp; goals <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-brand-story"
                        rows={4}
                        value={getDetailStr('brandStory')}
                        onChange={(e) => setDetail('brandStory', e.target.value)}
                        placeholder="Describe what your brand stands for, who your audience is, and how you want customers to perceive you..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.brandStory && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.brandStory}</p>
                      )}
                    </div>
                  </>
                )}

                {/* OTHER DIGITAL SERVICES */}
                {activeService === 'Other Digital Services' && (
                  <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-project-title"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Project title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="req-project-title"
                          type="text"
                          value={draft.projectTitle}
                          onChange={(e) => updateField('projectTitle', e.target.value)}
                          placeholder="e.g., Full Startup Website + Brand Launch Package"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.projectTitle && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.projectTitle}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="req-brand-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Business or organisation name
                        </label>
                        <input
                          id="req-brand-name"
                          type="text"
                          value={draft.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Optional"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="req-other-overview"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Detailed project description <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="req-other-overview"
                        rows={5}
                        value={getDetailStr('projectOverview')}
                        onChange={(e) => setDetail('projectOverview', e.target.value)}
                        placeholder="Describe all the services, creative work, or custom digital deliverables you need..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.projectOverview && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.projectOverview}</p>
                      )}
                    </div>
                  </>
                )}

                {/* CUSTOMER BUDGET & REQUIRED DELIVERY TIME */}
                {budgetConfig && effectiveBudgetUsd !== undefined ? (
                  <div className="space-y-8 border-t border-[#E4E4E7] pt-6">
                    <ServiceBudgetSelector
                      config={budgetConfig}
                      valueUsd={effectiveBudgetUsd}
                      onChangeUsd={(nextUsd) => {
                        updateField('budgetUsd', nextUsd);
                        updateField(
                          'budgetRange',
                          nextUsd === budgetConfig.recommendedUsd
                            ? `$${nextUsd.toLocaleString()} USD (Recommended)`
                            : `$${nextUsd.toLocaleString()} USD (Customer Budget Estimate)`,
                        );
                      }}
                    />

                    <div className="border-t border-[#E4E4E7] pt-6">
                      <DeliveryTimeSelector
                        value={draft.deliveryTime}
                        onChange={(val) => {
                          updateField('deliveryTime', val);
                          setDetail('deliveryTime', val);
                          setErrors((prev) => {
                            if (!prev.deliveryTime) return prev;
                            const copy = {...prev};
                            delete copy.deliveryTime;
                            return copy;
                          });
                        }}
                        error={errors.deliveryTime}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 border-t border-[#E4E4E7] pt-6">
                    <div>
                      <span className="block text-sm font-semibold text-[#141416]">
                        Budget preference{' '}
                        <span className="text-xs font-normal text-[#5A5A62]">(Optional)</span>
                      </span>
                      <p className="mt-1 text-xs text-[#5A5A62]">
                        Select an indicative range or let our team recommend a scope after review.
                      </p>
                      <div
                        role="radiogroup"
                        aria-label="Budget preference"
                        className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                      >
                        {BUDGET_RANGES.map((range) => {
                          const selected = draft.budgetRange === range;
                          return (
                            <button
                              key={range}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => updateField('budgetRange', selected ? '' : range)}
                              className={`flex items-center gap-3 rounded-lg border p-3.5 text-left text-xs transition-all duration-150 ${
                                selected
                                  ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.05] font-semibold text-[#141416] ring-1 ring-[#1D4ED8]/20'
                                  : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#5A5A62] hover:border-[#141416] hover:bg-white'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                                    : 'border-[#D4D4D8] bg-white'
                                }`}
                              >
                                {selected && <Check className="h-2.5 w-2.5 stroke-[2.5]" />}
                              </span>
                              <span>{range}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-[#E4E4E7] pt-6">
                      <DeliveryTimeSelector
                        value={draft.deliveryTime}
                        onChange={(val) => {
                          updateField('deliveryTime', val);
                          setDetail('deliveryTime', val);
                          setErrors((prev) => {
                            if (!prev.deliveryTime) return prev;
                            const copy = {...prev};
                            delete copy.deliveryTime;
                            return copy;
                          });
                        }}
                        error={errors.deliveryTime}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="req-additional"
                    className="block text-sm font-medium text-[#141416]"
                  >
                    Additional requirements{' '}
                    <span className="text-xs font-normal text-[#5A5A62]">(Optional)</span>
                  </label>
                  <textarea
                    id="req-additional"
                    rows={3}
                    value={draft.additionalRequirements}
                    onChange={(e) => updateField('additionalRequirements', e.target.value)}
                    placeholder="Reference links, brand notes, or any extra details you would like VERTYLEX to review..."
                    className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                {/* FILE ATTACHMENTS */}
                <div className="border-t border-[#E4E4E7] pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-sm font-medium text-[#141416]">
                        Reference files or brief documents{' '}
                        <span className="text-xs font-normal text-[#5A5A62]">(Optional)</span>
                      </span>
                      <p className="mt-1 text-xs text-[#5A5A62]">
                        Attach logos, sketches, inspiration screenshots, or PDF/DOC briefs (up to 4
                        files, 2 MB max each).
                      </p>
                    </div>
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#D4D4D8] bg-[#FAFAFA] px-4 text-xs font-medium text-[#141416] transition-colors hover:border-[#141416]">
                      <Paperclip className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      Attach Files
                      <input
                        type="file"
                        multiple
                        accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.txt"
                        onChange={(e) => void handleFileChange(e)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {fileError && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                      {fileError}
                    </p>
                  )}

                  {attachments.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {attachments.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText
                              className="h-4 w-4 shrink-0 text-[#1D4ED8]"
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium text-[#141416]">{file.name}</span>
                            <span className="shrink-0 font-mono text-[#5A5A62] tabular-nums">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(file.id)}
                            aria-label={`Remove ${file.name}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5A5A62] hover:bg-white hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {Object.keys(errors).length > 0 && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
                  >
                    Please review and complete the highlighted required fields above before
                    continuing.
                  </div>
                )}

                {/* ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E4E4E7] pt-6">
                  <Link
                    to="/submit-project"
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-4 text-sm font-medium text-[#141416] hover:border-[#141416]"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to Services
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8]"
                  >
                    Review Your Project
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-lg border border-[#E4E4E7] bg-white p-6">
                <h2 className="font-display text-base font-semibold text-[#141416]">
                  Client &amp; Currency Summary
                </h2>
                <dl className="mt-4 space-y-2.5 text-xs">
                  <div>
                    <dt className="text-[#5A5A62]">Account Holder</dt>
                    <dd className="mt-0.5 font-medium text-[#141416]">
                      {user?.name} ({user?.email})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5A5A62]">Selected Service</dt>
                    <dd className="mt-0.5 font-medium text-[#1D4ED8]">{activeService}</dd>
                  </div>
                  {budgetConfig && effectiveBudgetUsd !== undefined && (
                    <div>
                      <dt className="text-[#5A5A62]">Selected Budget Estimate</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-[#141416] tabular-nums">
                        {formatCurrencyAmount(effectiveBudgetUsd, 'USD')} USD
                        {convertQuotationAmount(effectiveBudgetUsd, 'USD').isConverted && (
                          <span className="block text-[11px] font-normal text-[#5A5A62]">
                            ≈ {convertQuotationAmount(effectiveBudgetUsd, 'USD').displayFormatted} (
                            {region.currency})
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[#5A5A62]">Requested Delivery Time</dt>
                    <dd className="mt-0.5 font-medium text-[#141416]">
                      {draft.deliveryTime || 'Not selected yet (Required)'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 border-t border-[#E4E4E7] pt-4">
                  <RegionSelector showRateMeta />
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E4E7] bg-white p-6">
                <h2 className="font-display text-base font-semibold text-[#141416]">
                  Need Guidance?
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-[#5A5A62]">
                  Unsure how to describe a feature or scope? Chat with VERTYLEX Assistant while your
                  form stays saved. Currency display preference: {region.currency}.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openAssistant(
                      `I am filling out project requirements for ${activeService} and have a question.`,
                    )
                  }
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                >
                  <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                  Open VERTYLEX Assistant
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
