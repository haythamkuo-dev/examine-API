import type { DepositChannel } from '../../../src/core/env';

// #todo: Move channel display labels to a shared configuration source.
export const DEPOSIT_CHANNEL_LABELS: Partial<Record<DepositChannel, string>> = {
  southafrica_cards: '南非卡',
  linepay: 'line pay',
  linepay_invoice: 'line_pay_invoice',
  inr_upi: '印度代收',
  bdt_worldpay: '孟加拉代收',
  co_bank_transfer: '哥倫比亞銀行轉帳',
  co_cash: '哥倫比亞現金',
  co_nequi: '哥倫比亞nequi',
  co_pse: '哥倫比亞pse',
  th_rabbit_linepay: '泰國linepay',
  my_tng: '馬來西亞tng',
  international_credit_cards: 'collect_USD 一般通道',
  'JCB-USD': 'collect_USD 指定通道',
  'JCB-JPY': 'collect_JPY 指定通道',
  'ALIPAY-CNY': 'collect_CNY 通道',
  'ALIPAY-HKD': 'collect_HKD 通道',
  'WECHAT-HKD': 'collect_HKD 補充通道',
  'ALIPAY-8000': '人民幣代收(8000通道)',
  'ALIPAY-6014': '人民幣代收(6014通道)',
  'WECHAT-6016': '人民幣代收(6016通道)',
  'cmoney-intercard': 'cmoney-國際信用卡',
};

/**
 * Returns the operator-facing label for a deposit channel.
 *
 * @param channel The backend channel identifier.
 * @returns The translated label, or the original identifier when unmapped.
 */
export function getDepositChannelLabel(channel: string): string {
  return DEPOSIT_CHANNEL_LABELS[channel as DepositChannel] ?? channel;
}
