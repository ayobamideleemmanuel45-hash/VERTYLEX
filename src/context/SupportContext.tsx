import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface IntegrationsStatus {
  whatsapp: {
    configured: boolean;
    apiConnected: boolean;
    officialUrl: string | null;
  };
  payments: {
    activeProvider: 'paystack' | 'flutterwave' | null;
    providers: {
      paystack: {configured: boolean; name: string; supportedCurrencies: string[]};
      flutterwave: {configured: boolean; name: string; supportedCurrencies: string[]};
    };
  };
  assistant: {
    configured: boolean;
  };
  smtpConfigured: boolean;
}

const DEFAULT_INTEGRATIONS: IntegrationsStatus = {
  whatsapp: {
    configured: false,
    apiConnected: false,
    officialUrl: null,
  },
  payments: {
    activeProvider: null,
    providers: {
      paystack: {configured: false, name: 'Paystack', supportedCurrencies: ['NGN', 'USD', 'GHS', 'KES', 'ZAR']},
      flutterwave: {
        configured: false,
        name: 'Flutterwave',
        supportedCurrencies: ['NGN', 'USD', 'GBP', 'EUR', 'CAD', 'GHS', 'KES', 'ZAR'],
      },
    },
  },
  assistant: {
    configured: true,
  },
  smtpConfigured: false,
};

interface SupportContextValue {
  integrations: IntegrationsStatus;
  assistantOpen: boolean;
  prefilledTopic: string | null;
  openAssistant: (topic?: string) => void;
  closeAssistant: () => void;
  refreshIntegrations: () => Promise<void>;
}

const SupportContext = createContext<SupportContextValue | undefined>(undefined);

export function SupportProvider({children}: {children: ReactNode}) {
  const [integrations, setIntegrations] = useState<IntegrationsStatus>(DEFAULT_INTEGRATIONS);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefilledTopic, setPrefilledTopic] = useState<string | null>(null);

  const refreshIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = (await res.json()) as IntegrationsStatus;
        setIntegrations(data);
      }
    } catch {
      // Keep conservative defaults when unreachable
    }
  }, []);

  useEffect(() => {
    void refreshIntegrations();
  }, [refreshIntegrations]);

  const openAssistant = useCallback((topic?: string) => {
    setPrefilledTopic(topic || null);
    setAssistantOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
  }, []);

  return (
    <SupportContext.Provider
      value={{
        integrations,
        assistantOpen,
        prefilledTopic,
        openAssistant,
        closeAssistant,
        refreshIntegrations,
      }}
    >
      {children}
    </SupportContext.Provider>
  );
}

export function useSupport(): SupportContextValue {
  const ctx = useContext(SupportContext);
  if (!ctx) {
    throw new Error('useSupport must be used inside a SupportProvider');
  }
  return ctx;
}
