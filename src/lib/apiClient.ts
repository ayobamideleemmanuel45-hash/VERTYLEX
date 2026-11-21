// Volatile in-memory session proof used strictly as a runtime fallback when
// an iframe sandbox restricts third-party cookies. Never written to localStorage,
// sessionStorage, or document.cookie.
let inMemorySessionToken: string | null = null;

export function setMemoryAuthToken(token: string | null | undefined): void {
  inMemorySessionToken = token && token.trim() ? token.trim() : null;
}

export function clearMemoryAuthToken(): void {
  inMemorySessionToken = null;
}

export function hasMemoryAuthToken(): boolean {
  return Boolean(inMemorySessionToken);
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (inMemorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
