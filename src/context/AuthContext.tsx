import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {
  apiFetch,
  clearMemoryAuthToken,
  hasMemoryAuthToken,
  setMemoryAuthToken,
} from '../lib/apiClient';

export interface UserLocationPreferences {
  countryCode: string;
  countryName: string;
  stateRegion?: string;
  preferredCurrency?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  countryCode?: string;
  countryName?: string;
  stateRegion?: string;
  preferredCurrency?: string;
  createdAt: string;
}

export interface AuthSessionInfo {
  rememberMe: boolean;
  expiresAt: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  session: AuthSessionInfo | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
    locationOverride?: UserLocationPreferences | null,
  ) => Promise<AuthUser>;
  register: (
    name: string,
    email: string,
    password: string,
    rememberMe?: boolean,
    location?: UserLocationPreferences | null,
  ) => Promise<AuthUser>;
  updatePreferences: (preferences: UserLocationPreferences) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const DEVICE_LOCATION_KEY = 'vertylex_device_location';

export function getDeviceLocationHint(): UserLocationPreferences | null {
  try {
    const raw = localStorage.getItem(DEVICE_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserLocationPreferences>;
    if (
      typeof parsed.countryCode === 'string' &&
      parsed.countryCode.length === 2 &&
      typeof parsed.countryName === 'string' &&
      parsed.countryName.length >= 2
    ) {
      return {
        countryCode: parsed.countryCode,
        countryName: parsed.countryName,
        ...(typeof parsed.stateRegion === 'string' && parsed.stateRegion
          ? {stateRegion: parsed.stateRegion}
          : {}),
        ...(typeof parsed.preferredCurrency === 'string' && parsed.preferredCurrency
          ? {preferredCurrency: parsed.preferredCurrency}
          : {}),
      };
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function saveDeviceLocationHint(user: AuthUser | null) {
  if (!user?.countryCode || !user?.countryName) return;
  try {
    const hint: UserLocationPreferences = {
      countryCode: user.countryCode,
      countryName: user.countryName,
      ...(user.stateRegion ? {stateRegion: user.stateRegion} : {}),
      ...(user.preferredCurrency ? {preferredCurrency: user.preferredCurrency} : {}),
    };
    localStorage.setItem(DEVICE_LOCATION_KEY, JSON.stringify(hint));
  } catch {
    // Ignore storage access errors
  }
}

function clearSessionDrafts() {
  try {
    sessionStorage.removeItem('vertylex_project_draft');
    sessionStorage.removeItem('vertylex_project_draft_v2');
    sessionStorage.removeItem('vertylex_website_draft');
    sessionStorage.removeItem('vertylex_contact_draft');
  } catch {
    // Ignore storage access errors in restricted browsers
  }
}

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<AuthSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as {
          user: AuthUser | null;
          isAdmin?: boolean;
          session?: AuthSessionInfo | null;
        };
        const resolved = data.user ?? null;
        if (!resolved && hasMemoryAuthToken()) {
          clearMemoryAuthToken();
        }
        if (resolved) {
          saveDeviceLocationHint(resolved);
        }
        setUser(resolved);
        setIsAdmin(Boolean(data.isAdmin && resolved?.role === 'admin'));
        setSession(data.session ?? null);
        return resolved;
      }
      setUser(null);
      setIsAdmin(false);
      setSession(null);
      return null;
    } catch {
      return user;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshUser();
    // Initial mount check only; avoid re-running when user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe = false,
      locationOverride?: UserLocationPreferences | null,
    ) => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email,
          password,
          rememberMe,
          ...(locationOverride
            ? {
                updateLocation: true,
                countryCode: locationOverride.countryCode,
                countryName: locationOverride.countryName,
                stateRegion: locationOverride.stateRegion || '',
                preferredCurrency: locationOverride.preferredCurrency || '',
              }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        isAdmin?: boolean;
        session?: AuthSessionInfo | null;
        sessionToken?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Unable to sign in.');
      }
      if (data.sessionToken) {
        setMemoryAuthToken(data.sessionToken);
      }
      saveDeviceLocationHint(data.user);
      setUser(data.user);
      setIsAdmin(Boolean(data.isAdmin && data.user.role === 'admin'));
      setSession(data.session ?? null);
      return data.user;
    },
    [],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      rememberMe = false,
      location?: UserLocationPreferences | null,
    ) => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name,
          email,
          password,
          rememberMe,
          ...(location
            ? {
                countryCode: location.countryCode,
                countryName: location.countryName,
                stateRegion: location.stateRegion || '',
                preferredCurrency: location.preferredCurrency || '',
              }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        isAdmin?: boolean;
        session?: AuthSessionInfo | null;
        sessionToken?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Unable to create account.');
      }
      if (data.sessionToken) {
        setMemoryAuthToken(data.sessionToken);
      }
      saveDeviceLocationHint(data.user);
      setUser(data.user);
      setIsAdmin(Boolean(data.isAdmin && data.user.role === 'admin'));
      setSession(data.session ?? null);
      return data.user;
    },
    [],
  );

  const updatePreferences = useCallback(async (preferences: UserLocationPreferences) => {
    const res = await apiFetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(preferences),
    });
    const data = (await res.json()) as {user?: AuthUser; error?: string};
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Unable to update account preferences.');
    }
    saveDeviceLocationHint(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      clearMemoryAuthToken();
      clearSessionDrafts();
      setUser(null);
      setIsAdmin(false);
      setSession(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        session,
        loading,
        login,
        register,
        updatePreferences,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
