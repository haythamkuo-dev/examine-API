import { useEffect, useState } from 'react';

const apiKeyStorageKey = 'examine-api.operator-api-key';

const readStoredApiKey = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(apiKeyStorageKey) || '';
};

/**
 * Stores an API key draft in localStorage while the current page is active.
 *
 * The hook uses lazy initial state so refreshes can restore the last edited value,
 * then clears the stored draft when the page unmounts or the browser starts unloading.
 *
 * @param fallbackValue Backend-provided default API key used when no draft exists.
 * @returns The current API key value plus a setter that also persists the draft.
 */
export function usePersistentApiKey(fallbackValue: string) {
  const [apiKey, setApiKey] = useState<string>(() => readStoredApiKey() || fallbackValue);

  useEffect(() => {
    const storedApiKey = readStoredApiKey();
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, [fallbackValue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      window.localStorage.removeItem(apiKeyStorageKey);
    };

    if (apiKey) {
      window.localStorage.setItem(apiKeyStorageKey, apiKey);
    } else {
      window.localStorage.removeItem(apiKeyStorageKey);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.localStorage.removeItem(apiKeyStorageKey);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [apiKey]);

  return [apiKey, setApiKey] as const;
}
