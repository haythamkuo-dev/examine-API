const getValueAtPath = (
  source: Record<string, unknown>,
  path: readonly string[],
): unknown => {
  let current: unknown = source;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

export type CodeFormatRule = {
  path: readonly string[];
  pattern: RegExp;
  message: string;
};

/**
 * Validates code-like form fields whose values must match a stable business format instead of arbitrary token strings.
 *
 * @param source Root object containing the editable values to validate.
 * @param rules Validation rules describing field paths, accepted formats, and failure messages.
 * @returns The first matching validation error, or `undefined` when all configured fields are valid.
 */
export const validateCodeFormatRules = (
  source: Record<string, unknown>,
  rules: readonly CodeFormatRule[],
): string | undefined => {
  for (const rule of rules) {
    const candidate = getValueAtPath(source, rule.path);

    if (typeof candidate !== 'string' || !candidate.trim()) {
      continue;
    }

    if (!rule.pattern.test(candidate.trim())) {
      return rule.message;
    }
  }

  return undefined;
};
