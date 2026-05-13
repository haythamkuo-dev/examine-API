import { describe, expect, test } from 'bun:test';
import type { PayoutFieldMap } from '../../src/payout/web';
import { shouldHidePayoutField } from './PayoutPage';

describe('shouldHidePayoutField', () => {
  const schema: PayoutFieldMap = {
    required_name: {
      kind: 'text',
      label: 'Required name',
      required: true,
    },
    optional_note: {
      kind: 'text',
      label: 'Optional note',
    },
    beneficiary: {
      kind: 'object',
      label: 'Beneficiary',
      fields: {
        required_name: {
          kind: 'text',
          label: 'Required name',
          required: true,
        },
        optional_identification: {
          kind: 'text',
          label: 'Optional identification',
        },
      },
    },
    remitter: {
      kind: 'object',
      label: 'Remitter',
      fields: {
        optional_name: {
          kind: 'text',
          label: 'Optional name',
        },
        optional_city: {
          kind: 'text',
          label: 'Optional city',
        },
      },
    },
  };

  test('hides optional placeholder-only scalar fields', () => {
    expect(shouldHidePayoutField(schema.optional_note, '付款人姓名 (非必填)')).toBe(true);
  });

  test('keeps required fields visible', () => {
    expect(shouldHidePayoutField(schema.required_name, '   ')).toBe(false);
  });

  test('keeps optional fields visible when they have real values', () => {
    expect(shouldHidePayoutField(schema.optional_note, 'Operator provided note')).toBe(false);
  });

  test('hides optional object containers when all descendants are placeholder-only', () => {
    expect(
      shouldHidePayoutField(schema.remitter, {
        optional_name: '付款人姓名 (非必填)',
        optional_city: '城市 (非必填)',
      }),
    ).toBe(true);
  });

  test('keeps object containers visible when they contain a visible descendant', () => {
    expect(
      shouldHidePayoutField(schema.beneficiary, {
        required_name: 'E2E Beneficiary',
        optional_identification: '其他識別編號 (非必填)',
      }),
    ).toBe(false);
  });
});
