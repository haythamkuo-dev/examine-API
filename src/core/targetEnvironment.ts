export const targetEnvironmentHeaderName = 'X-Target-Environment';

export const targetEnvironmentValues = ['local', 'product'] as const;

export type TargetEnvironment = (typeof targetEnvironmentValues)[number];

export const defaultTargetEnvironment: TargetEnvironment = 'local';

/**
 * Parses a raw request target-environment value into a supported enum.
 *
 * @param value Header or storage value supplied by the caller.
 * @returns A supported target environment, or `null` when the value is invalid.
 */
export const parseTargetEnvironment = (value: string | null | undefined): TargetEnvironment | null => {
  if (!value) {
    return null;
  }

  return targetEnvironmentValues.find((candidate) => candidate === value) || null;
};

/**
 * Resolves the target environment from request headers with a safe default.
 *
 * @param headers HTTP headers carrying the optional target-environment selector.
 * @returns The requested environment or the default local target when omitted.
 * @throws {TypeError} When the header is present but not supported.
 */
export const resolveTargetEnvironment = (headers: Headers): TargetEnvironment => {
  const rawValue = headers.get(targetEnvironmentHeaderName);
  const parsedValue = parseTargetEnvironment(rawValue);

  if (!rawValue) {
    return defaultTargetEnvironment;
  }

  if (!parsedValue) {
    throw new TypeError(`Unsupported target environment: ${rawValue}`);
  }

  return parsedValue;
};
