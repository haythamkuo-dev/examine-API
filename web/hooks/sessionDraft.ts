import type { OperatorEnvironmentMode } from '../pages/helper/operatorShared';

const sessionDraftStoragePrefix = 'examine-api:draft';
const sessionDraftVersion = 1;

type SessionDraftEnvelope<T> = {
  version: number;
  updatedAt: string;
  values: T;
};

export type SessionDraftScope = {
  domain: 'deposit' | 'payout' | 'subscription';
  channel: string;
  targetEnvironment: OperatorEnvironmentMode;
};

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const buildSessionDraftStorageKey = ({
  domain,
  channel,
  targetEnvironment,
}: SessionDraftScope): string =>
  `${sessionDraftStoragePrefix}:${domain}:${channel}:${targetEnvironment}`;

export const readSessionDraft = <T>(scope: SessionDraftScope): T | null => {
  if (!canUseSessionStorage()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(buildSessionDraftStorageKey(scope));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as SessionDraftEnvelope<unknown>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== sessionDraftVersion) {
      return null;
    }

    return parsed.values as T;
  } catch {
    return null;
  }
};

export const writeSessionDraft = <T>(scope: SessionDraftScope, values: T): void => {
  if (!canUseSessionStorage()) {
    return;
  }

  const envelope: SessionDraftEnvelope<T> = {
    version: sessionDraftVersion,
    updatedAt: new Date().toISOString(),
    values,
  };

  window.sessionStorage.setItem(
    buildSessionDraftStorageKey(scope),
    JSON.stringify(envelope),
  );
};

export const clearSessionDraft = (scope: SessionDraftScope): void => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(buildSessionDraftStorageKey(scope));
};
