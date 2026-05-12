import type { CommandResult } from '../runner';

export const getRequestFailureHint = (result: CommandResult): string | undefined => {
  if (result.code === 'binding_missing') {
    return [
      'The current merchant is not bound to this product_no.',
      'Use a product number that is already bound for this API key.',
      'You can retry with a bound product number or update `.env`.',
    ].join(' ');
  }

  if (result.error?.startsWith('Timeout after ')) {
    return 'The API did not respond before timeout. Verify network access, API availability, or try again.';
  }

  return undefined;
};
