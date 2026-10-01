/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import type { DepositFormValues } from '../../src/deposit/web';
import { mergeDepositFormWithDefaults } from './useDepositOperator';

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

describe('mergeDepositFormWithDefaults', () => {
  test('repairs a stale draft without losing valid edits or server fields', () => {
    const result = mergeDepositFormWithDefaults(danaDefaults, {
      channel: 'id_dana_usd',
      commonValues: {
        productNo: danaDefaults.commonValues.productNo,
        merchantRef: 'TEST_ORDER_stale-draft',
        amount: danaDefaults.commonValues.productNo,
        currencyCode: 'USD',
        returnUrl: danaDefaults.commonValues.returnUrl,
      },
      channelValues: {
        payment_order: {
          country_code: 'ID',
          product_detail: danaDefaults.channelValues.payment_order &&
            (danaDefaults.channelValues.payment_order as Record<string, unknown>).product_detail,
          singlepayment_dana: {
            origin: 'edited.example.com',
          },
        },
      },
    });

    expect(result.commonValues.amount).toBe('10.00');
    expect(result.commonValues.merchantRef).toBe('TEST_ORDER_stale-draft');
    expect(result.channelValues).toMatchObject({
      payment_order: {
        country_code: 'ID',
        product_detail: 'Dana USD test order %s',
        singlepayment_dana: {
          origin: 'edited.example.com',
          shopper_reference: 'DANA-TEST-USD-001',
          shopper_email: 'dana.test@example.com',
          holder_name: 'Dana Test User',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
  });
});
