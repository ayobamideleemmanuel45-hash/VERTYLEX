import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {getServiceBudgetConfig, normalizeToOrderService} from '../data/vertylex';

const DRAFT_STORAGE_KEY = 'vertylex_project_draft_v2';

export interface DraftAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
}

export interface SubmittedAttachmentMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SubmittedProjectSummary {
  id: string;
  referenceId: string;
  fullName: string;
  email: string;
  businessName: string;
  selectedService: string;
  projectTitle: string;
  ideaDescription: string;
  budgetRange: string;
  budgetUsd?: number;
  recommendedBudgetUsd?: number;
  budgetDisplayCurrency?: string;
  budgetEstimatedLocalAmount?: number;
  budgetExchangeRateAtSubmit?: number;
  preferredCurrency?: string;
  deliveryTime?: string;
  deliveryTimeStatus?: string;
  confirmedDeliveryTime?: string;
  additionalRequirements: string;
  serviceDetails?: Record<string, string | string[]>;
  attachments?: SubmittedAttachmentMeta[];
  progressStage?: string;
  status: string;
  createdAt: string;
  emailDelivered: boolean;
}

export interface ProjectDraftState {
  selectedService: string;
  projectTitle: string;
  businessName: string;
  budgetRange: string;
  budgetUsd?: number;
  deliveryTime: string;
  additionalRequirements: string;
  serviceDetails: Record<string, string | string[]>;
  idempotencyKey: string;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `vtx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatBudgetUsdLabel(amountUsd: number, recommendedUsd?: number): string {
  const formatted = `$${amountUsd.toLocaleString()} USD`;
  return recommendedUsd && amountUsd === recommendedUsd
    ? `${formatted} (Recommended)`
    : `${formatted} (Customer Budget Estimate)`;
}

function resolveOptionUsd(
  cfg: ReturnType<typeof getServiceBudgetConfig>,
  rawUsd: unknown,
): number | undefined {
  if (!cfg) return undefined;
  if (typeof rawUsd === 'number' && Number.isFinite(rawUsd)) {
    const rounded = Math.round(rawUsd);
    if (cfg.options.some((opt) => opt.amountUsd === rounded)) {
      return rounded;
    }
  }
  return cfg.recommendedUsd;
}

function createInitialDraft(): ProjectDraftState {
  const base: ProjectDraftState = {
    selectedService: '',
    projectTitle: '',
    businessName: '',
    budgetRange: '',
    budgetUsd: undefined,
    deliveryTime: '',
    additionalRequirements: '',
    serviceDetails: {},
    idempotencyKey: generateIdempotencyKey(),
  };

  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProjectDraftState>;
      const selectedService = normalizeToOrderService(parsed.selectedService) || '';
      const cfg = getServiceBudgetConfig(selectedService);
      const budgetUsd = resolveOptionUsd(cfg, parsed.budgetUsd);
      return {
        selectedService,
        projectTitle: typeof parsed.projectTitle === 'string' ? parsed.projectTitle : '',
        businessName: typeof parsed.businessName === 'string' ? parsed.businessName : '',
        budgetRange: cfg && budgetUsd
          ? formatBudgetUsdLabel(budgetUsd, cfg.recommendedUsd)
          : typeof parsed.budgetRange === 'string'
            ? parsed.budgetRange
            : '',
        budgetUsd,
        deliveryTime: typeof parsed.deliveryTime === 'string' ? parsed.deliveryTime : '',
        additionalRequirements:
          typeof parsed.additionalRequirements === 'string' ? parsed.additionalRequirements : '',
        serviceDetails:
          parsed.serviceDetails && typeof parsed.serviceDetails === 'object'
            ? parsed.serviceDetails
            : {},
        idempotencyKey:
          typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey
            ? parsed.idempotencyKey
            : base.idempotencyKey,
      };
    }
  } catch {
    // Ignore storage access failures
  }
  return base;
}

interface ProjectDraftContextValue {
  draft: ProjectDraftState;
  attachments: DraftAttachment[];
  lastSubmitted: SubmittedProjectSummary | null;
  setSelectedService: (service: string) => void;
  updateField: <K extends keyof ProjectDraftState>(key: K, value: ProjectDraftState[K]) => void;
  setDetail: (key: string, value: string | string[]) => void;
  toggleMultiDetail: (key: string, option: string) => void;
  addAttachments: (files: DraftAttachment[]) => void;
  removeAttachment: (id: string) => void;
  setLastSubmitted: (project: SubmittedProjectSummary | null) => void;
  resetDraft: (keepService?: string) => void;
}

const ProjectDraftContext = createContext<ProjectDraftContextValue | undefined>(undefined);

export function ProjectDraftProvider({children}: {children: ReactNode}) {
  const [draft, setDraft] = useState<ProjectDraftState>(() => createInitialDraft());
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedProjectSummary | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage access errors
    }
  }, [draft]);

  const setSelectedService = useCallback((service: string) => {
    const normalized = normalizeToOrderService(service) || service;
    const cfg = getServiceBudgetConfig(normalized);
    setDraft((prev) => {
      const sameService = prev.selectedService === normalized;
      let nextBudgetUsd: number | undefined;
      let nextBudgetRange = prev.budgetRange;

      if (cfg) {
        if (sameService) {
          nextBudgetUsd = resolveOptionUsd(cfg, prev.budgetUsd);
        } else {
          nextBudgetUsd = cfg.recommendedUsd;
        }
        nextBudgetRange = formatBudgetUsdLabel(
          nextBudgetUsd ?? cfg.recommendedUsd,
          cfg.recommendedUsd,
        );
      } else {
        nextBudgetUsd = undefined;
        if (prev.budgetUsd !== undefined) {
          nextBudgetRange = '';
        }
      }

      return {
        ...prev,
        selectedService: normalized,
        budgetUsd: nextBudgetUsd,
        budgetRange: nextBudgetRange,
        idempotencyKey: prev.idempotencyKey || generateIdempotencyKey(),
      };
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof ProjectDraftState>(key: K, value: ProjectDraftState[K]) => {
      setDraft((prev) => ({...prev, [key]: value}));
    },
    [],
  );

  const setDetail = useCallback((key: string, value: string | string[]) => {
    setDraft((prev) => ({
      ...prev,
      serviceDetails: {
        ...prev.serviceDetails,
        [key]: value,
      },
    }));
  }, []);

  const toggleMultiDetail = useCallback((key: string, option: string) => {
    setDraft((prev) => {
      const current = prev.serviceDetails[key];
      const list = Array.isArray(current) ? current : [];
      const exists = list.includes(option);
      const nextList = exists ? list.filter((item) => item !== option) : [...list, option];
      return {
        ...prev,
        serviceDetails: {
          ...prev.serviceDetails,
          [key]: nextList,
        },
      };
    });
  }, []);

  const addAttachments = useCallback((files: DraftAttachment[]) => {
    setAttachments((prev) => [...prev, ...files].slice(0, 4));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetDraft = useCallback((keepService?: string) => {
    const normalized = keepService ? normalizeToOrderService(keepService) || keepService : '';
    const cfg = getServiceBudgetConfig(normalized);
    const fresh: ProjectDraftState = {
      selectedService: normalized,
      projectTitle: '',
      businessName: '',
      budgetRange: cfg ? formatBudgetUsdLabel(cfg.recommendedUsd, cfg.recommendedUsd) : '',
      budgetUsd: cfg ? cfg.recommendedUsd : undefined,
      deliveryTime: '',
      additionalRequirements: '',
      serviceDetails: {},
      idempotencyKey: generateIdempotencyKey(),
    };
    setDraft(fresh);
    setAttachments([]);
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem('vertylex_project_draft');
    } catch {
      // Ignore storage errors
    }
  }, []);

  return (
    <ProjectDraftContext.Provider
      value={{
        draft,
        attachments,
        lastSubmitted,
        setSelectedService,
        updateField,
        setDetail,
        toggleMultiDetail,
        addAttachments,
        removeAttachment,
        setLastSubmitted,
        resetDraft,
      }}
    >
      {children}
    </ProjectDraftContext.Provider>
  );
}

export function useProjectDraft(): ProjectDraftContextValue {
  const ctx = useContext(ProjectDraftContext);
  if (!ctx) {
    throw new Error('useProjectDraft must be used inside a ProjectDraftProvider');
  }
  return ctx;
}
