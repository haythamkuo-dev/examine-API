import { describe, expect, test } from 'bun:test';
import {
  validateFormSections,
  validateSchemaMap,
  type ValidationSchemaMap,
} from '../src/core/formValidation';

// const schema: ValidationSchemaMap = {
//   merchantRef: {
//     kind: 'text',
//     required: true,
//   },
//   payoutInfo: {
//     kind: 'object',
//     fields: {
//       beneficiary: {
//         kind: 'object',
//         fields: {
//           name: {
//             kind: 'text',
//             required: true,
//           },
//         },
//       },
//     },
//   },
//   beneficiaries: {
//     kind: 'array',
//     required: true,
//     itemSchema: {
//       kind: 'object',
//       fields: {
//         id: {
//           kind: 'text',
//           required: true,
//         },
//       },
//     },
//   },
//   issueInvoice: {
//     kind: 'boolean',
//     required: true,
//   },
//   metadata: {
//     kind: 'object',
//     fields: {
//       note: {
//         kind: 'textarea',
//         required: true,
//       },
//     },
//   },
// };

// todo: 使用gemini 重寫測試資料
const schema={ merchantRef: {
    kind: 'text',
    required: true,
  },
  payoutInfo: {
    kind: 'object',
    fields: {
      beneficiary: {
        kind: 'object',
        fields: {
          name: {
            kind: 'text',
            required: true,
          },
        },
      },
    },
  },
  beneficiaries: {
    kind: 'array',
    required: true,
    itemSchema: {
      kind: 'object',
      fields: {
        id: {
          kind: 'text',
          required: true,
        },
      },
    },
  },
  issueInvoice: {
    kind: 'boolean',
    required: true,
  },
  metadata: {
    kind: 'object',
    fields: {
      note: {
        kind: 'textarea',
        required: true,
      },
    },
  },}satisfies ValidationSchemaMap;

describe('form validation core', () => {
  test('returns an error for blank required scalar values', () => {
    const error = validateSchemaMap(
      {
        merchantRef: schema.merchantRef,
      },
      {
        merchantRef: '   ',
      },
    );

    expect(error).toBe('merchantRef is required');
  });

  test('returns a nested object path for missing required fields', () => {
    const error = validateSchemaMap(
      {
        payoutInfo: schema.payoutInfo,
      },
      {
        payoutInfo: {
          beneficiary: {
            name: '',
          },
        },
      },
    );

    expect(error).toBe('payoutInfo.beneficiary.name is required');
  });

  test('returns an indexed array path for invalid array items', () => {
    const error = validateSchemaMap(
      {
        beneficiaries: schema.beneficiaries,
      },
      {
        beneficiaries: [
          {
            id: '',
          },
        ],
      },
    );

    expect(error).toBe('beneficiaries[0].id is required');
  });

  test('requires booleans to be actual boolean values', () => {
    const error = validateSchemaMap(
      {
        issueInvoice: schema.issueInvoice,
      },
      {
        issueInvoice: 'true',
      },
    );

    expect(error).toBe('issueInvoice is required');
  });

  test('does not error on optional arrays when absent', () => {
    const error = validateSchemaMap(
      {
        beneficiaries: {
          kind: 'array',
          itemSchema: {
            kind: 'object',
            fields: {
              id: {
                kind: 'text',
                required: true,
              },
            },
          },
        },
      },
      {},
    );

    expect(error).toBeUndefined();
  });

  test('short-circuits on the first common-section error before validating channel values', () => {
    const error = validateFormSections(
      {
        commonValues: {
          merchantRef: '   ',
        },
        channelValues: {
          beneficiaries: [
            {
              id: '',
            },
          ],
        },
      },
      {
        merchantRef: schema.merchantRef,
      },
      {
        beneficiaries: schema.beneficiaries,
      },
    );

    expect(error).toBe('merchantRef is required');
  });
});
