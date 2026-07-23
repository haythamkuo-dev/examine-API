import type { PayoutChannel } from '../../../src/core/env';

// #todo: Move channel display labels to a shared configuration source.
export const PAYOUT_CHANNEL_LABELS: Partial<Record<PayoutChannel, string>> = {
  co_bank: '哥倫比亞銀行轉帳',
  co_wallet: '哥倫比亞電子錢包',
  imps: '印度代付',
  bd_wallet: '孟加拉電子錢包',
};

/**
 * Returns the operator-facing label for a payout channel.
 *
 * @param channel The backend channel identifier.
 * @returns The translated label, or the original identifier when unmapped.
 */
export function getPayoutChannelLabel(channel: string): string {
  return PAYOUT_CHANNEL_LABELS[channel as PayoutChannel] ?? channel;
}
