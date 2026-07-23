import type { SubscriptionChannel } from '../../../src/core/env';

// #todo: Move channel display labels to a shared configuration source.
export const SUBSCRIPTION_CHANNEL_LABELS: Partial<Record<SubscriptionChannel, string>> = {
  default: '南非卡',
  rabbitLinePay: '泰國linepay',
  touchAndGo: '馬來西亞tng',
};

/**
 * Returns the operator-facing label for a subscription channel.
 *
 * @param channel The backend channel identifier.
 * @returns The translated label, or the original identifier when unmapped.
 */
export function getSubscriptionChannelLabel(channel: string): string {
  return SUBSCRIPTION_CHANNEL_LABELS[channel as SubscriptionChannel] ?? channel;
}
