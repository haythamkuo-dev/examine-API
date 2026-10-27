/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import type { DepositFormValues } from '../../src/deposit/web';
import { stripTransientMerchantReference } from './useDepositOperator';

const danaDefaults: DepositFormValues = {
  channel: 'id_dana_usd',
  commonValues: {
    productNo: 'DEP-SINGLEPAYMENT-DANA-USD',
    merchantRef: 'Click button to acquire a merchant ref',
    amount: '10.00',
    currencyCode: 'USD',
    returnUrl: 'https://example.com/deposit-return',
  },
  channelValues: {
    payment_order: {
      country_code: 'ID',
      product_detail: 'Dana USD test order %s',
      singlepayment_dana: {
        origin: 'merchant.example.com',
        shopper_reference: 'DANA-TEST-USD-001',
        shopper_email: 'dana.test@example.com',
        holder_name: 'Dana Test User',
        browser_info: {
          os_type: 'ANDROID',
          terminal_type: 'WEB',
        },
      },
    },
  },
};

describe('stripTransientMerchantReference', () => {
  test('removes a server-provided merchant reference before page-local state is created', () => {
    const result = stripTransientMerchantReference(danaDefaults);

    expect(result.commonValues).not.toHaveProperty('merchantRef');
    expect(result.commonValues.amount).toBe('10.00');
    expect(result.channelValues).toEqual(danaDefaults.channelValues);
  });
});
